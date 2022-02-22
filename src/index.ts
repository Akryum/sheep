import fs from 'fs-extra'
import path from 'pathe'
import { execaCommand, execa } from 'execa'
import pc from 'picocolors'
import glob from 'fast-glob'
import semver from 'semver'
import prompts from 'prompts'

export interface ReleaseOptions {
  preset?: string
  distTag?: string
  expectedBranch?: string
  dryRun?: boolean
}

export async function release (options: ReleaseOptions) {
  // Check is repo clean
  const isDirtyGit = !!(
    await execa('git', ['status', '--porcelain'], { stdio: 'pipe', shell: true })
  ).stdout

  if (isDirtyGit) {
    console.log(pc.red(`Git repo isn't clean.`))
    process.exitCode = 1
    return
  }

  if (options.expectedBranch) {
    // Check current branch
    const currentBranch = (
      await execa('git', ['branch', '--show-current'], { stdio: 'pipe', shell: true })
    ).stdout

    if (currentBranch !== options.expectedBranch) {
      console.log(
        pc.red(
          `You should be on branch "${options.expectedBranch}" but are on "${currentBranch}"`
        )
      )
      process.exitCode = 1
      return
    }

    // Check if branch is outdated with remote
    const isOutdatedRE = new RegExp(
      `\\W${options.expectedBranch}\\W.*(?:fast-forwardable|local out of date)`,
      'i'
    )

    const isOutdatedGit = isOutdatedRE.test(
      (await execa('git', ['remote', 'show', 'origin'], { stdio: 'pipe', shell: true })).stdout
    )

    if (isOutdatedGit) {
      console.log(pc.red(`Git branch is not in sync with remote`))
      process.exitCode = 1
      return
    }
  } else {
    console.warn(pc.yellow(`It's recommended to specify an expected branch for the release with the -b argument.`))
  }

  // Mono-repo packages

  const packages = await getPackages()

  // Select new version
  const pkgData = await fs.readJson('package.json')
  const oldVersion = pkgData.version
  console.log(pc.blue(`Selecting new version from ${pc.bold(oldVersion)}`))
  const newVersion = await selectNewVersion(oldVersion)

  // Update package versions

  console.log(pc.blue('Updating packages version...'))
  const versionDiff = semver.diff(oldVersion, newVersion)
  const isPartialRelease = semver.major(newVersion) === 0
    ? ['patch', 'prepatch', 'prerelease'].includes(versionDiff)
    : ['minor', 'preminor', 'patch', 'prepatch', 'prerelease'].includes(versionDiff)
  
  if (isPartialRelease) {
    if (!packages.some(p => p.hasChanges)) {
      console.log(pc.red(`No package has changed since last release.`))
      process.exit(1)
    }

    for (const p of packages) {
      if (p.hasChanges && p.version !== newVersion) {
        p.version = p.pkg.version = newVersion
        console.log(pc.yellow(`${p.name} => ${newVersion}`))
        updateDepVersion(p, newVersion)
      }
    }
  } else {
    for (const p of packages) {
      p.version = p.pkg.version = newVersion
      console.log(pc.yellow(`${p.name} => ${newVersion}`))
    }
  }
  updateDepsVersions(packages)
  await writePackages(packages)

  // Update root package.json version
  console.log(pc.blue('Updating root package.json version...'))
  pkgData.version = newVersion
  await fs.writeJson('package.json', pkgData, { spaces: 2 })

  // Lock file
  console.log(pc.blue('Updating lock file...'))
  await execa('pnpm', ['i'], { stdio: 'inherit', shell: true })

  // Generate changelog
  console.log(pc.blue('Updating changelog...'))
  await execa('pnpm', [
      'exec',
      'conventional-changelog',
      '-i', 'CHANGELOG.md', '-s', '-r', '1',
      '-p', options.preset,
  ], {
    stdio: 'inherit',
    shell: true,
  })
  const changelogResponse = await prompts({
    type: 'confirm',
    name: 'confirm',
    message: 'Check the content of the changelog. Is it correct?',
  })
  if (!changelogResponse.confirm) {
    console.log(pc.red('Aborted!'))
    process.exit(1)
  }

  // Publish packages
  console.log(pc.blue('Publishing packages...'))
  if (!options.dryRun) {
    // Use npm for auth
    await execa('pnpm', [
      'publish',
      '-r',
      '--no-git-checks',
      ...(options.distTag ? ['--tag', options.distTag] : []),
    ], {
      stdio: 'inherit',
      shell: true,
    })
  } else {
    console.log(pc.gray('(Dry run) Will execute:'))
    console.log('pnpm', 
      'publish',
      '-r',
      '--no-git-checks',
      ...(options.distTag ? ['--dist-tag', options.distTag] : []),
    )
  }

  // Commit
  console.log(pc.blue('Creating commit...'))
  if (!options.dryRun) {
    await execaCommand(`git add . && git commit -m "v${newVersion}"`, {
      stdio: 'inherit',
      shell: true,
    })
    await execaCommand('git push', {
      stdio: 'inherit',
      shell: true,
    })
  } else {
    console.log(pc.gray('(Dry run) Will execute:'))
    console.log(`git add . && git commit -m "v${newVersion}"`)
    console.log('git push')
  }

  // Git tag
  console.log(pc.blue('Creating git tag...'))
  if (!options.dryRun) {
    await execaCommand(`git tag v${newVersion}`, {
      stdio: 'inherit',
      shell: true,
    })
    await execaCommand('git push --tags', {
      stdio: 'inherit',
      shell: true,
    })
  } else {
    console.log(pc.gray('(Dry run) Will execute:'))
    console.log(`git tag v${newVersion}`)
    console.log('git push --tags')
  }

  console.log(pc.green(`Successfully released v${newVersion}! 🐑️`))
  if (options.dryRun) {
    console.log(pc.yellow(`Dry run. No packages were published to npm. No commits and tags where pushed.`))
  }
}

