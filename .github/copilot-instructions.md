# ScribeCat v2 - Copilot Instructions

## Project Overview
Electron desktop app for recording, transcription (AssemblyAI), rich notes (TipTap), and AI study tools (Claude). Uses Clean Architecture with TypeScript strict mode.

## Critical Commands
```bash
npm run compile          # Compile TypeScript (use this for dev)
npm run build            # Full production build
npm run clean            # ALWAYS run before compiling and builds to avoid stale artifacts
npm run test             # Vitest in watch mode
```
**⚠️ `npm run dev` is BROKEN** - use `npm run compile` + `npm start` instead.

## Architecture: 3-Process Electron Model

### Process Boundaries
- **Main** ([src/main/](src/main/)): Node.js - IPC handlers, file I/O, services. Entry: `ScribeCatApp` class
- **Preload** ([src/preload/preload.ts](src/preload/preload.ts)): Context bridge - exposes `window.scribeCat` API
- **Renderer** ([src/renderer/](src/renderer/)): Browser - UI, managers, realtime subscriptions

### Clean Architecture Layers
```
src/domain/       → Pure entities (Session, User) - NO external imports
src/application/  → Use cases - orchestrate domain logic
src/infrastructure/ → External services (AI, Supabase, export)
src/renderer/     → UI layer (managers + components)
```

## Key Patterns

### IPC Communication
All main↔renderer communication via typed IPC channels through [IPCCoordinator.ts](src/main/IPCCoordinator.ts):
- Handlers in [src/main/ipc/handlers/](src/main/ipc/handlers/) (one per domain: Session, Auth, AI, etc.)
- Renderer calls via `window.scribeCat.{namespace}.{method}()`

### Supabase Realtime - CRITICAL
**WebSockets DO NOT work in main process.** Always subscribe in renderer:
```typescript
// ✅ CORRECT - renderer process
const client = RendererSupabaseClient.getInstance().getClient();
client.channel('my-channel').on('postgres_changes', {...}).subscribe();

// ❌ WRONG - main process subscription will silently fail
```
See [RendererSupabaseClient.ts](src/renderer/services/RendererSupabaseClient.ts) for implementation.

### Manager Pattern (Renderer)
UI coordinated via managers in [src/renderer/managers/](src/renderer/managers/):
- `RecordingManager` - audio recording + transcription flow
- `StudyModeManager` - session browsing, AI tools
- `AuthManager` - authentication state
- Social: `FriendsManager`, `StudyRoomsManager`, `ChatManager`

## File Conventions
- **Session files**: `COURSEID—Title—DATE.extension` (use em dashes `—`)
- **ES Modules**: All imports use `.js` extension (TypeScript compiles to ESM)
- **Types**: Strict mode, avoid `any` - use `unknown` if truly needed

## Testing
- **Stack**: Vitest + happy-dom + @testing-library
- **Pattern**: Co-located tests (`*.test.ts` next to source files)
- **Coverage target**: 60%+ (see [vitest.config.ts](vitest.config.ts))

## Common Gotchas
1. **Stale builds** - Run `npm run clean` when behavior seems wrong
2. **Auth in wrong process** - OAuth/realtime MUST be in renderer
3. **Import paths** - Must use `.js` extensions for ESM compatibility

## Version & Commits
Update `version` in package.json before commits. Format: `"v2.x.x: Brief description"`
