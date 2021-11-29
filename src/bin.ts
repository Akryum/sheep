#!/usr/bin/env node
import { Command } from 'commander'
import { release } from './index'

const program = new Command()
program.version(require('../package.json').version)

program.command('release')
  .description('Release the packages with changelog')
  .option('--preset <preset>', 'Conventional changelog preset', 'angular')
  .option('--dist-tag <tag>', 'Specify a dist-tag for publishing')
  .option('-b,--expected-branch <branch>', 'Checks the expected branch for the publishing')
  .option('--dry-run', `Dry run (change files but don't publish nor push anything`)
  .action(release)

program.parse()
