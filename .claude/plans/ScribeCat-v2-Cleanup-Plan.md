# ScribeCat-v2 Code Cleanup Plan

## 🎯 Objective
Eliminate duplicate/legacy code that causes race conditions and conflicting renders. The codebase has a pattern where large "Manager" files exist alongside directories of refactored components - both are being used, causing conflicts.

---

## 📋 Pre-Cleanup Checklist

Before making ANY changes:
1. Create a new branch: `git checkout -b cleanup/consolidate-managers`
2. Run the app and note current behavior
3. Run existing tests: `npm test`
4. Document any TypeScript/lint errors that already exist

---

## 🔴 PHASE 1: Critical Race Condition Fixes

### 1.1 StudyModeManager Consolidation (HIGHEST PRIORITY)

**The Problem:**
- `src/renderer/managers/StudyModeManager.ts` (30KB monolith)
- `src/renderer/managers/study-mode/` (24+ component files)
- Both are likely being instantiated and managing state

**Investigation Steps:**
```bash
# Find all imports of StudyModeManager
grep -r "from.*StudyModeManager" src/ --include="*.ts"
grep -r "import.*StudyModeManager" src/ --include="*.ts"

# Find all imports from study-mode directory
grep -r "from.*study-mode/" src/ --include="*.ts"

# Check if StudyModeManager instantiates study-mode components
grep -r "import" src/renderer/managers/StudyModeManager.ts
```

**Decision Criteria:**
- If `StudyModeManager.ts` imports from `study-mode/` → It's a coordinator, KEEP IT
- If `StudyModeManager.ts` duplicates logic from `study-mode/` → It's legacy, MIGRATE & DELETE
- If both are imported independently elsewhere → RACE CONDITION SOURCE, consolidate

**Likely Action:** The monolith is probably legacy. Migrate any unique functionality to the `study-mode/` components, update imports throughout codebase, then delete `StudyModeManager.ts`.

**Verification:**
- Search for orphaned imports after deletion
- Run TypeScript compiler: `npx tsc --noEmit`
- Test Study Mode functionality in app

---

### 1.2 Settings Consolidation

**The Problem:**
- `src/renderer/settings.ts` (21KB)
- `src/renderer/settings/` directory with 5 specialized managers

**Investigation Steps:**
```bash
# Check what imports settings.ts
grep -r "from.*['\"].*settings['\"]" src/ --include="*.ts" | grep -v "settings/"

# Check what imports from settings/
grep -r "from.*settings/" src/ --include="*.ts"

# See if settings.ts uses the settings/ managers
grep -r "import" src/renderer/settings.ts | head -20
```

**Decision Criteria:**
- If `settings.ts` is only imported by legacy code or `app.ts` initialization → Refactor to use `settings/` managers
- If `settings/` managers are imported elsewhere → They're the "real" implementation

**Likely Action:** `settings.ts` is the legacy monolith. The `settings/` directory has the modular architecture. Migrate initialization logic to a new `settings/index.ts` that coordinates the managers, then delete `settings.ts`.

---

### 1.3 Tiptap Editor Consolidation

**The Problem:**
- `src/renderer/managers/TiptapEditorManager.ts` (6KB)
- `src/renderer/managers/tiptap/` (3 files)
- `src/renderer/tiptap/` (6 files - extensions)

**Investigation Steps:**
```bash
# Map the relationships
grep -r "TiptapEditorManager" src/ --include="*.ts"
grep -r "from.*managers/tiptap" src/ --include="*.ts"
grep -r "from.*renderer/tiptap" src/ --include="*.ts"
```

**Clarification:** `src/renderer/tiptap/` contains Tiptap EXTENSIONS (DraggableImage, etc.) - these are legit and should stay. The issue is whether `TiptapEditorManager.ts` conflicts with `managers/tiptap/`.

**Likely Action:** Keep `renderer/tiptap/` (extensions). Consolidate `TiptapEditorManager.ts` into `managers/tiptap/` or vice versa - pick ONE location for editor management.

---

### 1.4 Audio Manager Consolidation

**The Problem:**
- `src/renderer/audio-manager.ts` (4KB)
- `src/renderer/audio/SoundManager.ts` (16KB)

**Investigation Steps:**
```bash
grep -r "audio-manager" src/ --include="*.ts"
grep -r "SoundManager" src/ --include="*.ts"
```

**Likely Action:** `SoundManager.ts` is more comprehensive (16KB vs 4KB). Migrate any unique logic from `audio-manager.ts` to `SoundManager.ts`, update imports, delete `audio-manager.ts`.

---

## 🟠 PHASE 2: Transcription Service Cleanup

**The Problem:**
- `src/renderer/assemblyai-transcription-service.ts` (29KB - at renderer ROOT)
- `src/renderer/managers/TranscriptionManager.ts` (6KB)
- `src/renderer/services/TranscriptionModeService.ts` (10KB)
- `src/infrastructure/services/transcription/TranscriptionEnhancer.ts` (5KB)

**Investigation Steps:**
```bash
# Find the primary transcription entry point
grep -r "assemblyai-transcription-service" src/ --include="*.ts"
grep -r "TranscriptionManager" src/ --include="*.ts"
grep -r "TranscriptionModeService" src/ --include="*.ts"
```

