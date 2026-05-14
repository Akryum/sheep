import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import resolve from '@rollup/plugin-node-resolve'
import dts from 'rollup-plugin-dts'
import esbuild from 'rollup-plugin-esbuild'

// `with { type: 'json' }` is the standard import-attribute syntax (replaces
// the deprecated `assert { type: 'json' }`). Supported by Node 20+ and TS 5.3+.
import pkg from './package.json' with { type: 'json' }

const entries = [
  'src/index.ts',
  'src/bin.ts',
]

const dtsEntries = [
  'src/index.ts',
]

// Anything declared as a runtime dependency is treated as external so it
// isn't bundled into the output. Everything else (currently all CLI deps,
// which live in devDependencies) is bundled.
const external = [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
]

const plugins = [
  resolve({ preferBuiltins: true }),
  json(),
  commonjs(),
  esbuild({ target: 'node20' }),
]

export default () => [
  {
    input: entries,
    output: {
      dir: 'dist',
      format: 'esm',
      sourcemap: 'inline',
    },
    external,
    plugins,
    onwarn(warning) {
      // Rollup passes a RollupLog object whose string coercion is `[object
      // Object]`; the readable text lives on `.message`. Silence the noisy
      // circular-dep warnings coming from third-party deps we don't control.
      if (warning.code === 'CIRCULAR_DEPENDENCY') return
      console.error(warning.message ?? warning)
    },
  },
  ...dtsEntries.map(input => ({
    input,
    output: {
      file: input.replace('src/', 'dist/').replace('.ts', '.d.ts'),
      format: 'esm',
    },
    external,
    plugins: [dts({ respectExternal: true })],
  })),
]
