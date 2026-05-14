import { execa } from 'execa'
import fs from 'fs-extra'
import os from 'node:os'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getGitDiff } from '../release/git-diff'

/**
 * Tests for the local {@link getGitDiff} helper.
 *
 * The motivating bug: changelogen's `getGitDiff` uses Node's `execSync` with
 * the default 1 MiB buffer. On a first release (no tags), it falls back to
 * scanning the whole history and crashes with `ENOBUFS` on any non-trivial
 * repository. Our replacement must:
 *   1. Walk the entire history when `from` is `undefined` (no prior tag).
 *   2. Cope with output larger than 1 MiB without crashing.
 *   3. Parse commits into the same shape changelogen expects so the rest of
 *      the changelog pipeline keeps working.
 */
describe('getGitDiff', () => {
  let tmp: string

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'sheep-gitdiff-'))
    await execa('git', ['init', '-q', '-b', 'main'], { cwd: tmp })
    await execa('git', ['config', 'user.email', 'test@example.com'], { cwd: tmp })
    await execa('git', ['config', 'user.name', 'Tester'], { cwd: tmp })
    await execa('git', ['config', 'commit.gpgsign', 'false'], { cwd: tmp })
  })

  afterEach(async () => {
    await fs.remove(tmp)
  })

  /** Commit a tiny change with the given conventional message. */
  async function commit(message: string, file = 'README.md', content = message) {
    await fs.writeFile(path.join(tmp, file), content + '\n')
    await execa('git', ['add', file], { cwd: tmp })
    await execa('git', ['commit', '-q', '-m', message], { cwd: tmp })
  }

  it('returns parsed commits when no `from` ref is supplied (first-release case)', async () => {
    await commit('feat: initial commit')
    await commit('fix: second commit', 'a.txt')

    const commits = await getGitDiff(undefined, 'HEAD', tmp)
    expect(commits).toHaveLength(2)
    // Newest first (git log default order).
    expect(commits[0].message).toBe('fix: second commit')
    expect(commits[1].message).toBe('feat: initial commit')
    expect(commits[0].author.email).toBe('test@example.com')
    expect(commits[0].shortHash).toMatch(/^[0-9a-f]+$/)
  })

  it('limits the range when `from` is supplied', async () => {
    await commit('feat: one')
    await execa('git', ['tag', 'v0.1.0'], { cwd: tmp })
    await commit('feat: two', 'b.txt')
    await commit('fix: three', 'c.txt')

    const commits = await getGitDiff('v0.1.0', 'HEAD', tmp)
    expect(commits.map(c => c.message)).toEqual(['fix: three', 'feat: two'])
  })

  it('handles histories whose log output exceeds the default execSync buffer (1 MiB)', async () => {
    // Build a commit body large enough that ~5 commits push past 1 MiB total
    // log output. changelogen's stock `getGitDiff` would crash with ENOBUFS
    // here; our replacement should sail through.
    const fatBody = 'x'.repeat(300_000)
    const msgFile = path.join(tmp, 'msg.txt')
    for (let i = 0; i < 5; i++) {
      await fs.writeFile(path.join(tmp, `file-${i}.txt`), fatBody)
      // Pass the long body via `-F` so we don't blow ARG_MAX in this test.
      await fs.writeFile(msgFile, `feat: commit ${i}\n\n${fatBody}\n`)
      await execa('git', ['add', `file-${i}.txt`], { cwd: tmp })
      await execa('git', ['commit', '-q', '-F', msgFile], { cwd: tmp })
    }

    const commits = await getGitDiff(undefined, 'HEAD', tmp)
    expect(commits).toHaveLength(5)
    expect(commits[0].message).toBe('feat: commit 4')
  })
})
