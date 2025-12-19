# GitHub Copilot Instructions for ScribeCat v2

## About This Project
ScribeCat v2 is an Electron desktop app for transcription, note-taking, and collaborative studying.

**Tech Stack:** Electron 38 + Vite, TypeScript (strict mode), TipTap rich-text editor, Yjs for CRDT collaboration, Supabase backend, AssemblyAI transcription, Claude AI integration, Excalibur game engine

## Core Philosophy

**NO BANDAID FIXES - ONLY SOLUTIONS TO THE ROOT CAUSE!**

If something's broken, fix it properly. Don't patch over symptoms - diagnose and solve the actual problem. Quick hacks create technical debt.

**Examples:**
- BAD: "Let's add a try-catch to hide that error"
- GOOD: "That error means X is misconfigured. Let's fix the config."
- BAD: "Just restart the service when it fails"
- GOOD: "The service is failing because of Y. Let's fix Y."

**COMPLETE ALL ASPECTS OF EVERY PLAN!**

When given a task or plan, execute it fully. Don't stop partway through or leave loose ends. If a plan has 5 steps, complete all 5. If you're implementing a feature, finish all its components before moving on.

**Examples:**
- BAD: Implementing 3 of 5 planned functions and saying "the rest follows the same pattern"
- GOOD: Implementing all 5 functions completely
- BAD: Creating a component without its styles, tests, or integration
- GOOD: Delivering the complete, working feature

## 🚦 Before You Start ANY Work

1. **Check version** in package.json
2. **Run `npm run clean`** to delete old build artifacts
3. **Read these instructions** fully before coding

## ⛔ CRITICAL: Do NOT Run `npm run dev`

**`npm run dev` does not work in this project.** It fails for unresolved reasons. Do not attempt to run it unless explicitly asked to debug it.

**Instead, use:**
- `npm run compile` — Compile TypeScript
- `npm run build` — Full production build

This is a known issue we'll address eventually, but for now, avoid `npm run dev` entirely.

## 🚫 ABSOLUTELY NO EMOJIS IN APP UI - USE SVG ICONS INSTEAD

**User-facing interface text must NEVER contain emojis.** Use SVG icons from Lucide instead.

**Icon Library:** We use **Lucide** for all UI icons. Import from the renderer's icon utilities.

**Examples:**
- ❌ WRONG: `<button>Save 💾</button>`
- ❌ WRONG: `"Recording started! 🎙️"`
- ❌ WRONG: `achievements[0].title = "First Steps! 🎉"`
- ✅ CORRECT: `<button><Save size={16} /> Save</button>` (using Lucide Save icon)
- ✅ CORRECT: `"Recording started"` with a `<Mic />` icon component
- ✅ CORRECT: `achievements[0].title = "First Steps"` with icon metadata

**Where emojis are banned:**
- Button labels (use Lucide icons instead)
- Menu items (use Lucide icons instead)
- Notifications/toasts (use Lucide icons for visual indicators)
- Achievement titles (store icon name separately)
- Error messages (use Lucide AlertCircle, XCircle, etc.)
- Status text (use Lucide icons for status indicators)
- Tooltips
- Any text rendered in the app

**Icon Usage Patterns:**
```typescript
// Button with icon
<button class="icon-button">
  <Save size={16} />
  <span>Save Session</span>
</button>

// Status indicator
<div class="status">
  <CheckCircle size={14} class="success-icon" />
  <span>Synced</span>
</div>

// Achievement data structure
interface Achievement {
  title: string;           // "First Steps" (no emoji!)
  description: string;
  icon: string;            // "Trophy" (Lucide icon name)
}
```

