import { spawn } from 'child_process';

const isWatch = process.argv.includes('--watch');

if (isWatch) {
  // Watch mode - compile on changes
  console.log('👀 Watching preload script for changes...');
  const tsc = spawn('npx', ['tsc', '-p', 'tsconfig.preload.json', '--watch', '--preserveWatchOutput'], {
    stdio: 'inherit',
    shell: true
  });

  tsc.on('error', (err) => {
    console.error('Failed to start TypeScript compiler for preload:', err);
    process.exit(1);
  });
} else {
  // One-time build
  const tsc = spawn('npx', ['tsc', '-p', 'tsconfig.preload.json'], {
    stdio: 'inherit',
    shell: true
  });

  tsc.on('close', (code) => {
    if (code !== 0) {
      console.error(`Preload TypeScript compilation failed with code ${code}`);
      process.exit(code);
    }
    console.log('✓ Preload build complete');
  });
}
