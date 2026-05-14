import sade from 'sade'
import { release } from './index'
import { createRequire } from 'module'

const program = sade('sheep')

const require = createRequire(import.meta.url)
program.version(require('../package.json').version)

program.command('release')
  .describe('Release the packages with changelog')
  .option('--tag <tag>', 'Specify a dist-tag for publishing')
  // NOTE: sade requires whitespace after the comma between the short and
  // long flag forms. Without it, sade fails to strip the leading `--` from
  // the long form and `opts['expected-branch']` ends up undefined — so
  // `-b main` was silently ignored and the "specify an expected branch"
  // warning still fired. See `src/__tests__/bin-options.test.ts`.
  .option('-b, --expected-branch <branch>', 'Checks the expected branch for the publishing')
  .option('--dry-run', `Dry run (change files but don't publish nor push anything`)
  .option('--force', 'Force publishing even if there are no changes detected')
  .option('--debug', 'Output debug information')
  .action((opts) => release({
    distTag: opts.tag,
    expectedBranch: opts['expected-branch'],
    dryRun: opts['dry-run'],
    force: opts.force,
    debug: opts.debug,
  }))

program.parse(process.argv)
