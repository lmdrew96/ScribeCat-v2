# ScribeCat Session Management & Trash System - Root Cause Analysis

## Executive Summary
The session management system uses a **soft delete + dual-sync architecture** where sessions are marked as deleted locally and in Supabase. However, there are critical issues with error handling when sessions don't exist in Supabase that can leave trash sessions stuck.

---

## 1. Session Storage & Management Architecture

### 1.1 Storage Layers
The system has **THREE layers** of storage:

1. **Local File System** (FileSessionRepository)
   - Path: `~/.scribeCat/sessions/*.json`
   - Stores: Full session metadata including transcription
   - Operations: Save, load, soft delete (sets `deletedAt`)

2. **Supabase Database** (SupabaseSessionRepository)
   - Table: `sessions`
   - User-scoped via RLS policies
   - Stores: Session metadata + transcription (dual storage)
   - Operations: Query, upsert, soft delete (set `deleted_at`), hard delete

3. **Supabase Storage (Object Storage)**
   - Transcription files: `users/{userId}/{sessionId}/transcription.json`
   - Audio files: `users/{userId}/{sessionId}/audio.webm`

### 1.2 Session Entity Fields for Deletion
```typescript
- deletedAt?: Date           // Soft delete marker (null = active, Date = deleted)
- cloudId?: string           // Reference to cloud version
- userId?: string            // Owner for multi-user support
- syncStatus: SyncStatus     // NOT_SYNCED, SYNCING, SYNCED, FAILED
```

---

## 2. Trash/Deletion Flow

### 2.1 Soft Delete (Move to Trash)
**File:** `DeleteSessionUseCase.ts`

**Flow:**
1. Check session exists locally
2. Soft delete locally: `repository.delete(sessionId)` → sets `deletedAt = now()`
3. If `session.cloudId` exists: Soft delete in cloud
4. Mark in `DeletedSessionsTracker` (prevents re-download during sync)
5. **Audio files are NOT deleted** - kept for 30 days

**Issue:** If cloud deletion fails, session is already marked deleted locally with no way to recover state

### 2.2 Retrieve Deleted Sessions (Trash View)
**File:** `GetDeletedSessionsUseCase.ts`

**Flow:**
1. Query `repository.findDeleted(userId)` → sessions where `deletedAt IS NOT NULL`
2. Gets from local AND remote repositories
3. Merges using Map deduplication (prefers cloud version)
4. Sorts by `deletedAt` descending

**Query in SupabaseSessionRepository:**
```sql
SELECT * FROM sessions 
WHERE user_id = ? 
AND deleted_at IS NOT NULL
ORDER BY deleted_at DESC
```

### 2.3 Restore from Trash
**File:** `RestoreSessionUseCase.ts`

**Flow:**
1. `repository.restore(sessionId)` → sets `deletedAt = NULL, updatedAt = now()`
2. If remote repository exists: Also restore there
3. Remove from `DeletedSessionsTracker`

**Issue:** If session doesn't exist in Supabase (already hard-deleted), restore will fail

### 2.4 Permanent Delete (Empty Trash)
**File:** `PermanentlyDeleteSessionUseCase.ts`

**Flow:**
1. Try to load session to get audio path (may fail if already deleted from cloud)
2. Delete audio file from Storage
3. Hard delete from local: `repository.permanentlyDelete(sessionId)` → unlinks JSON file
4. If remote exists: Hard delete from Supabase
5. **Exported files preserved**

---

## 3. Critical Root Causes of Stuck Trash Sessions

### Root Cause #1: Session Exists Locally But Not in Supabase
**Scenario:**
1. User deletes session (soft delete in local + cloud)
2. Cloud deletion succeeds, local deletion succeeds
3. Later, Supabase row is permanently deleted (TTL, manual, or bug)
4. User opens trash and tries to restore

**What Happens:**
- `RestoreSessionUseCase.execute()` calls `remoteRepository.restore(sessionId)`
- SupabaseSessionRepository tries to update non-existent row
- Supabase returns success (0 rows affected) but no error
- Session appears to restore but it's actually gone from cloud
- Session is removed from local trash but also gone from cloud

**File:** `SupabaseSessionRepository.ts:409-428`
```typescript
async restore(sessionId: string): Promise<void> {
  const { error } = await client
    .from(this.tableName)
    .update({ deleted_at: null })
    .eq('id', sessionId);
  // ❌ PROBLEM: If sessionId doesn't exist in table, 
  // Supabase returns success with no error!
  if (error) throw new Error(...);
}
```

