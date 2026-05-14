import { afterEach, describe, expect, it, vi } from 'vitest'
import { run } from '../release/run'

describe('run', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs the command in dry-run mode and skips execution', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const result = await run('git', ['push', '--tags'], { dryRun: true })
    expect(result).toBeUndefined()
    expect(log).toHaveBeenCalledTimes(1)
    const message = log.mock.calls[0].join(' ')
    expect(message).toContain('git')
    expect(message).toContain('push')
    expect(message).toContain('--tags')
  })

  it('forwards the exact arguments to the dry-run log (no flag rewriting)', async () => {
    // Regression guard: previously the dry-run path printed --dist-tag while
    // the real publish used --tag. The helper must print whatever it would run.
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await run('pnpm', ['publish', '-r', '--no-git-checks', '--tag', 'beta'], { dryRun: true })
    const message = log.mock.calls[0].join(' ')
    expect(message).toContain('--tag beta')
    expect(message).not.toContain('--dist-tag')
  })

  it('executes the command and returns the result when not in dry-run', async () => {
    const result = await run('node', ['-e', 'process.stdout.write("ok")'], { stdio: 'pipe' })
    expect(result?.stdout).toBe('ok')
  })
})
