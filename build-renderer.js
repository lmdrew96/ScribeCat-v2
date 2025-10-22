import * as esbuild from 'esbuild';
import { copyFileSync } from 'fs';

// Build renderer TypeScript with bundling
await esbuild.build({
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
});

// Copy HTML and CSS (they don't need bundling)
copyFileSync('src/renderer/index.html', 'dist/renderer/index.html');
copyFileSync('src/renderer/styles.css', 'dist/renderer/styles.css');

console.log('✓ Renderer build complete');
