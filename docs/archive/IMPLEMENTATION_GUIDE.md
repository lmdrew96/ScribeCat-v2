# Implementation Guide - Refactored Code

## Quick Start

### Using the Refactored StudyModeManager

The StudyModeManager has been split into 5 focused classes for better maintainability:

```typescript
// File structure:
src/renderer/managers/
  ├── StudyModeManager.refactored.ts (coordinator)
  └── study-mode/
      ├── StudyModeSessionListManager.ts
      ├── StudyModeDetailViewManager.ts
      ├── StudyModeNotesEditorManager.ts
      └── StudyModeAIToolsManager.ts
```

**To integrate:**

1. Update [app.ts](src/renderer/app.ts):
```typescript
// Change this import:
import { StudyModeManager } from './managers/StudyModeManager.js';

// To this:
import { StudyModeManager } from './managers/StudyModeManager.refactored.js';
```

2. Test thoroughly (see testing checklist in [REFACTORING_SUMMARY.md](REFACTORING_SUMMARY.md))

3. Once verified working, rename the file:
```bash
rm src/renderer/managers/StudyModeManager.ts
mv src/renderer/managers/StudyModeManager.refactored.ts src/renderer/managers/StudyModeManager.ts
```

### Using the EventBus

The new EventBus provides a centralized event system for decoupling components.

**Basic Usage:**

```typescript
import { eventBus, AppEvents } from '../shared/EventBus.js';

// Subscribe to an event
const unsubscribe = eventBus.on(AppEvents.RECORDING_STARTED, (data) => {
  console.log('Recording started with device:', data.deviceId);
});

// Emit an event
eventBus.emit(AppEvents.RECORDING_STARTED, {
  deviceId: '123',
  mode: 'simulation'
});

// Unsubscribe when component is destroyed
unsubscribe();
```

**One-time handlers:**

```typescript
// Listen only once
eventBus.once(AppEvents.SESSION_CREATED, (session) => {
  console.log('First session created:', session.id);
});
```

**Available Events:**

```typescript
enum AppEvents {
  // Recording
  RECORDING_STARTED = 'recording:started',
  RECORDING_STOPPED = 'recording:stopped',
  RECORDING_PAUSED = 'recording:paused',
  RECORDING_RESUMED = 'recording:resumed',

  // Transcription
  TRANSCRIPTION_SEGMENT = 'transcription:segment',
  TRANSCRIPTION_COMPLETE = 'transcription:complete',
  TRANSCRIPTION_ERROR = 'transcription:error',

  // Session
  SESSION_CREATED = 'session:created',
  SESSION_UPDATED = 'session:updated',
  SESSION_DELETED = 'session:deleted',

  // UI
  UI_THEME_CHANGED = 'ui:theme_changed',
  UI_MODE_CHANGED = 'ui:mode_changed',

  // Audio
  AUDIO_LEVEL_UPDATE = 'audio:level_update',
  AUDIO_DEVICE_CHANGED = 'audio:device_changed',

  // Notes
  NOTES_SAVED = 'notes:saved',
  NOTES_AUTO_SAVED = 'notes:auto_saved',
}
```

### Using the Logger

Replace all `console.log` calls with the structured Logger:

**Before:**
```typescript
console.log('Recording started');
console.error('Failed to start recording:', error);
```

**After:**
```typescript
import { createLogger } from '../shared/logger.js';

const logger = createLogger('RecordingManager');

logger.info('Recording started');
logger.error('Failed to start recording', error);
```

**Log Levels:**

```typescript
logger.debug('Detailed debug info', { data });  // Only in DEBUG mode
logger.info('General information');              // Default level
logger.warn('Warning message');                  // Important warnings
logger.error('Error message', error);            // Errors
logger.exception('Fatal error', error);          // Errors with stack trace
```

**Setting Log Level:**

```typescript
import { Logger, LogLevel } from '../shared/logger.js';

// Set global log level
Logger.setLogLevel(LogLevel.DEBUG); // Show all logs
Logger.setLogLevel(LogLevel.INFO);  // Default
Logger.setLogLevel(LogLevel.WARN);  // Only warnings and errors
Logger.setLogLevel(LogLevel.ERROR); // Only errors
Logger.setLogLevel(LogLevel.NONE);  // Silent
```