**Architecture Decision:**
- `infrastructure/services/transcription/` → Low-level transcription logic (keep)
- `renderer/services/TranscriptionModeService.ts` → UI state for transcription modes (keep)
- `renderer/managers/TranscriptionManager.ts` → Coordinates transcription (evaluate)
- `renderer/assemblyai-transcription-service.ts` → Likely legacy monolith at wrong location (migrate/delete)

**Likely Action:** The 29KB file at renderer root is legacy. Move any unique AssemblyAI-specific logic to `infrastructure/services/transcription/`, update imports, delete the root file.

---

## 🟡 PHASE 3: View Management Cleanup

**The Problem:**
- `src/renderer/managers/ViewManager.ts`
- `src/renderer/managers/ViewModeManager.ts`
- `src/renderer/services/ViewContextService.ts`

**Investigation Steps:**
```bash
grep -r "ViewManager" src/ --include="*.ts"
grep -r "ViewModeManager" src/ --include="*.ts"  
grep -r "ViewContextService" src/ --include="*.ts"
```

**Questions to Answer:**
1. Do these have distinct responsibilities or overlap?
2. Is ViewManager the legacy version of ViewModeManager?

**Likely Action:** Consolidate into a single `ViewManager` with clear sub-responsibilities, or rename to clarify distinct roles.

---

## 🟡 PHASE 4: Export Functionality Cleanup

**The Problem:**
- `src/renderer/services/ExportCoordinator.ts`
- `src/renderer/services/export/` (4 files)
- `src/infrastructure/services/export/`

**Investigation Steps:**
```bash
grep -r "ExportCoordinator" src/ --include="*.ts"
grep -r "from.*services/export" src/ --include="*.ts"
grep -r "from.*infrastructure.*export" src/ --include="*.ts"
```

**Architecture Decision:**
- `infrastructure/services/export/` → Core export logic (keep)
- `renderer/services/export/` → UI-layer export handlers (keep)
- `ExportCoordinator.ts` → Should coordinate the above, not duplicate

**Likely Action:** Ensure `ExportCoordinator.ts` is a thin coordinator that delegates to `export/` handlers. Remove any duplicated logic.

---

## 🟡 PHASE 5: Keyboard Shortcuts Cleanup

**The Problem:**
- `src/renderer/managers/ShortcutRegistry.ts` (14KB)
- `src/renderer/managers/KeyboardShortcutHandler.ts` (5KB)
- `src/renderer/managers/study-mode/StudyModeKeyboardConfig.ts` (2KB)
- `src/renderer/managers/CommandRegistry.ts` (19KB)

**Investigation Steps:**
```bash
grep -r "ShortcutRegistry" src/ --include="*.ts"
grep -r "KeyboardShortcutHandler" src/ --include="*.ts"
grep -r "CommandRegistry" src/ --include="*.ts"
```

**Likely Architecture:**
- `CommandRegistry` → Defines available commands
- `ShortcutRegistry` → Maps shortcuts to commands
- `KeyboardShortcutHandler` → Listens for keyboard events
- `StudyModeKeyboardConfig` → Study-mode-specific shortcuts

**Likely Action:** These may be legitimately separate concerns. Verify they're not duplicating event listeners or shortcut definitions.

---

## 🟢 PHASE 6: Config & Styles Cleanup

### 6.1 Config Files
- `src/config.ts` vs `src/config/` directory

```bash
grep -r "from.*['\"].*config['\"]" src/ --include="*.ts" | grep -v "config/"
grep -r "from.*config/" src/ --include="*.ts"
```

**Action:** Consolidate to `src/config/index.ts` that exports everything. Delete `src/config.ts` if redundant.

### 6.2 Style Files
- `src/renderer/styles.css` vs `src/renderer/css/` directory

**Action:** Check if `styles.css` is the main entry or legacy. Consolidate CSS imports.

---

## 🧪 Post-Cleanup Verification

After EACH phase:
1. Run TypeScript: `npx tsc --noEmit`
2. Run tests: `npm test`
3. Run linter: `npm run lint`
4. Manual test affected features in app
5. Commit with clear message: `git commit -m "cleanup: consolidate [component] - remove legacy [file]"`

After ALL phases:
1. Full app test of all features
2. Check bundle size (should decrease)
3. Run: `grep -r "TODO\|FIXME\|HACK" src/` to find any notes left behind
4. Update any documentation

---

## 📝 Cleanup Commit Convention

Use these commit prefixes:
- `cleanup: consolidate X` - When merging duplicate code
- `cleanup: remove legacy X` - When deleting old code
- `cleanup: migrate X to Y` - When moving code between files
- `refactor: rename X to Y` - When renaming for clarity

---

## ⚠️ Important Notes

1. **Don't delete blindly** - Always trace imports first
2. **One component at a time** - Don't try to fix everything at once
3. **Test after each change** - Catch regressions early
4. **Keep the app runnable** - Each commit should be functional
5. **Document decisions** - Add comments explaining why code was kept/removed

---

## 🎯 Success Criteria

- [ ] No duplicate Manager files (monolith + directory pattern eliminated)
- [ ] TypeScript compiles with no errors
- [ ] All tests pass
- [ ] No console errors in running app
- [ ] Each feature area has ONE clear entry point
- [ ] Bundle size decreased or unchanged
- [ ] No orphaned imports
