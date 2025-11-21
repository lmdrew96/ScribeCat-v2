# Claude Code Instructions for ScribeCat v2

## About This Project
ScribeCat v2 is an Electron desktop app for transcription, note-taking, and collaborative studying. Current version: **1.56.2**

**Tech Stack:** Electron 38 + Vite, TypeScript (strict mode), TipTap rich-text editor, Yjs for CRDT collaboration, Supabase backend, AssemblyAI transcription, Claude AI integration

## Core Philosophy

**NO BANDAID FIXES - ONLY SOLUTIONS TO THE ROOT CAUSE!**

If something's broken, fix it properly. Don't patch over symptoms - diagnose and solve the actual problem. Quick hacks create technical debt.

**Examples:**
- BAD: "Let's add a try-catch to hide that error"
- GOOD: "That error means X is misconfigured. Let's fix the config."
- BAD: "Just restart the service when it fails"
- GOOD: "The service is failing because of Y. Let's fix Y."

## Key Features

### Core Features
- **Recording & Transcription** - Real-time audio with AssemblyAI, timestamped segments, polish feature
- **Rich Notes Editor** - TipTap with Markdown, tables, code blocks, images, collaborative editing
- **Study Mode** - Timeline/Grid/List/Board views, filtering, multi-session study sets

### AI Integration (Claude claude-sonnet-4-5-20250929)
- Smart Chat (contextual Q&A)
- Summary, Flashcard, Quiz generators
- Concept mapping, Weak spots analysis
- ELI5, Study plan generators

### Social & Collaboration (Phases 1-5)
- **Friends System** - Requests, mutual friends, user search
- **Presence System** - Online/away/offline status
- **Study Rooms** - Collaborative spaces (2-8 participants)
- **Real-time Chat** - Typing indicators, message history
- **Multiplayer Games** - Quiz Battle, Jeopardy, Bingo, Flashcards

### Cloud Features
- Supabase sync with Row-Level Security
- Google Drive integration
- Canvas LMS course import
- Session sharing with permission levels

### Export Formats
PDF, DOCX, HTML, Plain text

## Project Structure

```
src/
├── domain/              # Pure business logic (Session, User, StudyRoom, GameSession entities)
│   ├── entities/        # Core domain objects
│   ├── repositories/    # Repository interfaces
│   ├── services/        # Domain services
│   └── utils/           # Domain utilities
├── application/         # Use cases (45+ use cases for sessions, auth, sharing, games)
│   ├── use-cases/       # Business logic orchestration
│   └── search/          # Search functionality
├── infrastructure/      # External services (AI, DB, export, auth, sync)
│   ├── services/        # AI, export, auth services
│   ├── repositories/    # Repository implementations
│   └── setup/           # Service initialization
├── main/                # Electron main process
│   ├── main.ts          # App entry point (ScribeCatApp class)
│   ├── ipc/             # IPC handlers
│   └── services/        # Main process services
├── preload/             # Secure context bridge (window.scribeCat API)
├── renderer/            # UI layer
│   ├── app.ts           # Renderer entry point
│   ├── managers/        # UI coordination managers
│   ├── components/      # UI components
│   ├── ai/              # AI tool generators
│   ├── audio/           # Audio handling
│   └── tiptap/          # Editor extensions
├── shared/              # Common types, utilities, logger
└── config/              # Configuration files

supabase/
├── migrations/          # 33+ SQL migrations
└── functions/           # Server-side functions

browser-extension/       # Separate browser extension component
```

## Key Managers (Renderer)

**Core:**
- `RecordingManager` - Recording, transcription, UI coordination
- `AudioManager` - Microphone and audio streams
- `ViewManager` - Main view switching
- `AIManager` - Claude API integration
- `AuthManager` - Authentication state

**Study Mode:**
- `StudyModeManager` - Orchestrates study mode UI
- `StudyModeDetailViewManager` - Session detail views
- `StudyModeAIToolsManager` - AI tool generation
- `SessionDataLoader`, `SessionEditingManager`, `SessionDeletionManager`
- `MultiSessionCoordinator` - Multi-session study sets
- `CloudSyncManager`, `FilterSortManager`, `BulkSelectionManager`

**Social:**
- `FriendsManager` - Friends and presence
- `StudyRoomsManager` - Room management
- `ChatManager` - Real-time chat
- `MultiplayerGamesManager` - Game sessions

