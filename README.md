# 🐑️ sheep

Opinionated CLI command to update CHANGELOG.md and release packages.

```bash
yarn add -WD @akryum/sheep
```

Assumed:
- Git repository
- Monorepo
- Uses pnpm
- Tags with `vX.Y.Z` format
- All tags are fetched locally
- `CHANGELOG.md` exists (init it with `pnpm exec conventional-changelog -p angular -o CHANGELOG.md -r 0`)

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
    "release": "pnpm run link && pnpm run build && pnpm run test && sheep release -b main"
  }
}
```

Recommended compagnon GitHub Action: [Akryum/release-tag](https://github.com/Akryum/release-tag) :ok_hand:

<p align="center">
  <a href="https://guillaume-chau.info/sponsors/" target="_blank">
    <img src='https://akryum.netlify.app/sponsors.svg'/>
  </a>
</p>
