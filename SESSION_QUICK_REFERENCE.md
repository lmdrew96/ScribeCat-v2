# Session Management - Quick Reference Guide

## Key Concepts

### Storage Layers (3 total)
1. **FileSessionRepository** - Local `~/.scribeCat/sessions/*.json` files
2. **SupabaseSessionRepository** - Cloud database `sessions` table
3. **Supabase Storage** - Object storage for audio/transcription files

### Session States

**Active Session:**
- FileSession: `deletedAt: undefined`
- Supabase: `deleted_at: null`
- Visible in main session list

**Deleted Session (Trash):**
- FileSession: `deletedAt: <Date>`
- Supabase: `deleted_at: <Date>`
- Visible in trash only
- Marked in DeletedSessionsTracker

**Permanently Deleted:**
- FileSession: JSON file deleted
- Supabase: Row deleted from table
- Completely gone

---

## Critical Bug Summary

**The Problem:**
When a session no longer exists in Supabase, attempting to restore it appears to succeed but actually fails silently. The session is removed from trash locally while remaining gone in the cloud.

**Why It Happens:**
- Supabase returns `{ error: null }` even when 0 rows are affected
- SupabaseSessionRepository methods don't validate row counts
- RestoreSessionUseCase removes from tracker regardless of cloud success

**Result:**
- Session is lost forever
- Not in local trash
- Not in cloud
- Not being tracked

---

## Files Involved

### Domain Layer
- `/src/domain/entities/Session.ts` - Session entity with `deletedAt` field
- `/src/domain/repositories/ISessionRepository.ts` - Interface defining contract

### Repository Layer
- `/src/infrastructure/repositories/FileSessionRepository.ts` - Local storage (mostly safe)
- `/src/infrastructure/repositories/SupabaseSessionRepository.ts` - Cloud storage (has bugs)

### Use Cases
- `/src/application/use-cases/DeleteSessionUseCase.ts` - Soft delete
- `/src/application/use-cases/RestoreSessionUseCase.ts` - Restore (dangerous)
- `/src/application/use-cases/PermanentlyDeleteSessionUseCase.ts` - Hard delete (dangerous)
- `/src/application/use-cases/GetDeletedSessionsUseCase.ts` - List trash

### Tracking
- `/src/infrastructure/services/DeletedSessionsTracker.ts` - Prevents re-download
- `/src/infrastructure/services/sync/SyncManager.ts` - Coordinates sync

### UI
- `/src/renderer/components/TrashModal.ts` - Trash interface
- `/src/renderer/managers/study-mode/SessionDeletionManager.ts` - Deletion workflow

### IPC
- `/src/main/ipc/handlers/SessionHandlers.ts` - IPC endpoint handlers

---

## Code Flow by Operation

### Delete Session
```
User deletes → DeleteSessionUseCase.execute()
├─ FileSessionRepository.delete()      ✓ Sets deletedAt
├─ SupabaseSessionRepository.delete()  ✓ Sets deleted_at
├─ DeletedSessionsTracker.markAsDeleted() ✓ Tracks deletion
└─ Audio files NOT deleted             ✓ Kept for 30 days
```

### View Trash
```
User opens trash → GetDeletedSessionsUseCase.execute()
├─ FileSessionRepository.findDeleted() ✓ Find where deletedAt IS NOT NULL
├─ SupabaseSessionRepository.findDeleted() ✓ Find where deleted_at IS NOT NULL
├─ Merge results with dedup by ID
└─ Display in TrashModal
```

### Restore from Trash (BUG LOCATION)
```
User restores → RestoreSessionUseCase.execute()
├─ FileSessionRepository.restore()     ✓ Clears deletedAt
├─ SupabaseSessionRepository.restore() 🔴 BUG: No error check on row count
├─ DeletedSessionsTracker.remove()    ✓ Removes from tracking
└─ Result: Session lost if not in cloud
```

### Permanently Delete (BUG LOCATION)
```
User empties trash → PermanentlyDeleteSessionUseCase.execute()
├─ Load session (may fail, but proceeds anyway)
├─ Delete audio file
├─ FileSessionRepository.permanentlyDelete() ✓ Unlinks JSON
├─ SupabaseSessionRepository.permanentlyDelete() 🔴 BUG: No error check
└─ Result: Silent failure if not in cloud
```

---

## Data Fields for Deletion

### Session Entity
```typescript
deletedAt?: Date          // Soft delete marker
cloudId?: string          // Cloud reference (must exist to sync)
userId?: string           // Owner (checked by RLS)
syncStatus: SyncStatus    // NOT_SYNCED, SYNCING, SYNCED, FAILED
```

### Supabase Table
```sql
deleted_at TIMESTAMP NULL DEFAULT NULL   -- Soft delete marker
user_id UUID NOT NULL                    -- RLS policy
id UUID PRIMARY KEY                      -- Session ID
```

### DeletedSessionsTracker
```json
{
  "deletedSessionIds": ["session-1", "session-2"],
  "lastUpdated": "2024-01-15T11:00:00Z"
}
```

---

## Dangerous Operations

### Operation 1: RestoreSessionUseCase
**Location:** `/src/application/use-cases/RestoreSessionUseCase.ts`

**Issue:** Doesn't validate that restoration succeeded in cloud
```typescript
await this.remoteRepository.restore(sessionId);
// No check if this actually affected any rows!
```

**Risk:** Session lost if not in cloud
**Severity:** CRITICAL

### Operation 2: PermanentlyDeleteSessionUseCase
**Location:** `/src/application/use-cases/PermanentlyDeleteSessionUseCase.ts`

