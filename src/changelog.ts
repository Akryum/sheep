import { existsSync, promises as fsp } from 'node:fs'
import {
  generateMarkDown,
  getGitDiff,
  loadChangelogConfig,
  parseCommits,
} from 'changelogen'
import path from 'pathe'

/** Regex that matches the first `##` or `###` heading in CHANGELOG.md, i.e. the most recent entry. */
const ENTRY_HEADING_RE = /^###?\s+.*$/m

/** Header used when creating a brand-new CHANGELOG.md. */
const CHANGELOG_HEADER = '# Changelog\n\n'

/**
 * Generate the next CHANGELOG.md section by collecting conventional commits
 * since the last tag and rendering them via changelogen.
 *
 * The new section is inserted just above the most recent existing entry so
 * users can review it before publishing. If no CHANGELOG.md exists, a fresh
 * one with a `# Changelog` header is created.
 *
 * @param cwd        Project root containing CHANGELOG.md.
 * @param newVersion Version string used to render the new section header.
 */
export async function generateChangelog(cwd: string, newVersion: string): Promise<void> {
  const config = await loadChangelogConfig(cwd, { newVersion })
  const output = path.resolve(cwd, 'CHANGELOG.md')

  const rawCommits = await getGitDiff(config.from, config.to)

  // Keep only commits whose type is configured, and drop dependency-bump chores
  // (which aren't user-visible) unless they're flagged as breaking changes.
  const commits = parseCommits(rawCommits, config).filter(
    c =>
      config.types[c.type] &&
      !(c.type === 'chore' && c.scope === 'deps' && !c.isBreaking),
  )

  const markdown = await generateMarkDown(commits, config)

  let changelogMD: string
  if (existsSync(output)) {
    changelogMD = await fsp.readFile(output, 'utf8')
  }
  else {
    changelogMD = CHANGELOG_HEADER
  }

  // Insert the new section immediately above the previous entry, or append
  // it if there is no previous entry to anchor against.
  const lastEntry = changelogMD.match(ENTRY_HEADING_RE)
  if (lastEntry && lastEntry.index !== undefined) {
    changelogMD
      = changelogMD.slice(0, lastEntry.index)
      + markdown
      + '\n\n'
      + changelogMD.slice(lastEntry.index)
  }
  else {
    changelogMD += '\n' + markdown + '\n\n'
  }

  await fsp.writeFile(output, changelogMD)
}
