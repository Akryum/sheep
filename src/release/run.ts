import { execa, type ExecaReturnValue } from 'execa'
import pc from 'picocolors'

/**
 * Options for {@link run}.
 */
export interface RunOptions {
  /** If true, print the command but don't execute it. */
  dryRun?: boolean
  /** stdio handling passed through to execa. Defaults to `'inherit'`. */
  stdio?: 'inherit' | 'pipe'
  /** Working directory for the spawned process. Defaults to `process.cwd()`. */
  cwd?: string
}

/**
 * Run a child process, honouring a `dryRun` flag.
 *
 * In dry-run mode the command is printed in a recognisable format and the
 * function resolves to `undefined` without spawning a process. Otherwise
 * `execa` is invoked with the given stdio. Centralising this here ensures the
 * dry-run output cannot drift from what would actually be executed (the
 * previous code maintained two separate command lists and they had already
 * diverged).
 */
export async function run(
  cmd: string,
  args: string[],
  options: RunOptions = {},
): Promise<ExecaReturnValue | undefined> {
  if (options.dryRun) {
    console.log(pc.gray('(Dry run) Will execute:'), cmd, ...args)
    return undefined
  }

  return execa(cmd, args, {
    stdio: options.stdio ?? 'inherit',
    cwd: options.cwd,
  })
}
