import { spawn } from 'child_process';

const isWatch = process.argv.includes('--watch');

if (isWatch) {
  // Watch mode - compile on changes
  console.log('👀 Watching main process files for changes...');
  const tsc = spawn('npx', ['tsc', '--watch', '--preserveWatchOutput'], {
    stdio: 'inherit',
    shell: true
  });

  tsc.on('error', (err) => {
    console.error('Failed to start TypeScript compiler:', err);
    process.exit(1);
  });
} else {
  // One-time build
  const tsc = spawn('npx', ['tsc'], {
    stdio: 'inherit',
    shell: true
  });

  tsc.on('close', (code) => {
    if (code !== 0) {
      console.error(`TypeScript compilation failed with code ${code}`);
      process.exit(code);
    }
    console.log('✓ Main process build complete');
  });
}