interface Package {
  path: string
  pkgFile: string
  name: string
  version: string
  pkg: any
  hasChanges: boolean
  deps: Package[]
}

async function getPackages(): Promise<Package[]> {
  const lastTag = await getLastTag()
  
  const pkgFiles = await glob(path.join(process.cwd(), './packages/**/package.json'), {
    onlyFiles: true,
    ignore: ['**/node_modules/**'],
  })

  const result = await Promise.all(
    pkgFiles.map(async (pkgFile) => {
      const pkg = await fs.readJSON(pkgFile)
      const folder = path.dirname(pkgFile)
      if (!pkg.private && pkg.publishConfig?.access === 'public') {
        return {
          path: folder,
          pkgFile,
          name: pkg.name,
          version: pkg.version,
          pkg,
          hasChanges: await hasPackageChanged(folder, lastTag),
          deps: []
        }
      }
    })
  )
  const packages = result.filter(Boolean)
  await buildDependencyGraph(packages)
  return packages
}

async function getLastTag () {
  const { stdout: lastTag } = await execa('git', ['describe', '--tags', '--abbrev=0'], { stdio: 'pipe' })
  return lastTag
}

async function hasPackageChanged (folder: string, lastTag: string) {
  const { stdout: hasChanges } = await execa(
    'git',
    [
      'diff', lastTag,
      '--',
      path.join(folder, 'src'),
      path.join(folder, 'package.json'),
    ],
    { stdio: 'pipe' }
  )
  return !!hasChanges
}

async function buildDependencyGraph (packages: Package[]) {
  for (const p of packages) {
    p.deps = packages.filter(other => p.pkg.dependencies?.[other.name] || p.pkg.peerDependencies?.[other.name])
  }
}

function updateDepVersion (p: Package, newVersion: string) {
  for (const d of p.deps) {
    if (d.version !== newVersion) {
      d.version = d.pkg.version = newVersion
      console.log(pc.yellow(`${d.name} => ${newVersion}`))
      updateDepVersion(d, newVersion)
    }
  }
}

function updateDepsVersions (packageList: Package[]) {
  packageList.forEach((p) => {
    updateDeps(p, 'dependencies', packageList)
    updateDeps(p, 'peerDependencies', packageList)
  })
}

async function writePackages (packages: Package[]) {
  return Promise.all(
    packages.map(({ pkgFile, pkg }) => {
      return fs.writeJSON(pkgFile, pkg, {
        spaces: 2,
      })
    })
  )
}

function updateDeps (p: Package, depType: string, updatedPackages: Package[]) {
  const deps = p.pkg[depType]
  if (!deps) return
  Object.keys(deps).forEach((dep) => {
    const updatedDep = updatedPackages.find((pkg) => pkg.name === dep)
    // avoid updated peer deps that are external like @vue/devtools-api
    if (dep && updatedDep) {
      console.log(
        pc.yellow(
          `${p.pkg.name} -> ${depType} -> ${dep}@^${updatedDep.version}`
        )
      )
      deps[dep] = '^' + updatedDep.version
    }
  })
}

async function selectNewVersion (oldVersion: string): Promise<string> {
  const prerelease = semver.prerelease(oldVersion)
  const preId = prerelease && prerelease[0]

  const types: semver.ReleaseType[] = [
    'patch',
    'minor',
    'major',
    ...(preId ? [
      'prepatch',
      'preminor',
      'premajor',
      'prerelease',
    ] as semver.ReleaseType[] : []),
  ]
  const autoVersions = types.reduce((acc, type) => {
    acc[type] = semver.inc(oldVersion, type)
    return acc
  }, {} as Record<semver.ReleaseType, string>)

  const responses = await prompts([
    {
      name: 'newVersion',
      type: 'select',
      message: 'Select new version',
      choices: types.map(type => ({
        title: `${type} (${autoVersions[type]})`,
        value: autoVersions[type],
      })).concat([{
        title: 'Custom',
        value: '_custom',
      }])
    },
    {
      name: 'customVersion',
      type: prev => prev === '_custom' ? 'text' : null,
      message: 'Enter new custom version',
      validate: value => {
        if (value === '') {
          return 'Version is required'
        }
        if (!semver.valid(value)) {
          return 'Invalid version'
        }
        return true
      }
    },
    {
      name: 'confirm',
      type: 'confirm',
      message: (prev, values) => `Confirm new version: ${values.customVersion || values.newVersion}`,
    },
  ])

  if (!responses.confirm) {
    console.log(pc.red('Aborted!'))
    process.exit(1)
  }

  return responses.customVersion ?? responses.newVersion
}
