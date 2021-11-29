#!/usr/bin/env node
import { Command } from 'commander'
import { generateChangelog } from './index'

const program = new Command()
program.version(require('../package.json').version)

program.command('generate')
  .description('Generate changelog using angular conventional commits')
  .action(generateChangelog)

program.parse()
