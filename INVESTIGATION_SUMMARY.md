# Session Management Investigation - Complete Summary

## What Was Investigated

You asked for a thorough root cause analysis of stuck trash sessions in ScribeCat v2. This investigation examined:

1. **Session Storage Architecture** - Where sessions are stored (local + cloud)
2. **Trash/Deletion Workflows** - How sessions move through delete/restore lifecycle
3. **Supabase Integration** - How cloud sync works for deleted sessions
4. **Error Handling** - Where errors aren't caught that cause stuck sessions
5. **Sync Coordination** - How DeletedSessionsTracker prevents re-downloads

---

## Key Finding: The Root Cause

**Sessions get stuck in trash because Supabase operations silently succeed even when 0 rows are affected.**

### The Critical Bug Chain

```
1. User deletes session (30 days ago)
   ├─ Local: deletedAt set ✓
   └─ Cloud: deleted_at set ✓

2. Time passes, Supabase TTL cleanup occurs
   └─ Cloud row is permanently deleted ✗

3. User tries to restore from trash
   ├─ Local restore succeeds ✓
   ├─ Cloud restore called but...
   │  - Session doesn't exist
   │  - Supabase returns no error (0 rows affected)
   │  - Code doesn't check row count
   │  └─ Silently returns success ❌
   ├─ Tracker updated to remove from tracking ✓
   └─ Session is now LOST
      - Not in local trash (restored)
      - Not in cloud (was already deleted)
      - Not being tracked (removed from tracker)
```

---

## Three Investigation Documents

### 1. SESSION_TRASH_ROOT_CAUSE_ANALYSIS.md
**What:** Comprehensive root cause analysis with detailed explanations

**Contents:**
- Session storage architecture (3 layers)
- Trash/deletion flow (soft delete, retrieve, restore, permanent delete)
- Four critical root causes (detailed)
- Error handling gaps (4 major gaps)
- Data flow diagrams
- File location reference

**Read this if:** You want to understand the complete picture

### 2. SESSION_ARCHITECTURE_DETAILS.md
**What:** Technical deep dive with code flows and examples

**Contents:**
- Architecture diagram
- Trash session lifecycle (creation through permanent delete)
- Critical bug explanation with code examples
- Code flow analysis for each operation
- Integration points (IPC → Use Cases)
- Problem summary table

**Read this if:** You need to fix the bugs and want to understand the code

### 3. SESSION_QUICK_REFERENCE.md
**What:** Quick lookup guide for developers and testers

**Contents:**
- Key concepts summary
- Files involved (by layer)
- Code flow by operation
- Data field reference
- Five dangerous operations (with severity)
- How sessions get stuck (scenario-based)
- Testing scenarios
- Architecture validation questions
- Summary table

**Read this if:** You're fixing the code and need quick reference

---

## The Five Critical Bugs

### Bug #1: SupabaseSessionRepository.restore() (CRITICAL)
**File:** `/src/infrastructure/repositories/SupabaseSessionRepository.ts:409-428`

**Problem:** Doesn't validate that any rows were actually updated

```typescript
async restore(sessionId: string): Promise<void> {
  const { error } = await client
    .from(this.tableName)
    .update({ deleted_at: null })
    .eq('id', sessionId);
  
  if (error) throw new Error(...);
  // ❌ Missing: Check if rows were affected!
}
```

**Fix:** Validate row count
```typescript
const { data, error } = await client.from(...).update(...).select();
if (error) throw error;
if (!data?.length) throw new Error('Session not found');
```

### Bug #2: SupabaseSessionRepository.permanentlyDelete() (CRITICAL)
**File:** `/src/infrastructure/repositories/SupabaseSessionRepository.ts:480-497`

**Problem:** Doesn't validate that the deletion succeeded

```typescript
async permanentlyDelete(sessionId: string): Promise<void> {
  const { error } = await client
    .from(this.tableName)
    .delete()
    .eq('id', sessionId);
  
  if (error) throw error;
  // ❌ Missing: Check how many rows were deleted!
}
```

**Fix:** Use .select() to get count
```typescript
const { data, error } = await client.from(...).delete().select();
if (error) throw error;
if (!data?.length) throw new Error('Session not found or already deleted');
```

### Bug #3: SupabaseSessionRepository.update() (HIGH)
**File:** `/src/infrastructure/repositories/SupabaseSessionRepository.ts:261-273`

**Problem:** Only warns, doesn't throw on zero affected rows

```typescript
if (!data || data.length === 0) {
  console.warn('Update succeeded but no rows affected...');
  // ❌ Should throw, not just warn
}
```

**Fix:** Throw error instead of warning
```typescript
if (!data?.length) {
  throw new Error('Update affected 0 rows - session may not exist');
}
```

### Bug #4: RestoreSessionUseCase (CRITICAL)
**File:** `/src/application/use-cases/RestoreSessionUseCase.ts:23-51`

**Problem:** Doesn't validate cloud restore succeeded before updating tracker