## Critical Build Requirements

### ALWAYS Clean Before Building
```bash
npm run clean   # Delete dist/ folder
# OR manually: rm -rf dist/
```
**Why:** Old build files cause mysterious bugs. Start fresh every time.

### ALWAYS Update Version Before Commits
Update `version` in package.json using semantic versioning:
- **Patch** (1.56.2 → 1.56.3): Bug fixes
- **Minor** (1.56.2 → 1.57.0): New features
- **Major** (1.56.2 → 2.0.0): Breaking changes

**Commit format:** `"v1.56.3: Brief description of change"`

## Build Process

```bash
npm run dev              # Development with hot reload
npm run compile          # Compile TypeScript
npm run build            # Full production build
npm run build:mac/win/linux  # Platform-specific builds
npm run clean            # Delete dist/
```

**Build outputs:** `dist/main/`, `dist/preload/`, `dist/renderer/`

## IPC Channels (Key Categories)

**Recording:** `recording:start/stop/pause/resume/getStatus`
**Transcription:** `transcription:assemblyai:*`
**AI:** `ai:chat`, `ai:chatStream`, `ai:polishTranscription`, `ai:generate*`
**Sessions:** `sessions:list/delete/update`, `session:export/create*`
**Auth:** `auth:signIn*/signUp*/signOut/getCurrentUser`
**Cloud:** `sync:upload*/get*/retry*`, `drive:*`
**Sharing:** `share:create/remove/update*`, `share:getShared*`
**Friends:** `friends:get*/send*/accept*/search*`, `friends:*Presence`
**Rooms:** `rooms:create/join/leave/update*`
**Chat:** `chat:send*/get*/subscribe*`
**Games:** `games:create*/start/complete`, `games:*question*`, `games:*score*`

## Communication Style (CRITICAL)

**Lanae has ADHD - your communication style matters:**

**DO:**
- Lead with THE action to take (singular, not options)
- Break big tasks into small, concrete steps
- Explain WHY after WHAT
- Use simple language
- Provide code examples
- Pivot quickly if something's not working

**DON'T:**
- Give 3+ options (causes decision paralysis)
- Use vague suggestions
- Dump 10 tasks at once
- Suggest bandaid fixes

**When offering choices:**
1. Max 2-3 options with concise pros/cons
2. **RECOMMEND one specific option with reasoning**

## Testing

```bash
npm run test              # Watch mode
npm run test:run          # Run once
npm run test:coverage     # Check coverage (target: >80%)
npm run test:ui           # Visual UI
```

**Stack:** Vitest + @testing-library

## Code Standards

**Rules:**
- TypeScript strict mode - avoid `any`
- Files under 500 lines
- Single responsibility functions
- JSDoc comments on public APIs
- Repository pattern for data access

**When making changes:**
1. Check existing patterns first
2. Ask: "Am I fixing root cause or patching symptoms?"
3. Test locally before committing
4. Clean build (`npm run clean`) before final testing
5. Update version in package.json

## Security

- **NEVER expose API keys in code or logs**
- Store credentials in OS credential manager
- Validate all user input
- All API calls over HTTPS
- User data stays local by default

## Database

**Supabase (Cloud):**
- PostgreSQL with Row-Level Security
- Tables: sessions, transcriptions, users, friends, study_rooms, room_participants, chat_messages, game_sessions, game_questions, player_scores, shares, yjs_state, presence
- Realtime subscriptions for live updates

**Local:**
- electron-store for settings
- Audio files in user data directory

## Workflow Summary

1. **Starting work:** Check issues or ask what to work on
2. **Before building:** `npm run clean`
3. **After changes:** Test locally
4. **Before committing:** Update version, include in commit message
5. **Commit format:** `"v1.x.x: Brief description"`

## Recent Version History

- **v1.56.x:** Re-transcription fixes for cloud sessions
- **v1.55.x:** Phase 4 multiplayer games bug fixes
- **v1.54.x:** Phase 4 Multiplayer Games (Quiz Battle, Jeopardy, Bingo, Flashcards)
- **v1.51-52.x:** Phase 5 User Presence System
- **v1.50.x:** Social features polish (chat, typing indicators)

## Remember

You're helping a busy student juggling school and development. Be supportive, clear, and actionable. Small wins matter. Fix things properly the first time!
