import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');

/** @type {esbuild.BuildOptions} */
const buildOptions = {
  entryPoints: ['src/preload/preload.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: 'dist/preload/preload.js',
  external: ['electron'],
  sourcemap: true,
  format: 'cjs',
  logLevel: 'warning',
};

async function build() {
  if (isWatch) {
    console.log('👀 Watching preload script for changes...');
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('✓ Preload watch mode started');
  } else {
    await esbuild.build(buildOptions);
    console.log('✓ Preload build complete');
  }
}

build().catch((err) => {
  console.error('Preload build failed:', err);
  process.exit(1);
});