**Issue:** Proceeds even if session can't be loaded
```typescript
let session;
try {
  session = await this.sessionRepository.findById(sessionId);
} catch (error) {
  console.warn('Could not load...will try to delete anyway');
  // Proceeds without session object!
}
```

**Risk:** Can't verify success of cloud deletion
**Severity:** HIGH

### Operation 3: SupabaseSessionRepository.restore()
**Location:** `/src/infrastructure/repositories/SupabaseSessionRepository.ts:409-428`

**Issue:** Doesn't check if any rows were actually updated
```typescript
const { error } = await client
  .from(this.tableName)
  .update({ deleted_at: null })
  .eq('id', sessionId);

if (error) throw error;
// ❌ Missing: if (!data || data.length === 0) throw error
```

**Risk:** Returns success even if session doesn't exist
**Severity:** CRITICAL

### Operation 4: SupabaseSessionRepository.update()
**Location:** `/src/infrastructure/repositories/SupabaseSessionRepository.ts:261-273`

**Issue:** Warns but doesn't throw on zero affected rows
```typescript
if (!data || data.length === 0) {
  console.warn('Update succeeded but no rows affected');
  // ❌ Should throw, not warn
}
```

**Risk:** Silently proceeds with failed update
**Severity:** HIGH

### Operation 5: SupabaseSessionRepository.permanentlyDelete()
**Location:** `/src/infrastructure/repositories/SupabaseSessionRepository.ts:480-497`

**Issue:** Doesn't validate deletion succeeded
```typescript
const { error } = await client
  .from(this.tableName)
  .delete()
  .eq('id', sessionId);

if (error) throw error;
// ❌ Missing: validation of deleted row count
```

**Risk:** Returns success even if session wasn't deleted
**Severity:** CRITICAL

---

## How Sessions Get Stuck

### Scenario: User Deletes, Cloud TTL Cleanup Occurs

```
Day 0:  User deletes session
        ├─ Local: deletedAt = now()      ✓
        ├─ Cloud: deleted_at = now()     ✓
        └─ Tracker: marked deleted       ✓

Days 1-29: Session sits in trash

Day 30: Supabase TTL cleanup (or manual deletion)
        ├─ Cloud: Row deleted from table ✗
        ├─ Local: Still has JSON file    (✓ but stale)
        └─ Tracker: Still marked         (✓ but stale)

Day 31: User opens trash and clicks "Restore"
        ├─ Local: deletedAt = null       ✓
        ├─ Cloud: UPDATE → no error, 0 rows affected 🔴
        ├─ Tracker: remove()             ✓
        └─ Session is now:
           - Not in local trash
           - Not in cloud
           - Not being tracked
           = 🔴 LOST FOREVER
```

---

## Sync Coordination Issue

### DeletedSessionsTracker (delete-sessions.json)

**Purpose:** Track sessions deleted locally to prevent re-download

**Problem:** Out of sync if cloud operations fail
```
If RemoteRepository.restore() silently fails:
├─ Local side thinks session is restored
├─ Removes from tracker
├─ Session actually still deleted in cloud
└─ Next sync doesn't see it as deleted
```

**Result:** No way to detect/recover

---

## Testing Scenarios

### Test Case 1: Session Deleted from Cloud, User Restores
```
1. Create session, sync to cloud
2. Manually delete from Supabase console
3. User opens trash, clicks restore
4. Check: Does session reappear?
   Expected: Error message
   Actual: Success message, session gone
```

### Test Case 2: Session Exists Locally, Missing in Cloud
```
1. Create session, sync to cloud
2. Delete session (soft delete)
3. Simulate Supabase cleanup (DELETE from DB)
4. User tries to permanently delete
5. Check: Does it show error?
   Expected: Error or warning
   Actual: Success message
```

### Test Case 3: Restore Partial Failure
```
1. Create synced session
2. Delete session (both local and cloud)
3. Mock remoteRepository.restore() to throw error
4. User clicks restore
5. Check: Is session still in trash?
   Expected: Yes, in local AND cloud
   Actual: Not in local trash (but still in cloud)
```

---

## Architecture Validation Questions

**Q: When does FileSessionRepository need validation?**
A: No - it's just file I/O. If file exists, it's valid.

**Q: When does SupabaseSessionRepository need validation?**
A: ALL operations - Supabase doesn't throw on 0 affected rows

**Q: What should validate row counts?**
A: SupabaseSessionRepository methods should check:
```typescript
if (!data || data.length === 0) {
  throw new Error(`Operation affected 0 rows - session may not exist`);
}
```

**Q: When should use cases validate?**
A: Before removing from tracker/UI:
```typescript
const result = await remoteRepository.restore(sessionId);
// Check: Did it actually restore?
```

**Q: When should SyncManager validate?**
A: Before removing from sync queue:
```typescript
// Verify session still exists before removing from queue
```

---

## Summary Table

| Operation | File | Issue | Severity | Affects |
|-----------|------|-------|----------|---------|
| Restore on missing | RestoreSessionUseCase | No pre-check | CRITICAL | Trash → Lost |
| Restore in cloud | SupabaseSessionRepository.restore() | No row validation | CRITICAL | Cloud sync |
| Delete on missing | PermanentlyDeleteSessionUseCase | No validation | HIGH | Empty trash |
| Delete in cloud | SupabaseSessionRepository.permanentlyDelete() | No row validation | CRITICAL | Cloud sync |
| Update on missing | SupabaseSessionRepository.update() | Only warns | HIGH | General updates |
| Sync cleanup | SyncManager | No orphan detection | MEDIUM | Lost sessions |