**Common Lucide icons to use:**
- Actions: `Save`, `Download`, `Upload`, `Copy`, `Trash2`, `Edit`, `Plus`, `X`
- Status: `CheckCircle`, `XCircle`, `AlertCircle`, `Info`, `AlertTriangle`
- Media: `Mic`, `MicOff`, `Play`, `Pause`, `Square`, `SkipForward`
- Navigation: `ChevronLeft`, `ChevronRight`, `Menu`, `Home`, `Settings`
- Social: `User`, `Users`, `UserPlus`, `MessageCircle`, `Heart`
- Study: `Book`, `BookOpen`, `Bookmark`, `FileText`, `Calendar`

**Only exception:** User-generated content (chat messages, notes) can contain emojis if the user types them.

**In code comments and console logs:** Emojis are fine for developer convenience.

## Key Features

### Core Features
- **Recording & Transcription** - Real-time audio with AssemblyAI, timestamped segments, polish feature
- **Rich Notes Editor** - TipTap with Markdown, tables, code blocks, images, collaborative editing
- **Study Mode** - Timeline/Grid/List/Board views, filtering, multi-session study sets

### AI Integration (Claude claude-sonnet-4-5-20250929)
- Smart Chat (contextual Q&A)
- Content analysis and suggestions
- AI-powered study assistance

### Social & Collaboration Features
- **Friend System** - Username support (@username search), friend requests, mutual friends
- **Study Rooms** - Collaborative spaces (2-8 participants) with real-time sync
- **Room Invitations** - Invite friends with presence indicators
- **Multiplayer Games** - Quiz Battle, Jeopardy, Hot Seat Challenge, Lightning Chain
- **Real-time Chat** - Typing indicators, message history
- **User Profiles** - Avatars, display names, online status

### Gamification & Productivity
- **Achievements** - Milestone tracking and badges
- **Goals** - Study goals with progress tracking
- **Focus Mode** - Distraction-free environment
- **Custom Layouts** - Flexible UI arrangements
- **Keyboard Shortcuts** - Comprehensive shortcut system

### Customization
- **40 Themes** - 8 in each category (Calm, Energetic, Focus, Creative, Balanced)
- **Light & Dark Variants** - Every theme has both modes
- **Neobrutalism Design** - Bold borders, shadows, distinctive UI
- **Custom Fonts** - GalaxyCaterpillar (title), RonysiswadiArchitect5 (UI headers)

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
├── preload/             # Preload scripts (context bridge)
├── renderer/            # UI layer
│   ├── app.ts           # Renderer entry point
│   ├── managers/        # UI coordination managers
│   ├── components/      # UI components
│   ├── ai/              # AI integration
│   ├── audio/           # Audio handling
│   └── tiptap/          # Editor extensions
├── shared/              # Common types, utilities, logger
└── config/              # Configuration files

supabase/
├── migrations/          # 46+ SQL migrations
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
- `CourseManager` - Canvas LMS course integration
- `DeviceManager` - Audio device selection

**Study Mode:**
- `StudyModeManager` - Orchestrates study mode UI
- `StudyModeDetailViewManager` - Session detail views
- `StudyModeAIToolsManager` - AI tool generation
- `StudyModeNotesEditorManager` - Notes editing in study mode
- `SessionDataLoader` - Session loading
- `SessionEditingManager` - Session metadata editing
- `SessionDeletionManager` - Trash and deletion
- `MultiSessionCoordinator` - Multi-session study sets
- `CloudSyncManager` - Cloud sync coordination
- `FilterSortManager` - Filtering and sorting
- `BulkSelectionManager` - Bulk operations

**Social:**
- `FriendsManager` - Friends and presence
- `StudyRoomsManager` - Room management
- `ChatManager` - Real-time chat
- `MultiplayerGamesManager` - Game sessions

**Gamification & Productivity:**
- `AchievementsManager` - Track user milestones and badges
- `GoalsManager` - Study goals and progress tracking
- `FocusModeManager` - Distraction-free environment
- `LayoutManager` - Customizable UI layouts
- `CommandRegistry` / `ShortcutRegistry` - Keyboard shortcuts

