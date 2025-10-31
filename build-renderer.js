import * as esbuild from 'esbuild';
import { copyFileSync, watch, cpSync, existsSync, mkdirSync } from 'fs';

const isWatch = process.argv.includes('--watch');

const buildConfig = {
  entryPoints: ['src/renderer/app.ts'],
  bundle: true,
  outfile: 'dist/renderer/app.js',
  platform: 'browser',
  format: 'esm',
  target: 'es2020',
  sourcemap: true,
  external: ['electron'], // Don't bundle electron
  loader: {
    '.ts': 'ts'
  }
};

// Function to copy static files
function copyStaticFiles() {
  copyFileSync('src/renderer/index.html', 'dist/renderer/index.html');
  copyFileSync('src/renderer/styles.css', 'dist/renderer/styles.css');

  // Copy CSS modules directory
  if (!existsSync('dist/renderer/css')) {
    mkdirSync('dist/renderer/css', { recursive: true });
  }
  cpSync('src/renderer/css', 'dist/renderer/css', { recursive: true });
}

if (isWatch) {
  // Watch mode - rebuild on changes
  const ctx = await esbuild.context(buildConfig);
  await ctx.watch();
  console.log('👀 Watching renderer files for changes...');

  // Copy initial static files
  copyStaticFiles();

  // Watch for changes to HTML and CSS files
  watch('src/renderer/index.html', () => {
    copyFileSync('src/renderer/index.html', 'dist/renderer/index.html');
    console.log('✓ Copied index.html');
  });

  watch('src/renderer/styles.css', () => {
    copyFileSync('src/renderer/styles.css', 'dist/renderer/styles.css');
    console.log('✓ Copied styles.css');
  });

  // Watch CSS modules directory
  watch('src/renderer/css', { recursive: true }, () => {
    cpSync('src/renderer/css', 'dist/renderer/css', { recursive: true });
    console.log('✓ Copied CSS modules');
  });
} else {
  // One-time build
  await esbuild.build(buildConfig);
  copyStaticFiles();
  console.log('✓ Renderer build complete');
}
