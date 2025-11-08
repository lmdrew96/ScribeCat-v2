# Testing Guide for ScribeCat

This document provides comprehensive information about testing in the ScribeCat project.

## Table of Contents

- [Overview](#overview)
- [Getting Started](#getting-started)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Test Utilities](#test-utilities)
- [Mocks and Fixtures](#mocks-and-fixtures)
- [Coverage](#coverage)
- [Best Practices](#best-practices)
- [CI/CD Integration](#cicd-integration)

## Overview

ScribeCat uses [Vitest](https://vitest.dev/) as its testing framework, chosen for its speed, modern features, and excellent TypeScript support. The testing infrastructure includes:

- **Unit tests** for domain entities, use cases, and services
- **Integration tests** for repositories and external services
- **Component tests** for React UI components (future)
- **E2E tests** for complete user workflows (future)

### Current Test Coverage

**Baseline Metrics (as of testing infrastructure setup):**
- Statements: 88.12%
- Branches: 69.69%
- Functions: 80.7%
- Lines: 88.88%

**Note:** These metrics represent coverage for files with tests (5 files). The overall project has 150+ source files.

**Current Test Files:**
1. `src/domain/entities/Transcription.test.ts` - 22 tests ✅
2. `src/domain/entities/Session.test.ts` - 23 tests ✅
3. `src/application/use-cases/SaveRecordingUseCase.test.ts` - 26 tests ✅
4. `src/application/use-cases/ListSessionsUseCase.test.ts` - 24 tests ✅
5. `src/renderer/services/TranscriptionModeService.test.ts` - 36 tests ✅

**Total:** 131 tests passing

## Getting Started

### Prerequisites

```bash
# Install dependencies
npm install
```

### Quick Start

```bash
# Run all tests
npm test

# Run tests once (CI mode)
npm run test:run

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui
```

## Test Structure

Tests are colocated with source files following this pattern:

```
src/
├── domain/
│   └── entities/
│       ├── Session.ts
│       └── Session.test.ts          # Unit tests for Session entity
├── application/
│   └── use-cases/
│       ├── SaveRecordingUseCase.ts
│       └── SaveRecordingUseCase.test.ts
├── renderer/
│   └── services/
│       ├── TranscriptionModeService.ts
│       └── TranscriptionModeService.test.ts
└── test/
    ├── setup.ts                     # Global test configuration
    ├── mocks/                       # Reusable mocks
    │   ├── repositories.ts
    │   └── services.ts
    └── fixtures/                    # Test data fixtures
        ├── sessions.ts
        ├── courses.ts
        └── audio.ts
```

## Running Tests

### Command Reference

| Command | Description |
|---------|-------------|
| `npm test` | Run tests in watch mode |
| `npm run test:run` | Run all tests once (CI mode) |
| `npm run test:coverage` | Generate coverage report |
| `npm run test:ui` | Open Vitest UI for interactive testing |

### Watch Mode

Watch mode automatically reruns tests when files change:

```bash
npm test

# Run specific test file
npm test src/domain/entities/Session.test.ts

# Run tests matching pattern
npm test Session
```

### Coverage Reports

Coverage reports are generated in the `coverage/` directory:

```bash
npm run test:coverage

# View HTML report
open coverage/index.html
```

## Writing Tests

### Test File Naming

- Unit tests: `*.test.ts` or `*.spec.ts`
- Integration tests: `*.integration.test.ts`
- E2E tests: `*.e2e.test.ts` (in `/e2e` directory)

### Basic Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { YourClass } from './YourClass';

describe('YourClass', () => {
  let instance: YourClass;

  beforeEach(() => {
    // Setup before each test
    instance = new YourClass();
  });

  afterEach(() => {
    // Cleanup after each test
    vi.clearAllMocks();
  });

  describe('methodName', () => {
    it('should do something expected', () => {
      const result = instance.methodName();
      expect(result).toBe(expectedValue);
    });

    it('should handle edge cases', () => {
      expect(() => instance.methodName(invalidInput))
        .toThrow('Expected error message');
    });
  });
});
```

### Testing Patterns

#### Domain Entities

Test business logic, validation, and serialization:

```typescript
import { describe, it, expect } from 'vitest';
import { Session } from './Session';

describe('Session', () => {
  describe('validation', () => {
    it('should throw error for invalid duration', () => {
      expect(() => new Session(/* ... */, -1 /* invalid duration */))
        .toThrow('Duration must be non-negative');
    });
  });

  describe('serialization', () => {
    it('should serialize to JSON correctly', () => {
      const session = new Session(/* ... */);
      const json = session.toJSON();
      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('title');
    });
  });
});
```

#### Use Cases

Test orchestration logic with mocked dependencies:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SaveRecordingUseCase } from './SaveRecordingUseCase';
import { createMockAudioRepository, createMockSessionRepository } from '@test/mocks';

describe('SaveRecordingUseCase', () => {
  let useCase: SaveRecordingUseCase;
  let mockAudioRepo: ReturnType<typeof createMockAudioRepository>;
  let mockSessionRepo: ReturnType<typeof createMockSessionRepository>;

  beforeEach(() => {
    mockAudioRepo = createMockAudioRepository();
    mockSessionRepo = createMockSessionRepository();
    useCase = new SaveRecordingUseCase(mockAudioRepo, mockSessionRepo);
  });

  it('should save audio and create session', async () => {
    const input = { audioData: new ArrayBuffer(1024), duration: 300 };

    await useCase.execute(input);

    expect(mockAudioRepo.saveAudio).toHaveBeenCalled();
    expect(mockSessionRepo.save).toHaveBeenCalled();
  });
});
```

#### Services

Test service coordination and state management:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TranscriptionModeService } from './TranscriptionModeService';
import { createMockAudioManager, createMockTranscriptionManager } from '@test/mocks';

describe('TranscriptionModeService', () => {
  let service: TranscriptionModeService;
  let mockAudioManager: ReturnType<typeof createMockAudioManager>;

  beforeEach(() => {
    mockAudioManager = createMockAudioManager();
    service = new TranscriptionModeService(mockAudioManager);
  });

  it('should start transcription successfully', async () => {
    await service.start({ mode: 'assemblyai', apiKey: 'test-key' });

    expect(service.getCurrentMode()).toBe('assemblyai');
    expect(mockAudioManager.onAudioData).toHaveBeenCalled();
  });
});
```

## Test Utilities

### Global Utilities

Located in `src/test/setup.ts`:

```typescript
import { mockWindowScribeCat, mockAudioContext, mockMediaStream } from '@test/setup';

// Mock Electron IPC API
const mockApi = mockWindowScribeCat();
mockApi.session.list.mockResolvedValue([/* sessions */]);

// Mock Web Audio API
const mockContext = mockAudioContext();

// Mock MediaStream
const stream = mockMediaStream();
```

### Mock Repositories

```typescript
import {
  createMockSessionRepository,
  createMockAudioRepository
} from '@test/mocks';

// Create mock with default behavior
const sessionRepo = createMockSessionRepository();

// Override specific methods
const audioRepo = createMockAudioRepository({
  saveAudio: vi.fn().mockResolvedValue('/custom/path.webm')
});

// Create repository with test data
const { createMockSessionRepositoryWithSessions } = await import('@test/mocks');
const sessions = [/* test sessions */];
const repoWithData = createMockSessionRepositoryWithSessions(sessions);
```

### Mock Services

```typescript
import {
  createMockAudioManager,
  createMockTranscriptionManager,
  createMockClaudeAIService
} from '@test/mocks';

const audioManager = createMockAudioManager({
  getSampleRate: vi.fn().mockReturnValue(16000)
});

const aiService = createMockClaudeAIService({
  generateSummary: vi.fn().mockResolvedValue('Custom summary')
});
```

## Mocks and Fixtures

### Using Fixtures

Fixtures provide consistent test data:

```typescript
import {
  createSampleSession,
  createSampleSessionList,
  createCourseSession,
  createSampleTranscription
} from '@test/fixtures';

// Create single session
const session = createSampleSession({
  title: 'Custom Title',
  duration: 600
});

// Create multiple sessions
const sessions = createSampleSessionList(10); // Creates 10 sessions

// Create session with course info
const courseSession = createCourseSession({
  courseNumber: 'CS 202'
});

// Create audio data
import { createSampleAudioData, createSampleFloat32AudioData } from '@test/fixtures';

const audioBuffer = createSampleAudioData(2048);
const floatData = createSampleFloat32AudioData(1024);
```

### Creating Custom Fixtures

Add new fixtures to `src/test/fixtures/`:

```typescript
// src/test/fixtures/custom.ts
export const createSampleCustomData = (overrides = {}) => ({
  id: 'default-id',
  value: 'default-value',
  ...overrides
});
```

## Coverage

### Coverage Configuration

Coverage is configured in `vitest.config.ts`:

```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html', 'lcov'],
  all: true,  // Include all source files
  include: ['src/**/*.{ts,tsx}'],
  exclude: [
    'node_modules/',
    'src/test/**',
    '**/*.test.ts',
    '**/*.config.*'
  ],
  thresholds: {
    lines: 60,
    functions: 60,
    branches: 60,
    statements: 60
  }
}
```

### Viewing Coverage

```bash
# Generate coverage
npm run test:coverage

# Open HTML report
open coverage/index.html

# View in terminal
npm run test:coverage | grep -A 20 "Coverage report"
```

### Coverage Goals

- **Critical paths:** 90%+ coverage
  - Domain entities
  - Core use cases
  - Authentication/authorization
- **Standard code:** 60%+ coverage
- **UI components:** 70%+ coverage
- **Integration points:** 80%+ coverage

## Best Practices

### 1. Test Isolation

Each test should be independent and not rely on other tests:

```typescript
// ❌ Bad - tests depend on each other
let sharedState;
it('test 1', () => { sharedState = 'value'; });
it('test 2', () => { expect(sharedState).toBe('value'); });

// ✅ Good - each test is isolated
beforeEach(() => {
  sharedState = 'value';
});
it('test 1', () => { /* uses sharedState */ });
it('test 2', () => { /* uses sharedState */ });
```

### 2. Clear Test Names

Use descriptive test names that explain what is being tested:

```typescript
// ❌ Bad
it('works', () => { /* ... */ });

// ✅ Good
it('should throw error when API key is missing', () => { /* ... */ });
```

### 3. Arrange-Act-Assert Pattern

Structure tests with clear sections:

```typescript
it('should calculate total correctly', () => {
  // Arrange
  const items = [{ price: 10 }, { price: 20 }];
  const calculator = new Calculator();

  // Act
  const total = calculator.calculateTotal(items);

  // Assert
  expect(total).toBe(30);
});
```

### 4. Test Edge Cases

Don't just test the happy path:

```typescript
describe('validateEmail', () => {
  it('should accept valid email', () => { /* ... */ });
  it('should reject email without @', () => { /* ... */ });
  it('should reject email without domain', () => { /* ... */ });
  it('should handle empty string', () => { /* ... */ });
  it('should handle null/undefined', () => { /* ... */ });
});
```

### 5. Avoid Testing Implementation Details

Test behavior, not implementation:

```typescript
// ❌ Bad - tests implementation
it('should call internal method', () => {
  const spy = vi.spyOn(service as any, '_internalMethod');
  service.publicMethod();
  expect(spy).toHaveBeenCalled();
});

// ✅ Good - tests behavior
it('should return correct result', () => {
  const result = service.publicMethod();
  expect(result).toBe(expectedValue);
});
```

### 6. Use Fake Timers for Time-Dependent Tests

```typescript
import { vi, beforeEach, afterEach } from 'vitest';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

it('should create timestamp correctly', () => {
  const timestamp = service.getCurrentTimestamp();
  expect(timestamp).toBe('2025-01-15T12:00:00Z');
});
```

### 7. Mock External Dependencies

Always mock external services, APIs, and file system operations:

```typescript
// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient)
}));

// Mock file system
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  unlink: vi.fn()
}));
```

## CI/CD Integration

### GitHub Actions (Future)

Tests will run automatically on:
- Pull requests
- Pushes to `main` branch
- Scheduled nightly builds

Example workflow configuration:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:run
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

### Pre-commit Hooks (Recommended)

Install Husky for pre-commit testing:

```bash
npm install --save-dev husky lint-staged

# Add to package.json
{
  "lint-staged": {
    "*.{ts,tsx}": ["npm run test:run -- --changed"]
  }
}
```

## Troubleshooting

### Common Issues

#### Tests Fail in CI but Pass Locally

- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check for timing issues - use fake timers
- Ensure tests don't depend on file system state

#### Mock Not Working

- Verify mock is defined before import: `vi.mock()` must be at top level
- Check mock path matches exactly: use relative paths for local modules
- Clear mocks between tests: `vi.clearAllMocks()` in `afterEach`

#### Coverage Not Accurate

- Ensure `coverage.all: true` in vitest.config.ts
- Check coverage exclude patterns
- Verify all source files are in `coverage.include`

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Mock Service Worker](https://mswjs.io/) - For API mocking

## Contributing

When adding new features:

1. Write tests first (TDD approach recommended)
2. Ensure all tests pass: `npm run test:run`
3. Check coverage: `npm run test:coverage`
4. Add tests for edge cases
5. Update this documentation if adding new patterns

---

**Last Updated:** 2025-01-15

**Maintainers:** ScribeCat Team
