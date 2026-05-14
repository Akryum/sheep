import fs from 'fs-extra'
import pc from 'picocolors'
import prompts from 'prompts'
import { generateChangelog } from './changelog'
import { getCurrentBranch, isBranchOutdated, isRepoDirty } from './release/git'
import { getPackages, writePackages } from './release/packages'
import { commitAndPush, publishPackages, tagAndPush } from './release/publish'
import { run } from './release/run'
import {
  isPartialRelease,
  selectNewVersion,
  selectPackagesToBump,
} from './release/version'
import type { Package, PackageJson, ReleaseOptions } from './release/types'

export type { Package, PackageJson, ReleaseOptions } from './release/types'

/**
 * Run the full release workflow:
 *   1. Validate git state (clean tree, expected branch, in sync with remote).
 *   2. Discover workspace packages and detect which ones changed.
 *   3. Prompt for a new version.
 *   4. Update package versions and the lockfile.
 *   5. Generate the changelog and ask the user to confirm.
 *   6. Publish, commit, tag, and push.
 */
export async function release(options: ReleaseOptions): Promise<void> {
  const cwd = process.cwd()

  if (!(await validateGitState(cwd, options))) return

  const packages = await getPackages(cwd)
  if (options.debug) console.log(packages)
  if (!packages.length) {
    console.log(pc.red('No packages found.'))
    process.exit(1)
  }

  const pkgData = (await fs.readJson('package.json')) as PackageJson
  const oldVersion = pkgData.version as string
  console.log(pc.blue(`Selecting new version from ${pc.bold(oldVersion)}`))
  const newVersion = await selectNewVersion(oldVersion)

  console.log(pc.blue('Updating packages version...'))
  applyVersionUpdates(packages, oldVersion, newVersion, options.force ?? false)
  await writePackages(packages)

  console.log(pc.blue('Updating root package.json version...'))
  pkgData.version = newVersion
  await fs.writeJson('package.json', pkgData, { spaces: 2 })

  // Always run pnpm install so the lockfile stays in sync with the bumped
  // versions, even on dry-runs (the working tree is dirty either way).
  console.log(pc.blue('Updating lock file...'))
  await run('pnpm', ['i'])

  console.log(pc.blue('Updating changelog...'))
  await generateChangelog(cwd, newVersion)
  if (!(await confirmChangelog())) process.exit(1)

  await publishPackages(options)
  await commitAndPush(newVersion, options)
  await tagAndPush(newVersion, options)

  console.log(pc.green(`Successfully released v${newVersion}! 🐑️`))
  if (options.dryRun) {
    console.log(
      pc.yellow('Dry run. No packages were published to npm. No commits and tags were pushed.'),
    )
  }
}

/**
 * Verify the repository is in a state where a release is safe.
 *
 * Sets `process.exitCode = 1` and returns false on failure so the caller can
 * gracefully bail out without throwing.
 */
async function validateGitState(cwd: string, options: ReleaseOptions): Promise<boolean> {
  if (await isRepoDirty(cwd)) {
    console.log(pc.red('Git repo isn\'t clean.'))
    process.exitCode = 1
    return false
  }

  if (!options.expectedBranch) {
    console.warn(
      pc.yellow('It\'s recommended to specify an expected branch for the release with the -b argument.'),
    )
    return true
  }

  const currentBranch = await getCurrentBranch(cwd)
  if (currentBranch !== options.expectedBranch) {
    console.log(
      pc.red(
        `You should be on branch "${options.expectedBranch}" but are on "${currentBranch}"`,
      ),
    )
    process.exitCode = 1
    return false
  }

  if (await isBranchOutdated(options.expectedBranch, cwd)) {
    console.log(pc.red('Git branch is not in sync with remote'))
    process.exitCode = 1
    return false
  }

  return true
}

/**
 * Mutate each package's `version` (and `pkg.version`) in place, following the
 * partial/full release rules. Logs each bump and exits if a partial release
 * has no candidate packages to bump.
 */
function applyVersionUpdates(
  packages: Package[],
  oldVersion: string,
  newVersion: string,
  force: boolean,
): void {
  const partial = isPartialRelease(oldVersion, newVersion)
  const toBump = selectPackagesToBump(packages, partial, force)

  if (partial && !toBump.length) {
    console.log(pc.red('No package has changed since last release.'))
    process.exit(1)
  }

  for (const p of toBump) {
    if (p.version === newVersion) continue
    p.version = newVersion
    p.pkg.version = newVersion
    console.log(pc.yellow(`${p.name} => ${newVersion}`))
  }
}

/**
 * Prompt the user to verify the generated changelog before publishing.
 * Returns false if the user declines so the caller can abort.
 */
async function confirmChangelog(): Promise<boolean> {
  const { confirm } = await prompts({
    type: 'confirm',
    name: 'confirm',
    message: 'Check the content of the changelog. Is it correct?',
  })
  if (!confirm) {
    console.log(pc.red('Aborted!'))
    return false
  }
  return true
}
