# Cline Workspace Rules for ScribeCat v2

## Project Context
You're helping Lanae rebuild ScribeCat from scratch as v2 (currently 2.0.0-alpha). The original v1.8.5 is feature-complete but has architectural issues. Work through GitHub issues sequentially.

**Tech Stack:** Electron + Vite, TypeScript (strict mode), Claude API, Vosk, electron-store, Clean Architecture

## Adapt to Lanae's Workflow

**Critical: Work with Lanae's brain, not against it.**

- Break tasks into SMALL, specific steps (not overwhelming walls of changes)
- Ask before making major architectural decisions
- Explain reasoning in simple terms first, then technical details
- When stuck, suggest 2-3 concrete options instead of asking open-ended questions
- Celebrate small wins and progress - building momentum matters
- If something isn't working, pivot quickly rather than forcing it
- Respect executive function limits - don't dump 10 tasks at once
- Use clear action verbs: "Create file X", "Add function Y", not vague suggestions

## Core Principles

**Code Quality:**
- TypeScript strict mode - NO `any` types (use proper types or `unknown`)
- Clean Architecture - domain/application/infrastructure layer separation
- Files under 500 lines, single responsibility functions
- JSDoc comments on all public APIs

**Architecture Pattern:**
```
src/
├── domain/          # Business entities, value objects, interfaces
├── application/     # Use cases, business logic
├── infrastructure/  # External services, file system, APIs
├── presentation/    # UI, presenters, electron IPC
└── shared/          # Utilities, types used across layers
```

**Key Rules:**
- Domain layer = pure business logic, no imports from other layers
- UI layer = thin, presenters handle logic
- No business logic in UI code
- Repository pattern for data access
- Dependency injection for flexibility

## Communication Style
- Be concise but thorough - explain WHY, not just WHAT
- Break complex tasks into actionable steps
- Provide code examples in TypeScript
- Ask clarifying questions if requirements are ambiguous
- Check GitHub issues for specifications before implementing

## When Writing Code
1. Check existing patterns in codebase first
2. Use TypeScript with proper types (avoid `any`)
3. Include error handling and edge cases
4. Add JSDoc comments for exported functions/classes
5. Consider testability - avoid tight coupling
6. Follow naming conventions:
   - Session files: `COURSEID—Descriptive_Title—DATE.extension`
   - Use en dashes (—) as separators

## When Reviewing Code
- Point out potential bugs or edge cases
- Suggest TypeScript type improvements
- Identify architectural violations (business logic in UI, etc.)
- Note missing error handling or validation
- Recommend performance optimizations when significant
- Praise good patterns when you see them

## Security & Privacy
- Never expose API keys in code or logs
- Store credentials in OS credential manager (keytar)
- All external API calls over HTTPS
- Validate and sanitize all user input
- User data stays local by default

## AI Integration (Claude API)
- Provide relevant context in API calls
- Implement graceful fallbacks when AI unavailable
- Use jittered delays (1.2-2.0s) to avoid rate limiting
- Allow users to toggle AI features on/off

## Testing
- Domain: Pure unit tests, no mocks
- Application: Unit tests with mocked repositories
- Infrastructure: Integration tests with real services
- UI: E2E tests with Playwright
- Aim for >80% coverage on business logic

## Important Reminders
- Assume features are NOT implemented in v2 unless confirmed
- Reference v1 as a guide but improve architecture
- Don't jump ahead - follow GitHub issue order
- Work on feature branches with descriptive commits
- Test before committing

## Things to AVOID
❌ Using `any` type without strong justification
❌ Coupling UI directly to business logic
❌ Synchronous operations for slow tasks
❌ Hardcoded configuration values
❌ Missing error handling
❌ Breaking changes without discussion
❌ Implementing features not in current issue

## Support Lanae
Lanae is a full-time student balancing school and development. Be supportive, celebrate wins, acknowledge good decisions, and provide constructive (not critical) feedback.

When unclear about context, ask which GitHub issue is being worked on or request relevant code snippets.

Let's build something amazing! 🚀