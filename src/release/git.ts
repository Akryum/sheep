import { execa } from 'execa'

/**
 * Returns true if the working tree has uncommitted changes.
 */
export async function isRepoDirty(cwd: string = process.cwd()): Promise<boolean> {
  const { stdout } = await execa('git', ['status', '--porcelain'], { cwd })
  return !!stdout
}

/**
 * Returns the name of the currently checked-out branch.
 */
export async function getCurrentBranch(cwd: string = process.cwd()): Promise<string> {
  const { stdout } = await execa('git', ['branch', '--show-current'], { cwd })
  return stdout
}

/**
 * Returns true if the given local branch is behind its remote counterpart on
 * origin (i.e. would be advanced by a `git pull`).
 *
 * Detected by parsing `git remote show origin` for the well-known phrases git
 * uses to describe branches that are fast-forwardable or out of date.
 */
export async function isBranchOutdated(
  branch: string,
  cwd: string = process.cwd(),
): Promise<boolean> {
  const { stdout } = await execa('git', ['remote', 'show', 'origin'], { cwd })
  // Escape the branch name so a `.` or other regex metachar doesn't break the match.
  const escaped = branch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`\\W${escaped}\\W.*(?:fast-forwardable|local out of date)`, 'i')
  return re.test(stdout)
}
