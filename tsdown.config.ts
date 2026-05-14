import { defineConfig } from 'tsdown'

// `with { type: 'json' }` is the standard import-attribute syntax (Node 20+,
// TS 5.3+). Used here so we can read declared runtime dependencies and keep
// them external from the bundle.
import pkg from './package.json' with { type: 'json' }

// Anything declared as a runtime dependency stays external (never bundled);
// everything else (all CLI deps, currently in devDependencies) gets bundled.
// The list is empty today — the destructuring keeps "add a runtime dep later"
// a one-line change.
const neverBundle = [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
]

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    bin: 'src/bin.ts',
  },
  format: 'esm',
  outDir: 'dist',
  target: 'node20',
  sourcemap: 'inline',
  clean: true,
  // Emit .js / .d.ts (instead of the default .mjs / .d.mts) so the existing
  // package.json `exports` and the root `bin.js` wrapper keep working
  // without changes. Safe because the package is `"type": "module"`.
  fixedExtension: false,
  deps: { neverBundle },
  // Library entry gets a .d.ts; the CLI entry does not need one.
  dts: { entry: 'src/index.ts' },
})
