# Claude Code Instructions for ScribeCat v2

## About This Project
ScribeCat v2 is an Electron app for transcription and note-taking. Current version: 1.0.2. Built with TypeScript (strict mode), Clean Architecture pattern, and integrates with Claude API and AssemblyAI.

**Tech Stack:** Electron + Vite, TypeScript, esbuild for builds, Vitest for testing, Supabase backend

## Critical Build Requirements

### 1. ALWAYS Clean Before Building
**Before running ANY build command, explicitly delete the dist/ directory:**
```bash
# Use the built-in clean script
npm run clean

# Or manually
rm -rf dist/
```

**Why:** Old build files can cause weird bugs and make it look like changes didn't work. Start fresh every time.

**When this applies:**
- Before `npm run compile`
- Before `npm run build`
- Before `npm run build:mac/win/linux`
- When debugging build issues
- After pulling changes

### 2. ALWAYS Update Version Before Commits
**Before committing ANY changes, update the version in package.json:**

Current version format: `1.0.2` (semantic versioning)

**Version bump rules:**
- **Patch** (1.0.2 → 1.0.3): Bug fixes, small tweaks
- **Minor** (1.0.2 → 1.1.0): New features, backwards-compatible
- **Major** (1.0.2 → 2.0.0): Breaking changes

**Include the version in your commit message:**
```bash
# Example commit messages
"v1.0.3: Fix transcription pause button bug"
"v1.1.0: Add PDF export feature"
"v2.0.0: BREAKING: New storage architecture"
```

## Communication Style (CRITICAL)

**Lanae has ADHD - your communication style matters:**

✅ **DO:**
- Lead with THE action to take (singular, not options)
- Break big tasks into small, concrete steps
- Explain WHY after WHAT
- Use simple language, define technical terms briefly
- Be enthusiastic and celebrate progress! 🎉
- Provide code examples
- If something's not working, suggest ONE alternative quickly

❌ **DON'T:**
- Give 3+ options and ask them to choose (causes decision paralysis)
- Use vague suggestions ("you might want to consider...")
- Dump 10 tasks at once
- Assume they know technical jargon
- Be condescending about their coding experience

**When you need to offer choices:**
1. List max 2-3 options with concise pros/cons
2. **RECOMMEND one specific option with clear reasoning**
3. Example: "I recommend Option 2 (using X library) because it handles Y automatically and requires less setup than Option 1."

## Build Process

**Build scripts:**
- `npm run dev` - Development mode with hot reload
- `npm run compile` - Compile TypeScript to dist/
- `npm run build` - Full production build
- `npm run clean` - Delete dist/ folder

**Build outputs:**
- Main process → `dist/main/`
- Preload → `dist/preload/`
- Renderer → `dist/renderer/`

**Custom build scripts in root:**
- `build-main.js` - Builds main process with esbuild
- `build-preload.js` - Builds preload script
- `build-renderer.js` - Builds renderer with Vite

## Code Architecture

**Follow Clean Architecture pattern:**
```
src/
├── domain/          # Pure business logic (NO external imports)
├── application/     # Use cases, orchestrates domain
├── infrastructure/  # APIs, file system, external services
├── presentation/    # UI, Electron IPC, thin layer
└── shared/          # Common types and utilities
```

**Rules:**
- TypeScript strict mode - avoid `any` (use proper types or `unknown`)
- Files under 500 lines
- Single responsibility functions
- JSDoc comments on public APIs
- Repository pattern for data access

## When Making Changes

**Before you write code:**
1. Check existing patterns in the codebase first
2. If it's a big change, explain your approach and ask for confirmation
3. Consider: Does this fit Clean Architecture?

**When writing code:**
1. Use TypeScript with proper types
2. Add error handling for edge cases
3. Include JSDoc comments
4. Test locally before committing
5. **Delete dist/ before building**
6. **Update version in package.json**

**File naming convention for sessions:**
`COURSEID—Descriptive_Title—DATE.extension` (use en dashes: —)

## Testing

**Test stack:** Vitest + @testing-library
**Coverage target:** >80% on business logic
```bash
npm run test              # Run tests in watch mode
npm run test:run          # Run once
npm run test:coverage     # Check coverage
npm run test:ui           # Visual test UI
```

**Test structure:**
- Domain layer: Pure unit tests, no mocks
- Application: Unit tests with mocked repositories
- Infrastructure: Integration tests
- UI: E2E tests (when implemented)

## Security

- **NEVER expose API keys in code or logs**
- Store credentials in OS credential manager
- Validate all user input
- All API calls over HTTPS
- User data stays local by default

## When You're Stuck

**Instead of asking open-ended questions:**
1. Analyze the issue
2. Present 2 concrete approaches
3. **Recommend one with reasoning**
4. Example: "The error suggests X. I recommend trying Y because Z. Want me to implement that?"

**If something's not working:**
- Pivot quickly rather than forcing it
- Suggest a simpler alternative
- It's okay to say "this approach isn't working, let's try..."

## Important Notes

- This is v2 - assume features aren't implemented unless confirmed
- Work on feature branches with descriptive commits
- Reference existing docs in root: TESTING.md, INSTALLATION.md, etc.
- Build issues? First step is always: **delete dist/ folder**
- The browser-extension/ folder is a separate component

## Workflow Summary

1. **Starting work:** Check GitHub issues or ask what to work on
2. **Before building:** `npm run clean` 
3. **After changes:** Test locally
4. **Before committing:** Update version, include in commit message
5. **Commit format:** `"v1.0.x: Brief description of change"`

## Remember

You're helping a busy student who's juggling school and development. Be supportive, clear, and actionable. Small wins matter. Let's build something awesome! 🚀