## Migration Examples

### Example 1: Migrating RecordingManager to EventBus

**Before:**
```typescript
class RecordingManager {
  constructor(
    private viewManager: ViewManager,
    private transcriptionManager: TranscriptionManager,
    // ... 5 more dependencies
  ) {}

  async start(): Promise<void> {
    // Direct coupling
    this.viewManager.updateRecordingState(true);
    this.transcriptionManager.startRecording();
  }
}
```

**After:**
```typescript
import { eventBus, AppEvents } from '../shared/EventBus.js';

class RecordingManager {
  constructor() {
    // No UI dependencies!
  }

  async start(deviceId: string): Promise<void> {
    // Emit events instead of direct calls
    eventBus.emit(AppEvents.RECORDING_STARTED, {
      deviceId,
      timestamp: Date.now()
    });
  }
}

// In ViewManager
class ViewManager {
  constructor() {
    // Subscribe to events
    eventBus.on(AppEvents.RECORDING_STARTED, (data) => {
      this.updateRecordingState(true);
    });
  }
}
```

### Example 2: Replacing console.log

**Before:**
```typescript
async loadSessions(): Promise<void> {
  console.log('Loading sessions...');
  try {
    const sessions = await this.fetchSessions();
    console.log('Loaded', sessions.length, 'sessions');
  } catch (error) {
    console.error('Failed to load sessions:', error);
  }
}
```

**After:**
```typescript
import { createLogger } from '../shared/logger.js';

const logger = createLogger('SessionManager');

async loadSessions(): Promise<void> {
  logger.info('Loading sessions...');
  try {
    const sessions = await this.fetchSessions();
    logger.info(`Loaded ${sessions.length} sessions`);
  } catch (error) {
    logger.error('Failed to load sessions', error);
  }
}
```

### Example 3: Standardized Error Handling

**Before:**
```typescript
async deleteSession(id: string): Promise<void> {
  try {
    await window.scribeCat.session.delete(id);
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}
```

**After:**
```typescript
import { createLogger } from '../shared/logger.js';

const logger = createLogger('SessionManager');

interface Result<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

async deleteSession(id: string): Promise<Result> {
  try {
    await window.scribeCat.session.delete(id);
    logger.info(`Session deleted: ${id}`);
    return { success: true };
  } catch (error) {
    logger.error('Failed to delete session', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
```

## Architecture Patterns

### 1. Event-Driven Architecture

**Principle:** Components communicate through events, not direct method calls.

**Benefits:**
- Loose coupling
- Easy to add new features
- Better testability
- Clear data flow

**Example:**
```typescript
// Publisher (doesn't know about subscribers)
eventBus.emit(AppEvents.TRANSCRIPTION_SEGMENT, {
  text: 'Hello world',
  timestamp: 1234567890
});

// Subscriber 1: Update UI
eventBus.on(AppEvents.TRANSCRIPTION_SEGMENT, (data) => {
  this.transcriptionManager.addEntry(data.timestamp, data.text);
});

// Subscriber 2: Save to storage
eventBus.on(AppEvents.TRANSCRIPTION_SEGMENT, (data) => {
  this.storageManager.saveSegment(data);
});

// Subscriber 3: Update stats
eventBus.on(AppEvents.TRANSCRIPTION_SEGMENT, (data) => {
  this.statsManager.incrementWordCount(data.text.split(' ').length);
});
```

### 2. Separation of Concerns

**Principle:** Each class has a single, well-defined responsibility.

**Example (StudyModeManager):**
- `StudyModeSessionListManager` - ONLY handles session list UI
- `StudyModeDetailViewManager` - ONLY handles detail view UI
- `StudyModeNotesEditorManager` - ONLY handles notes editing
- `StudyModeAIToolsManager` - ONLY handles AI tools
- `StudyModeManager` - Coordinates the above

### 3. Dependency Injection

**Principle:** Pass dependencies through constructor, not create them internally.

