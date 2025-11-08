import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Use happy-dom for DOM testing (lighter than jsdom)
    environment: 'happy-dom',

    // Test file patterns
    include: ['src/**/*.{test,spec}.{js,ts,tsx}'],
    exclude: ['node_modules', 'dist', 'out', 'e2e'],

    // Global test utilities
    globals: true,

    // Setup files
    setupFiles: ['./src/test/setup.ts'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],

      // Include all source files for accurate coverage reporting
      all: true,
      include: [
        'src/**/*.{ts,tsx}',
      ],
      exclude: [
        'node_modules/',
        'dist/',
        'out/',
        'coverage/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/*.test.ts',
        '**/*.spec.ts',
        'src/test/**',
        'src/main/main.ts', // Electron main entry point
        'src/main/preload.ts', // Electron preload script
        'src/renderer/index.tsx', // React entry point
        '**/types/**',
        '**/__tests__/**',
      ],

      // Coverage thresholds - currently at 60% target
      // These will be enforced in CI/CD
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
      },

      // Report uncovered lines
      skipFull: false,
      clean: true,
    },

    // Enable inline snapshots
    resolveSnapshotPath: (testPath, snapExtension) => {
      return testPath + snapExtension;
    },

    // Timeout for tests
    testTimeout: 10000,
    hookTimeout: 10000,

    // Retry failed tests once (helps with flaky tests)
    retry: 1,

    // Run tests in parallel
    maxConcurrency: 5,

    // Reporter configuration
    reporters: ['verbose'],
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@main': path.resolve(__dirname, './src/main'),
      '@renderer': path.resolve(__dirname, './src/renderer'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@test': path.resolve(__dirname, './src/test'),
    },
  },
});
