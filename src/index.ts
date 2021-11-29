import fs from 'fs-extra'
import { execaCommand, execa } from 'execa'
import chalk from 'chalk'

export async function release (options) {
  // Check is repo clean
  const isDirtyGit = !!(
    await execa('git', ['status', '--porcelain'], { stdio: 'pipe', shell: true })
  ).stdout

  if (isDirtyGit) {
    console.log(chalk.red(`Git repo isn't clean.`))
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
        chalk.red(
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
      console.log(chalk.red(`Git branch is not in sync with remote`))
      process.exitCode = 1
      return
    }
  } else {
    console.warn(chalk.yellow(`It's recommended to specify an exepected branch for the release with the -b argument.`))
  }

  // Select new version
  console.log('Selecting new version...')
  await execaCommand('yarn --silent lerna version --no-git-tag-version', {
    stdio: 'inherit',
    shell: true,
  })

  if (!(await execa('git', ['status', '--porcelain'], { stdio: 'pipe', shell: true })).stdout) {
    // Canceled
    return
  }

  // Update root package.json version
  console.log('Updating root package.json version...')
  const lernaConfig = await fs.readJson('lerna.json')
  const pkgData = await fs.readJson('package.json')
  pkgData.version = lernaConfig.version
  await fs.writeJson('package.json', pkgData, { spaces: 2 })

  // Generate changelog
  console.log('Updating changelog...')
  await execa('yarn', [
      '--silent',
      'conventional-changelog',
      '-i', 'CHANGELOG.md', '-s', '-r', '1',
      '-p', options.preset,
  ], {
    stdio: 'inherit',
    shell: true,
  })

  // Publish packages
  console.log('Publishing packages...')
  // Use npm for auth
  await execa('npm', [
    'x', '--',
    'lerna', 'publish',
    'from-package', '--no-git-reset',
    ...(options.distTag ? ['--dist-tag', options.distTag] : []),
  ], {
    stdio: 'inherit',
    shell: true,
  })

  // Commit
  console.log('Creating commit...')
  await execaCommand(`git add . && git commit -m "v${pkgData.version}" && git push`, {
    stdio: 'inherit',
    shell: true,
  })

  // Git tag
  console.log('Creating git tag...')
  await execaCommand(`git tag v${pkgData.version} && git push --tags`, {
    stdio: 'inherit',
    shell: true,
  })

  console.log(chalk.green(`Successfully released v${pkgData.version}! 🐑️`))
}
