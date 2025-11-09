# ScribeCat Session Management - Root Cause Investigation

## Start Here

This investigation was conducted to understand why sessions get stuck in trash when users try to restore them.

**Quick Answer:** Supabase returns success even when 0 rows are affected, and the code doesn't validate this.

---

## Four Documents to Read (In Order)

### 1. INVESTIGATION_SUMMARY.md (Start with this)
- **Purpose:** Navigation and overview
- **Read time:** 5 minutes
- **Contains:** The five bugs, impact analysis, next steps
- **Best for:** Understanding what's broken and why

### 2. SESSION_TRASH_ROOT_CAUSE_ANALYSIS.md (Read this next)
- **Purpose:** Deep technical analysis
- **Read time:** 15 minutes
- **Contains:** Architecture, all workflows, detailed root causes
- **Best for:** Understanding how the system works and where it fails

### 3. SESSION_ARCHITECTURE_DETAILS.md (Read for implementation)
- **Purpose:** Code-level details with examples
- **Read time:** 20 minutes
- **Contains:** Diagrams, code flows, exact problem locations
- **Best for:** Understanding the code you need to fix

### 4. SESSION_QUICK_REFERENCE.md (Use while fixing)
- **Purpose:** Quick lookup while coding
- **Read time:** 10 minutes (reference only)
- **Contains:** File locations, code snippets, testing scenarios
- **Best for:** Quick answers while implementing fixes

---

## The Root Cause (In One Sentence)

**When sessions don't exist in Supabase, the delete/restore/update operations return success instead of error, causing the system to think the operation succeeded when it actually failed.**

---

## The Five Bugs

| # | Location | Problem | Severity |
|---|----------|---------|----------|
| 1 | SupabaseSessionRepository.restore() | No row validation | CRITICAL |
| 2 | SupabaseSessionRepository.permanentlyDelete() | No row validation | CRITICAL |
| 3 | SupabaseSessionRepository.update() | Warns instead of throws | HIGH |
| 4 | RestoreSessionUseCase | Removes tracker despite failure | CRITICAL |
| 5 | PermanentlyDeleteSessionUseCase | Proceeds without validation | HIGH |

---

## Impact: Session Lost Forever

```
1. User deletes session (trash shows it with 30-day countdown)
2. Tries to restore from trash
3. Gets success message (but actually fails in cloud)
4. Session vanishes from trash
5. Session also gone from cloud
6. Session no longer being tracked
= SESSION LOST FOREVER
```

---

## Files in Codebase to Fix

### CRITICAL (3 bugs in one file)
- `/src/infrastructure/repositories/SupabaseSessionRepository.ts`
  - restore() - add row validation
  - permanentlyDelete() - add row validation  
  - update() - change warn to throw

### CRITICAL (1 bug)
- `/src/application/use-cases/RestoreSessionUseCase.ts`
  - Don't remove from tracker if remote operation fails

### HIGH (1 bug)
- `/src/application/use-cases/PermanentlyDeleteSessionUseCase.ts`
  - Require session to be loaded and validated

---

## How to Use These Documents

### For Understanding the Problem
1. Read INVESTIGATION_SUMMARY.md (5 min)
2. Read SESSION_TRASH_ROOT_CAUSE_ANALYSIS.md (15 min)
3. You now understand what's broken

### For Fixing the Problem
1. Read SESSION_QUICK_REFERENCE.md (dangerous operations section)
2. Read SESSION_ARCHITECTURE_DETAILS.md (code flow section)
3. Open SESSION_QUICK_REFERENCE.md as reference while coding
4. Refer to line numbers in INVESTIGATION_SUMMARY.md

### For Testing
1. See testing scenarios in SESSION_ARCHITECTURE_DETAILS.md
2. See testing scenarios in SESSION_QUICK_REFERENCE.md
3. Create unit tests for each bug fix

---

## Key Facts About the System

### Storage Layers
1. **Local:** `~/.scribeCat/sessions/*.json` (safe)
2. **Cloud:** Supabase `sessions` table (unsafe - validation gaps)
3. **Cloud:** Supabase Storage for transcriptions/audio (safe)

