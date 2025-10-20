# Clean Architecture for Audio File Saving

## Overview

Audio file saving now follows Clean Architecture principles with proper separation of concerns across layers.

## Architecture Layers

```
src/
├── domain/              # Business entities and interfaces (no external dependencies)
│   ├── entities/
│   │   └── Session.ts   # Session entity with business logic
│   └── repositories/
│       ├── IAudioRepository.ts      # Audio storage interface
│       └── ISessionRepository.ts    # Session storage interface
│
├── application/         # Use cases (business logic orchestration)
│   └── use-cases/
│       ├── SaveRecordingUseCase.ts         # Saves audio + creates session
│       ├── LoadSessionUseCase.ts           # Loads session data
│       └── UpdateSessionNotesUseCase.ts    # Updates session notes
│
├── infrastructure/      # External services and I/O (file system implementation)
│   └── repositories/
│       ├── FileAudioRepository.ts    # Audio file storage (implements IAudioRepository)
│       └── FileSessionRepository.ts  # Session JSON storage (implements ISessionRepository)
│
└── main/                # Presentation layer (IPC handlers)
    └── recording-manager.ts  # Thin IPC layer, delegates to use cases
```

## Where Audio Files Are Saved

### Infrastructure Layer (File I/O)
**Location:** `src/infrastructure/repositories/FileAudioRepository.ts`

This is where the **actual file saving happens**:
- Saves audio files to: `{userData}/recordings/recording-{timestamp}.webm`
- Uses Node.js `fs/promises` for async file operations
- Handles directory creation and error handling

### Application Layer (Business Logic)
**Location:** `src/application/use-cases/SaveRecordingUseCase.ts`

Orchestrates the saving process:
- Generates unique filenames
- Calls `audioRepository.saveAudio()`
- Creates Session entity
- Calls `sessionRepository.save()` to persist metadata

### Presentation Layer (IPC)
**Location:** `src/main/recording-manager.ts`

Handles IPC communication:
- Receives audio data from renderer process
- Calls `saveRecordingUseCase.execute()`
- Returns session ID and file path to renderer

## Data Flow

```
Renderer Process (UI)
    ↓ [IPC: recording:stop with audioData]
RecordingManager (Presentation)
    ↓ [Calls use case]
SaveRecordingUseCase (Application)
    ↓ [Saves audio]
FileAudioRepository (Infrastructure) → Writes to disk
    ↓ [Creates session]
FileSessionRepository (Infrastructure) → Writes JSON to disk
    ↑ [Returns result]
RecordingManager
    ↑ [IPC response]
Renderer Process
```

## Key Benefits

1. **Separation of Concerns**: File I/O is isolated in infrastructure layer
2. **Testability**: Can mock repositories for testing use cases
3. **Flexibility**: Easy to swap file system for cloud storage
4. **Clean Dependencies**: Domain has no dependencies on external libraries
5. **Single Responsibility**: Each class has one clear purpose

## File Storage Locations

- **Audio files:** `{userData}/recordings/*.webm`
- **Session metadata:** `{userData}/sessions/*.json`

Where `{userData}` is the Electron user data directory:
- macOS: `~/Library/Application Support/ScribeCat`
- Windows: `%APPDATA%/ScribeCat`
- Linux: `~/.config/ScribeCat`

## Example Usage

```typescript
// In RecordingManager constructor:
const audioRepo = new FileAudioRepository();
const sessionRepo = new FileSessionRepository();
const saveUseCase = new SaveRecordingUseCase(audioRepo, sessionRepo);

// When recording stops:
const result = await saveUseCase.execute({
  audioData: audioBuffer,
  duration: 120 // seconds
});
// Returns: { sessionId, filePath }
```

## Adding New Storage Backends

To add a new storage backend (e.g., cloud storage):

1. Create new repository classes implementing the interfaces:
   ```typescript
   class CloudAudioRepository implements IAudioRepository { ... }
   class CloudSessionRepository implements ISessionRepository { ... }
   ```

2. Update RecordingManager to use new repositories:
   ```typescript
   const audioRepo = new CloudAudioRepository();
   const sessionRepo = new CloudSessionRepository();
   ```

3. Use cases remain unchanged - they work with interfaces, not implementations