### Root Cause #2: Update on Non-Existent Session Returns No Error
**Scenario:**
1. Session permanently deleted from Supabase
2. User tries to restore via trash modal
3. `update()` on non-existent row returns success
4. Local side removes it from trash
5. Session vanishes from both local and cloud

**File:** `SupabaseSessionRepository.ts:261-273`
```typescript
async update(session: Session): Promise<void> {
  const { data, error } = await client
    .from(this.tableName)
    .update(updates)
    .eq('id', session.id)
    .select();

  if (error) throw new Error(...);
  
  // ❌ WARNING: Update succeeded but no rows affected!
  // This means the session doesn't exist in Supabase
  if (!data || data.length === 0) {
    console.warn('Update succeeded but no rows affected - possible RLS policy issue');
    // But we don't throw or retry - session is already updated locally!
  }
}
```

### Root Cause #3: Permanently Delete Silently Succeeds on Missing Sessions
**File:** `SupabaseSessionRepository.ts:480-497`
```typescript
async permanentlyDelete(sessionId: string): Promise<void> {
  const { error } = await client
    .from(this.tableName)
    .delete()
    .eq('id', sessionId);

  if (error) throw new Error(...);
  // ❌ If session doesn't exist, delete returns success with no error!
}
```

### Root Cause #4: Sync Manager Doesn't Validate Session Exists in Cloud
**File:** `SyncManager.ts:198-218`
```typescript
async downloadSession(sessionId: string): Promise<...> {
  const session = await this.remoteRepository.findById(sessionId);
  if (!session) {
    return { success: false, error: 'Session not found in cloud' };
  }
  // If session exists in trash locally but not in cloud repo,
  // it won't be downloaded but also won't be cleaned up locally
}
```

**During syncAllFromCloud:**
```typescript
// Sessions deleted in cloud but still in local trash won't be synced
const wasDeleted = await this.deletedTracker.isDeleted(remoteSession.id);
if (wasDeleted) {
  console.log(`Skipping download of session ${remoteSession.id}`);
  continue;
}
// ❌ No mechanism to clean up sessions that exist in local trash
// but don't exist in cloud
```

---

## 4. DeletedSessionsTracker - Orphaned Prevention

**File:** `DeletedSessionsTracker.ts`

**Purpose:** Prevent deleted sessions from being re-downloaded during sync

**How it works:**
1. When session is deleted: `markAsDeleted(sessionId)` → adds to `deleted-sessions.json`
2. During sync: Check `isDeleted(sessionId)` before downloading
3. When restored: `remove(sessionId)` → removes from tracker

**Problem:** 
- If restore fails in cloud but succeeds locally, tracker is updated
- Next sync won't know the session should have been in trash
- Session is lost because it's no longer in tracker and no longer in cloud

---

## 5. Issue with Soft Delete + Sync Interaction

### The Gap: Local vs Cloud State

| Action | Local | Cloud | Tracker | Result |
|--------|-------|-------|---------|--------|
| Delete | ❌ (deletedAt set) | ❌ (deleted_at set) | ✓ (marked) | ✓ OK |
| Restore attempt, cloud fails | ✓ (deletedAt = null) | ❌ (still deleted) | ✗ (removed) | 🔴 STUCK |
| Empty trash | ✗ (delete JSON) | ❌ (if exists) | N/A | 🔴 STUCK if not in cloud |

### Critical Timing Issue
```
Sequence that breaks:
1. Delete session
   - FileSessionRepository: sets deletedAt ✓
   - SupabaseSessionRepository: sets deleted_at ✓
   - DeletedSessionsTracker: marked ✓

2. Cloud sync: Deletes old trash items
   - Supabase deletes rows where deleted_at < 30 days ago
   - FileSessionRepository still has it
   - Tracker still has it

3. User opens trash
   - Sees session in local trash ✓
   - Tries to restore via TrashModal

4. RestoreSessionUseCase.execute()
   - localRepository.restore(sessionId) ✓
   - remoteRepository.restore(sessionId) → No error but no rows updated!
   - deletedTracker.remove(sessionId) ✓

5. Session is now:
   - Not in local trash (deleted_at = null)
   - Not in cloud (already deleted)
   - Not in tracker (removed from tracking)
   - 🔴 LOST FOREVER
```

---

## 6. Error Handling Gaps Summary

