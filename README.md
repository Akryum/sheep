# 🐑️ sheep

Opinionated CLI command to update CHANGELOG.md and release packages.

```bash
yarn add -WD @akryum/sheep
```

Assumed:
- Git repository
- Monorepo
- Uses yarn v1
- Lerna setup
- Tags with `vX.Y.Z` format
- All tags are fetched locally
- `CHANGELOG.md` exists (init it with `yarn conventional-changelog -p angular -o CHANGELOG.md -r 0`)

What it does:
- Select new version
- Update nested packages versions and workspace dependencies
- Update the root `package.json` version
- Update the `CHANGELOG.md` file with the latest changes
- Publish the packages to npm
- Push the changes with `vX.Y.Z` commit message
- Create and push a `vX.Y.Z` git tag

Usage:

```json
{
  "scripts": {
    "release": "yarn run build && yarn run test && sheep release -b main"
  }
}
```

Recommended compagnon GitHub Action: [Akryum/release-tag](https://github.com/Akryum/release-tag) :ok_hand:
