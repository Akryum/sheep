require('esbuild').buildSync({
  entryPoints: [
    './src/index.ts',
    './src/bin.ts',
  ],
  bundle: true,
  platform: 'node',
  outdir: 'dist',
  external: [
    'conventional-changelog*',
  ],
  sourcemap: true,
})
