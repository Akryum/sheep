# gen-changelog

Opinionated CLI command to update CHANGELOG.md.

```bash
yarn add -WD @akryum/gen-changelog
```

Assumed:
- Git repository
- Monorepo
- Uses yarn v1
- Lerna setup
- Tags with `vX.Y.Z` format
- All tags are fetched locally
- `CHANGELOG.md` exists (init it with `yarn conventional-changelog -p angular -o CHANGELOG.md -r 0`)
- You run `lerna publish` before using it

What it does:
- Update the root `package.json` version
- Update the `CHANGELOG.md` file with the latest changes
- Push the changelog change with `chore: changelog` commit message

Usage:

```json
{
  "scripts": {
    "release": "yarn run build && yarn run test && lerna publish && changelog generate"
  }
}
```
