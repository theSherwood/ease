const esbuild = require('esbuild');

const watch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const config = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  outdir: 'dist',
  format: 'esm',
  sourcemap: true,
  platform: 'browser',
  target: ['chrome80', 'firefox80', 'safari13'],
};

async function onWatch() {
  const context = await esbuild.context(config);
  await context.watch();
  console.log('Watching for changes...');
}

if (watch) {
  onWatch().catch(() => process.exit(1));
} else {
  esbuild.build(config).catch(() => process.exit(1));
}
