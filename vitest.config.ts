import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Use happy-dom for DOM testing (lighter than jsdom)
    environment: 'happy-dom',

    // Test file patterns
    include: ['src/**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist', 'out'],

    // Global test utilities
    globals: true,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'out/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/build-*.js',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
      ],
      // Target 60% coverage
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60
      }
    },

    // Enable inline snapshots
    resolveSnapshotPath: (testPath, snapExtension) => {
      return testPath + snapExtension;
    },

    // Timeout for tests
    testTimeout: 10000,
    hookTimeout: 10000,
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@main': path.resolve(__dirname, './src/main'),
      '@renderer': path.resolve(__dirname, './src/renderer'),
      '@shared': path.resolve(__dirname, './src/shared'),
    },
  },
});
