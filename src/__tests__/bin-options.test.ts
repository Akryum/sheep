import sade from 'sade'
import { describe, expect, it } from 'vitest'

/**
 * Sade's option-string tokenizer requires whitespace after the comma that
 * separates the short and long flag forms. Without it, the leading dashes of
 * the long form are not consumed, so the option key contains literal dashes
 * (e.g. `'--expected-branch'` instead of `'expected-branch'`) and any code
 * reading `opts['expected-branch']` silently sees `undefined`.
 *
 * These tests pin the exact option spec the CLI uses so a future regression
 * (someone deleting the space) is caught immediately.
 */
describe('bin option parsing (sade)', () => {
  /** Parse a single `release -b main` invocation through sade and return the opts. */
  function parseRelease(optionSpec: string): Record<string, unknown> {
    let received: Record<string, unknown> | undefined
    const program = sade('sheep')
    program
      .command('release')
      .option(optionSpec, 'desc')
      .action((opts) => { received = opts as Record<string, unknown> })
    program.parse(['node', 'sheep', 'release', '-b', 'main'])
    if (!received) throw new Error('sade did not invoke the action')
    return received
  }

  it('maps `-b main` to opts["expected-branch"] when the option spec is well-formed', () => {
    const opts = parseRelease('-b, --expected-branch <branch>')
    expect(opts['expected-branch']).toBe('main')
  })

  it('regression: `-b,--expected-branch` (no space) does NOT populate the long-form key', () => {
    // This is what sade does today with a missing space; we keep the test so
    // that anyone tempted to remove the space sees the failure mode it causes.
    const opts = parseRelease('-b,--expected-branch <branch>')
    expect(opts['expected-branch']).toBeUndefined()
    expect(opts['--expected-branch']).toBe('main')
  })
})