```typescript
async execute(sessionId: string): Promise<void> {
  await this.sessionRepository.restore(sessionId);    // Local ✓
  
  if (this.remoteRepository) {
    try {
      await this.remoteRepository.restore(sessionId); // Cloud might fail silently!
    } catch (error) {
      console.warn(...);  // Just logs, continues
    }
  }
  
  if (this.deletedTracker) {
    await this.deletedTracker.remove(sessionId);     // ❌ Still removes!
  }
}
```

**Fix:** Don't remove from tracker if cloud operation fails
```typescript
// Only proceed with tracker removal if cloud operation succeeded
// Or only if no remote repository exists
```

### Bug #5: PermanentlyDeleteSessionUseCase (HIGH)
**File:** `/src/application/use-cases/PermanentlyDeleteSessionUseCase.ts:26-36`

**Problem:** Proceeds even if can't load session to verify

```typescript
let session;
try {
  session = await this.sessionRepository.findById(sessionId);
} catch (error) {
  console.warn('Could not load...will try to delete anyway');
  // ❌ Proceeds without validation!
}
```

**Fix:** Require session to be loaded for validation
```typescript
// OR: Make sure session is in trash first
// OR: Require explicit --force flag
```

---

## Impact Analysis

### Who's Affected
- Users with cloud-synced sessions who delete and try to restore
- Users who have sessions expire from cloud (TTL cleanup)
- Users who experience network failures during sync

### What Happens
1. Session appears in trash
2. User clicks restore
3. Operation appears to succeed
4. Session is actually gone forever
5. No error message, no recovery possible

### When It Happens
- Most likely: After 30 days when cloud TTL cleanup runs
- Can happen: When network fails during sync
- Can happen: When Supabase session is manually deleted

---

## Storage Layers (Important Context)

### Layer 1: Local File System
**Location:** `~/.scribeCat/sessions/*.json`
**Status:** Safe (no validation issues)
**Issues:** None noted

### Layer 2: Supabase Database
**Location:** `sessions` table
**Status:** Unsafe (validation gaps)
**Issues:** 
- All three main operations don't validate row counts
- RLS policy failures silent
- No constraints preventing bad data

### Layer 3: Supabase Storage
**Location:** `users/{userId}/{sessionId}/transcription.json` & `.../audio.webm`
**Status:** Okay (used only for fallback)
**Issues:** None noted

---

## Files to Modify (Priority Order)

### CRITICAL (Fix First)
1. `/src/infrastructure/repositories/SupabaseSessionRepository.ts`
   - restore() method
   - permanentlyDelete() method

2. `/src/application/use-cases/RestoreSessionUseCase.ts`
   - Don't remove from tracker if remote fails

### HIGH (Fix Second)
3. `/src/infrastructure/repositories/SupabaseSessionRepository.ts`
   - update() method

4. `/src/application/use-cases/PermanentlyDeleteSessionUseCase.ts`
   - Validate session was loaded

### MEDIUM (Improve)
5. `/src/infrastructure/services/sync/SyncManager.ts`
   - Add orphaned trash detection

---

## Testing Approach

### Minimal Test (3 cases)
1. Restore session that doesn't exist in cloud
2. Permanently delete session that doesn't exist in cloud
3. Verify proper error messages appear

### Complete Test
- See "Testing Scenarios" in SESSION_QUICK_REFERENCE.md

---

## Related Code Patterns

### Where Validation IS Done Correctly
- FileSessionRepository methods (mostly safe)
- Session entity creation (validates fields)
- IPC handlers (some validation)

### Where Validation IS MISSING
- All three SupabaseSessionRepository mutation methods
- RestoreSessionUseCase (trusts remote)
- PermanentlyDeleteSessionUseCase (trusts repository)

---

## Communication Style Notes

This investigation was designed to:
1. **Lead with the action** - Here's the root cause and what's broken
2. **Explain the why** - How the architecture works and why it fails
3. **Provide specifics** - Exact line numbers and code snippets
4. **Give options** - Multiple ways to look at the problem
5. **Avoid bandaids** - Focus on root causes, not symptoms

The bugs are real issues in error handling, not design problems. The architecture is actually well-structured; it just needs better validation.

---

## Next Steps

When you're ready to fix:

1. **Read SESSION_QUICK_REFERENCE.md** for quick context
2. **Focus on SupabaseSessionRepository** (has 3 bugs)
3. **Then RestoreSessionUseCase** (has 1 bug)
4. **Then PermanentlyDeleteSessionUseCase** (has 1 bug)
5. **Test with scenarios from SESSION_ARCHITECTURE_DETAILS.md**

Each fix is straightforward - just validate that operations affected rows before considering them successful.

---

## Files Included

- **SESSION_TRASH_ROOT_CAUSE_ANALYSIS.md** (14KB, 377 lines)
  - Complete root cause analysis

- **SESSION_ARCHITECTURE_DETAILS.md** (18KB, 448 lines)
  - Architecture diagrams and code flows

- **SESSION_QUICK_REFERENCE.md** (12KB, 352 lines)
  - Quick lookup guide for developers

- **INVESTIGATION_SUMMARY.md** (this file)
  - Summary and navigation guide

Total: ~55KB of detailed analysis with exact locations and code examples.