**Utilities:**
- `NotificationTicker` - Toast notifications
- `RealtimeNotificationManager` - Realtime event notifications
- `SearchManager` - Global search
- `SessionSharingManager` - Share session management
- `SessionResetManager` - Reset sessions

## Architecture Pattern: Supabase Realtime

**CRITICAL:** Supabase Realtime WebSockets **DO NOT work** in Electron's main process. They require a browser environment (localStorage, proper WebSocket support).

### ✅ DO: Subscribe directly in renderer manager

```typescript
const client = RendererSupabaseClient.getInstance().getClient();
this.channel = client
  .channel(`feature-${userId}`)
  .on('postgres_changes', { 
    event: 'INSERT', 
    schema: 'public', 
    table: 'my_table' 
  }, handler)
  .subscribe();
```

### ❌ DON'T: Create IPC handlers for subscriptions

```typescript
// WRONG - WebSocket in main process, data flows through IPC
this.handle(ipcMain, 'feature:subscribe', async (event) => {
  this.repository.subscribeToFeature(userId, (data) => {
    event.sender.send('feature:update', data);
  });
});
```

**Why this matters:**
- WebSockets need browser APIs that main process doesn't have
- Realtime events won't be delivered if subscribed in main process
- Managers should use `RendererSupabaseClient` directly for all realtime features

## Critical Build Requirements

### ALWAYS Clean Before Building
```bash
npm run clean   # Delete dist/ folder
# OR manually: rm -rf dist/
```
**Why:** Old build files cause mysterious bugs. Start fresh every time.

### ALWAYS Update Version Before Commits
Update `version` in package.json using semantic versioning:
- **Patch** (2.9.0 → 2.9.1): Bug fixes
- **Minor** (2.9.0 → 2.10.0): New features
- **Major** (2.9.0 → 3.0.0): Breaking changes

**Commit format:** `"v2.9.1: Brief description of change"`

## Build Process

```bash
npm run compile          # Compile TypeScript
npm run build            # Full production build
npm run build:mac/win/linux  # Platform-specific builds
npm run clean            # Delete dist/
```

**⛔ DO NOT USE:** `npm run dev` — It's broken and will not work.

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

## How to Communicate with Lanae ⚡

**Lead with ACTION, then explain WHY:**
✅ "Run `npm run clean` to delete old build files that cause bugs"  
❌ "You might want to consider cleaning the build directory"

**No Decision Paralysis:**
- Max 2-3 options with pros/cons
- **Always recommend ONE** with clear reasoning
- Example: "Use Option A because X is your priority"

**Keep it Simple:**
- Break big tasks into 3-5 concrete steps
- Use code examples
- Pivot quickly if something isn't working

**Never:**
- Dump 5+ options without a recommendation
- Use vague suggestions like "you could try..."
- Suggest bandaid fixes that don't address root causes
- Leave tasks partially completed

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
6. **Complete ALL aspects of the plan before moving on**

## Security

- **NEVER expose API keys in code or logs**
- Store credentials in OS credential manager
- Validate all user input
- All API calls over HTTPS
- User data stays local by default

## Database

**Supabase (Cloud):**
- PostgreSQL with Row-Level Security
- Tables: sessions, transcriptions, users, friends, study_rooms, room_participants, chat_messages, game_sessions, game_questions, player_scores, shares, yjs_state, presence, room_invitations
- Realtime subscriptions for live updates
- 46+ migrations implementing features

**Local:**
- electron-store for settings
- Audio files in user data directory

## Workflow Summary

1. **Starting work:** Check issues or ask what to work on
2. **Before building:** `npm run clean`
3. **After changes:** Test locally (use `npm run compile` or `npm run build`, NOT `npm run dev`)
4. **Before committing:** Update version, include in commit message
5. **Commit format:** `"v2.x.x: Brief description"`
6. **Always:** Complete all aspects of the plan — no partial implementations

## Remember

You're helping a busy student juggling school and development. Be supportive, clear, and actionable. Small wins matter. Fix things properly the first time — and finish what you start!