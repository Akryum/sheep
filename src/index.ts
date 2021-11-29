import fs from 'fs-extra'
import { execaCommand } from 'execa'

export async function generateChangelog () {
  // Update root package.json version
  const lernaConfig = await fs.readJson('lerna.json')
  const pkgData = await fs.readJson('package.json')
  pkgData.version = lernaConfig.version
  await fs.writeJson('package.json', pkgData, { spaces: 2 })

  // Generate changelog
  await execaCommand('yarn --silent conventional-changelog -p angular -i CHANGELOG.md -s -r 2')

  // Commit
  await execaCommand('(git add CHANGELOG.md && git add package.json && git commit -m "chore: changelog" && git push || exit 0)')
}