### Gap #1: No Validation of Cloud Session Existence During Restore
**Location:** `RestoreSessionUseCase.ts` & `SupabaseSessionRepository.ts:409`

**Problem:** When restoring a session that was permanently deleted from cloud:
- Supabase `update()` returns success even if 0 rows affected
- No error is thrown
- Session is removed from local trash
- Session is gone forever

**Should be detected by:** `findById()` before restore attempt, but restore doesn't check

### Gap #2: Permanent Delete Doesn't Check if Session Exists
**Location:** `PermanentlyDeleteSessionUseCase.ts:33-36`

```typescript
let session;
try {
  session = await this.sessionRepository.findById(sessionId);
} catch (error) {
  console.warn('Could not load session for permanent deletion, will try to delete anyway');
  // 🔴 Proceeds anyway even though we can't verify the session
}
```

**Result:** If `findById()` returns null (session doesn't exist), we still try to permanently delete

### Gap #3: Sync Manager Doesn't Detect Sessions Lost to Cloud Cleanup
**Location:** `SyncManager.ts:225-271`

**Problem:** No mechanism to:
- Detect when a trash session has been permanently deleted from Supabase
- Warn user that their trash has been cleaned up
- Recover or notify about lost sessions

### Gap #4: Update Returns Success for Non-Existent Rows
**Location:** `SupabaseSessionRepository.ts:261-273`

```typescript
if (!data || data.length === 0) {
  console.warn('Update succeeded but no rows affected - possible RLS policy issue');
  // ❌ Only warns, doesn't retry or throw
  // Calling code assumes update succeeded
}
```

---

## 7. Data Flow Summary

```
┌─────────────────────────────────────────────────────────────┐
│                     Session Storage                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  FileSessionRepository          SupabaseSessionRepository    │
│  (~/sessions/*.json)            (sessions table)             │
│                                                               │
│  - id, title, notes             - id, title, notes           │
│  - recordingPath                - user_id (RLS)              │
│  - deletedAt (soft delete)       - deleted_at (soft delete) │
│  - userId                        - cloudId                    │
│  - syncStatus                    - syncStatus                │
│                                                               │
│  Local validation:               Cloud validation:           │
│  - Not used by repos             - RLS policy checks         │
│  - Manual checks in use cases    - user_id in session        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                              ↑
                    Sync coordination
                              ↓
        ┌─────────────────────────────────┐
        │    DeletedSessionsTracker        │
        │  (deleted-sessions.json)         │
        │                                  │
        │  Tracks: Set<sessionId>          │
        │  Purpose: Prevent re-download    │
        │  Issue: Doesn't sync with cloud  │
        └─────────────────────────────────┘
```

---

## 8. Missing Validations

1. **Session existence check before restore** - Should verify in cloud first
2. **Confirmation on zero-row update** - Should treat as error
3. **Trash cleanup coordination** - No tracking of auto-deleted trash items
4. **RLS policy validation** - Should check user_id matches current user
5. **Orphaned session detection** - No detection of sessions lost to cloud cleanup

---

## 9. File Location Reference

### Key Files:
- **Repositories:** `/src/infrastructure/repositories/`
  - `FileSessionRepository.ts` (local file storage)
  - `SupabaseSessionRepository.ts` (cloud storage)

- **Use Cases:** `/src/application/use-cases/`
  - `DeleteSessionUseCase.ts` (soft delete)
  - `RestoreSessionUseCase.ts` (restore from trash)
  - `PermanentlyDeleteSessionUseCase.ts` (hard delete)
  - `GetDeletedSessionsUseCase.ts` (list trash)

- **Tracking:** `/src/infrastructure/services/`
  - `DeletedSessionsTracker.ts` (prevent re-download)
  - `SyncManager.ts` (sync coordination)

- **UI:** `/src/renderer/components/`
  - `TrashModal.ts` (trash UI)

---

## Summary

**Root Cause:** Supabase returns success for updates/deletes on non-existent rows, and the use cases don't validate that operations actually affected rows. When a session is deleted from Supabase (externally or by TTL), attempting to restore it from trash appears to succeed but actually succeeds in the UI while failing silently in the backend.

**Why Sessions Get Stuck:**
1. Session exists in local trash (`deletedAt` is set)
2. Session no longer exists in Supabase (deleted or expired)
3. Restore attempt doesn't validate session exists in cloud
4. Supabase returns no error for non-existent row
5. Local system thinks restoration succeeded
6. Session is removed from trash locally and tracker
7. Session is now lost because it's gone from both local trash and cloud

