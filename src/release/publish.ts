import pc from 'picocolors'
import { run } from './run'
import type { ReleaseOptions } from './types'

/**
 * Publish all workspace packages with `pnpm publish -r`.
 * Honours `--dry-run` and `--tag <distTag>`.
 */
export async function publishPackages(options: ReleaseOptions): Promise<void> {
  console.log(pc.blue('Publishing packages...'))
  const args = ['publish', '-r', '--no-git-checks']
  if (options.distTag) args.push('--tag', options.distTag)
  await run('pnpm', args, { dryRun: options.dryRun })
}

/**
 * Create a `vX.Y.Z` commit including all working-tree changes and push it.
 *
 * The previous implementation used `git add . && git commit -m "..."` via a
 * shell; splitting into two execa calls avoids `shell: true` and makes hook
 * failures attributable to the right command.
 */
export async function commitAndPush(newVersion: string, options: ReleaseOptions): Promise<void> {
  console.log(pc.blue('Creating commit...'))
  await run('git', ['add', '.'], { dryRun: options.dryRun })
  await run('git', ['commit', '-m', `v${newVersion}`], { dryRun: options.dryRun })
  await run('git', ['push'], { dryRun: options.dryRun })
}

/**
 * Create a `vX.Y.Z` git tag and push tags to the remote.
 */
export async function tagAndPush(newVersion: string, options: ReleaseOptions): Promise<void> {
  console.log(pc.blue('Creating git tag...'))
  await run('git', ['tag', `v${newVersion}`], { dryRun: options.dryRun })
  await run('git', ['push', '--tags'], { dryRun: options.dryRun })
}
