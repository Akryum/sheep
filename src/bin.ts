import sade from 'sade'
import { release } from './index'
import { createRequire } from 'module'

const program = sade('sheep')

const require = createRequire(import.meta.url)
program.version(require('../package.json').version)

program.command('release')
  .describe('Release the packages with changelog')
  .option('--preset <preset>', 'Conventional changelog preset', 'angular')
  .option('--tag <tag>', 'Specify a dist-tag for publishing')
  .option('-b,--expected-branch <branch>', 'Checks the expected branch for the publishing')
  .option('--dry-run', `Dry run (change files but don't publish nor push anything`)
  .action((opts) => release({
    preset: opts.preset,
    distTag: opts.tag,
    expectedBranch: opts['expected-branch'],
    dryRun: opts['dry-run'],
  }))

program.parse(process.argv)