**Before:**
```typescript
class StudyModeManager {
  constructor() {
    this.aiClient = new AIClient(); // Tight coupling
  }
}
```

**After:**
```typescript
class StudyModeManager {
  constructor(
    private aiClient: AIClient  // Injected dependency
  ) {}
}
```

## Common Patterns

### Pattern 1: Creating a new Manager

```typescript
import { createLogger } from '../../shared/logger.js';

const logger = createLogger('MyManager');

export class MyManager {
  constructor(/* dependencies */) {
    logger.info('MyManager initialized');
  }

  async operation(): Promise<void> {
    try {
      logger.debug('Starting operation');
      // logic
      logger.info('Operation completed');
    } catch (error) {
      logger.error('Operation failed', error);
      throw error;
    }
  }
}
```

### Pattern 2: Using Events for Communication

```typescript
import { eventBus, AppEvents } from '../../shared/EventBus.js';

export class MyManager {
  constructor() {
    // Subscribe to events
    eventBus.on(AppEvents.RECORDING_STARTED, this.handleRecordingStart.bind(this));
  }

  private handleRecordingStart(data: any): void {
    // Handle event
  }

  public startSomething(): void {
    // Emit event
    eventBus.emit(AppEvents.CUSTOM_EVENT, { data: 'value' });
  }

  destroy(): void {
    // Clean up (optional, EventBus has built-in unsubscribe)
    eventBus.clear('myEvent');
  }
}
```

### Pattern 3: Result Type for Error Handling

```typescript
interface Result<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

async operation(): Promise<Result<Session>> {
  try {
    const session = await this.fetchSession();
    return { success: true, data: session };
  } catch (error) {
    logger.error('Operation failed', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Usage
const result = await manager.operation();
if (result.success) {
  console.log('Data:', result.data);
} else {
  console.error('Error:', result.error);
}
```

## Testing

### Unit Testing with EventBus

```typescript
import { eventBus, AppEvents } from '../shared/EventBus.js';

describe('RecordingManager', () => {
  it('should emit event when recording starts', (done) => {
    // Subscribe to event
    eventBus.once(AppEvents.RECORDING_STARTED, (data) => {
      expect(data.deviceId).toBe('test-device');
      done();
    });

    // Trigger action
    manager.start('test-device');
  });
});
```

### Testing with Logger

```typescript
import { Logger, LogLevel } from '../shared/logger.js';

describe('MyManager', () => {
  beforeEach(() => {
    // Silence logs during tests
    Logger.setLogLevel(LogLevel.NONE);
  });

  afterEach(() => {
    // Restore log level
    Logger.setLogLevel(LogLevel.INFO);
  });
});
```

## Troubleshooting

### Issue: Events not firing

**Check:**
1. Event name is correct (use `AppEvents` enum)
2. Event is emitted before subscription
3. Handler is not being unsubscribed early

```typescript
// Debug events
console.log('Registered events:', eventBus.getEvents());
console.log('Handler count:', eventBus.getHandlerCount(AppEvents.RECORDING_STARTED));
```

### Issue: Logger not showing logs

**Check:**
1. Log level is set correctly
2. Using correct log method (debug won't show if level is INFO)

```typescript
import { Logger, LogLevel } from '../shared/logger.js';

// Show all logs
Logger.setLogLevel(LogLevel.DEBUG);
```

### Issue: Memory leaks

**Solution:** Always unsubscribe when component is destroyed

```typescript
export class MyComponent {
  private unsubscribers: Array<() => void> = [];

  constructor() {
    this.unsubscribers.push(
      eventBus.on(AppEvents.SOME_EVENT, this.handler.bind(this))
    );
  }

  destroy(): void {
    // Unsubscribe all
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
  }
}
```

## Next Steps

1. ✅ Integrate refactored StudyModeManager
2. ⏳ Complete TiptapEditorManager split
3. ⏳ Complete settings.ts split
4. ⏳ Migrate RecordingManager to EventBus
5. ⏳ Replace all console.log calls
6. ⏳ Standardize error handling
7. ⏳ Centralize service initialization

See [REFACTORING_SUMMARY.md](REFACTORING_SUMMARY.md) for detailed progress and estimates.
