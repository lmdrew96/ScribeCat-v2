import * as esbuild from 'esbuild';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const isWatch = process.argv.includes('--watch');

const buildConfig = {
  entryPoints: ['src/main/main.ts'],
  bundle: true,
  outfile: 'dist/main/main.js',
  platform: 'node',
  format: 'esm',
  target: 'node20',
  sourcemap: true,
  external: [
    'electron',
    'electron-store',
    'dotenv',
    'ws',
    'music-metadata',
    'docx',
    'pdfkit',
    '@supabase/supabase-js',
    '@anthropic-ai/sdk',
    'googleapis',
    'stream',
    'fs',
    'path',
    'crypto',
    'http',
    'https',
    'net',
    'tls',
    'zlib',
    'os',
    'util',
    'events',
    'buffer',
    'child_process'
  ],
  loader: {
    '.ts': 'ts'
  },
  define: {
    // Inject environment variables at build time
    'process.env.ASSEMBLYAI_API_KEY': JSON.stringify(process.env.ASSEMBLYAI_API_KEY || ''),
    'process.env.CLAUDE_API_KEY': JSON.stringify(process.env.CLAUDE_API_KEY || ''),
  }
};

if (isWatch) {
  // Watch mode - rebuild on changes
  const ctx = await esbuild.context(buildConfig);
  await ctx.watch();
  console.log('👀 Watching main process files for changes...');
} else {
  // One-time build
  await esbuild.build(buildConfig);
  console.log('✓ Main process build complete');
}