### Soft Delete
- Local: Sets `deletedAt` field to current date
- Cloud: Sets `deleted_at` column to current timestamp
- Tracker: Records session ID to prevent re-download

### Hard Delete  
- Local: Physically removes JSON file
- Cloud: Removes row from database
- Audio: Audio files deleted only during permanent delete

### The Gap
- Local operations are file-based and safe
- Cloud operations don't validate what actually happened
- Tracker becomes out of sync if operations fail

---

## Verification Checklist

Before you start fixing, verify you understand:

- [ ] Session soft delete = set deletedAt/deleted_at to current date
- [ ] Session hard delete = remove file/row completely
- [ ] FileSessionRepository is safe (no bugs here)
- [ ] SupabaseSessionRepository has 3 bugs (all validation-related)
- [ ] Supabase returns success even when 0 rows affected
- [ ] RestoreSessionUseCase removes tracker item even if cloud fails
- [ ] DeletedSessionsTracker prevents re-download during sync
- [ ] Sessions can be lost if Supabase row is deleted before restore

---

## Next Steps

### Step 1: Read the Documents
Choose based on your role:
- **Understanding:** Read INVESTIGATION_SUMMARY.md + SESSION_TRASH_ROOT_CAUSE_ANALYSIS.md
- **Fixing:** Read all four (start with INVESTIGATION_SUMMARY.md)
- **Testing:** Read SESSION_QUICK_REFERENCE.md (testing section)

### Step 2: Understand the Code
- Review the exact files mentioned in INVESTIGATION_SUMMARY.md
- Look at code examples in SESSION_ARCHITECTURE_DETAILS.md
- Check line numbers in SESSION_QUICK_REFERENCE.md

### Step 3: Fix the Bugs
- Fix SupabaseSessionRepository (3 methods)
- Fix RestoreSessionUseCase (1 method)
- Fix PermanentlyDeleteSessionUseCase (1 method)

### Step 4: Test
- Unit tests for each fix
- Integration tests using scenarios from SESSION_QUICK_REFERENCE.md

---

## Document Statistics

| Document | Size | Lines | Purpose |
|----------|------|-------|---------|
| INVESTIGATION_SUMMARY.md | 10 KB | 280 | Overview & navigation |
| SESSION_TRASH_ROOT_CAUSE_ANALYSIS.md | 14 KB | 377 | Root cause deep dive |
| SESSION_ARCHITECTURE_DETAILS.md | 18 KB | 448 | Code & architecture |
| SESSION_QUICK_REFERENCE.md | 10 KB | 352 | Developer reference |
| **Total** | **52 KB** | **1,457** | **Complete analysis** |

---

## Important Notes

1. **No Bandaids:** These are root cause issues, not symptoms
2. **Not Design Flaws:** The architecture is good, validation is missing
3. **Not Critical Bugs:** Sessions can be recovered if fixes are applied
4. **Safe to Deploy:** Fixes are localized and don't affect other features
5. **Easy to Test:** Each bug has a specific test case

---

## Questions Answered

**Q: Why do sessions get stuck?**
A: Cloud operations return success even when rows aren't affected, and code doesn't validate.

**Q: Can sessions be recovered?**
A: Not yet, but with these fixes they can prevent further loss.

**Q: How common is this?**
A: Happens when cloud deletes session (TTL, manual, or timeout) and user tries to restore.

**Q: Which repository has the bugs?**
A: SupabaseSessionRepository (3 bugs) and use cases that trust it (2 bugs).

**Q: Is the local repository safe?**
A: Yes, FileSessionRepository is safe (no validation issues).

**Q: What about sync?**
A: SyncManager is fine, but DeletedSessionsTracker gets out of sync if operations fail.

---

## Summary

You have 1,457 lines of detailed analysis explaining:
- Exactly where 5 critical bugs are
- Why they cause sessions to be lost
- How to fix each one
- How to test each fix
- How the entire system works

Start with INVESTIGATION_SUMMARY.md, then follow the reading order based on your need.

