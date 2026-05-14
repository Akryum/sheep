import { execa } from 'execa'

/**
 * Parsed shape of a single git commit, matching changelogen's `RawGitCommit`.
 *
 * Keeping the field names identical means the existing pipeline
 * (`parseCommits` → `generateMarkDown` from changelogen) keeps working
 * unchanged.
 */
export interface RawGitCommit {
  /** First line of the commit message (subject). */
  message: string
  /** Abbreviated git hash. */
  shortHash: string
  /** Commit author. */
  author: { name: string, email: string }
  /** Full commit body (everything after the subject), including file list. */
  body: string
}

/** Separator used to split `git log` entries when rendered with our custom `--pretty` format. */
const COMMIT_SEPARATOR = '----'

/**
 * Drop-in replacement for changelogen's `getGitDiff`.
 *
 * Why this exists: changelogen calls `git log` through Node's `execSync`
 * without overriding `maxBuffer`, so it crashes with `ENOBUFS` whenever the
 * log output exceeds the default 1 MiB. That happens on the very first
 * release (no tags → walks the entire history) as well as on long-lived
 * branches with many commits. We use `execa` instead — its default
 * `maxBuffer` is 100 MiB, and we raise it further as a safety net.
 *
 * @param from Starting ref (exclusive). `undefined`/empty means "from the
 *             beginning of history", which is what we want on a first release.
 * @param to   Ending ref (inclusive). Defaults to `HEAD`.
 * @param cwd  Working directory for the git command. Defaults to the process cwd.
 */
export async function getGitDiff(
  from: string | undefined,
  to: string = 'HEAD',
  cwd: string = process.cwd(),
): Promise<RawGitCommit[]> {
  // `from...to` walks the symmetric difference between two refs, mirroring
  // changelogen's original behaviour. Omitting `from` makes `git log` walk
  // the entire history reachable from `to`, which is exactly what we need
  // for the first release.
  const range = from ? `${from}...${to}` : to

  const { stdout } = await execa(
    'git',
    [
      '--no-pager',
      'log',
      range,
      `--pretty=${COMMIT_SEPARATOR}%n%s|%h|%an|%ae%n%b`,
      '--name-status',
    ],
    {
      cwd,
      // 1 GiB ceiling so even pathological histories don't reproduce the
      // original ENOBUFS bug. We're already streaming via execa so this is
      // just an upper safety bound, not a typical allocation.
      maxBuffer: 1024 * 1024 * 1024,
    },
  )

  return stdout
    .split(`${COMMIT_SEPARATOR}\n`)
    // First slice is empty (git's output starts with the separator).
    .slice(1)
    .map((entry) => {
      const [firstLine, ...rest] = entry.split('\n')
      const [message, shortHash, authorName, authorEmail] = firstLine.split('|')
      return {
        message,
        shortHash,
        author: { name: authorName, email: authorEmail },
        body: rest.join('\n'),
      } satisfies RawGitCommit
    })
}
