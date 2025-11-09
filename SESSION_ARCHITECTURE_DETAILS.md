# Session Management - Architecture Details & Code Flow

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                           APPLICATION LAYER                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Use Cases:                                                           │
│  ├─ DeleteSessionUseCase           → Sets deletedAt locally + cloud  │
│  ├─ RestoreSessionUseCase          → Clears deletedAt (DANGEROUS!)  │
│  ├─ PermanentlyDeleteSessionUseCase → Hard delete + audio file      │
│  ├─ GetDeletedSessionsUseCase       → Query soft-deleted sessions   │
│  └─ UpdateSessionUseCase            → Update metadata               │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      REPOSITORY LAYER (Interfaces)                   │
├─────────────────────────────────────────────────────────────────────┤
│                        ISessionRepository                             │
│                                                                       │
│  Methods:                                                             │
│  ├─ save(session)           → save/update session                    │
│  ├─ findById(id)            → load session (non-deleted only)       │
│  ├─ findAll()               → list active sessions                   │
│  ├─ update(session)         → update existing session                │
│  ├─ delete(id)              → soft delete (sets deletedAt)          │
│  ├─ restore(id)             → undelete (clears deletedAt) 🔴 BUG    │
│  ├─ findDeleted(userId)     → list trash (where deletedAt IS NOT NULL)│
│  └─ permanentlyDelete(id)   → hard delete (removes row) 🔴 BUG      │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
                    ↙                               ↘
┌──────────────────────────────────┐   ┌──────────────────────────────┐
│ FileSessionRepository             │   │ SupabaseSessionRepository     │
│ (Local File System)               │   │ (Cloud Database)              │
├──────────────────────────────────┤   ├──────────────────────────────┤
│                                  │   │                              │
│ Storage: ~/.scribeCat/sessions/  │   │ Table: sessions              │
│                                  │   │ Columns:                     │
│ Ops:                             │   │ ├─ id (PK)                   │
│ ├─ Read/write JSON files         │   │ ├─ user_id (FK, RLS)         │
│ ├─ Filter by deletedAt field     │   │ ├─ title, notes              │
│ ├─ Filter by userId              │   │ ├─ deleted_at (soft delete)  │
│ ├─ No validation                 │   │ ├─ updated_at, created_at    │
│ ├─ No network dependency         │   │ ├─ has_transcription (flag)  │
│ └─ Always available              │   │ └─ RLS: user_id = current    │
│                                  │   │                              │
│ Issues:                          │   │ Issues:                      │
│ ├─ Can get out of sync with cloud│   │ ├─ restore() on missing row  │
│ ├─ No atomic transactions        │   │ │  → returns success! (BUG) │
│ └─ No consistency checks         │   │ ├─ update() on missing row   │
│                                  │   │ │  → 0 rows, no error (BUG) │
│                                  │   │ ├─ delete() on missing row   │
│                                  │   │ │  → returns success! (BUG) │
│                                  │   │ └─ RLS fails silently        │
│                                  │   │                              │
└──────────────────────────────────┘   └──────────────────────────────┘
                ↓                                     ↓
        Local session files                  Supabase API
        (synchronous)                        (async, error-prone)
```

---

## Trash Session Lifecycle

### 1. Creation
```
New Recording Session
    ↓
FileSessionRepository.save()
    └─ Creates: ~/.scribeCat/sessions/{id}.json
    └─ Sets: createdAt, updatedAt, deletedAt = undefined
    ↓
SyncManager.uploadSession() (if user is logged in)
    └─ SupabaseSessionRepository.save()
        └─ Uploads to: sessions table + Storage
        └─ Sets: user_id, syncStatus = SYNCED
```

### 2. Active Session State
```
Active Session in FileSessionRepository:
{
  id: "session-abc123",
  title: "Lecture 1",
  deletedAt: undefined,  ← Key: undefined = active
  userId: "user-xyz",
  syncStatus: "synced",
  cloudId: "session-abc123"
}

Active Session in Supabase:
{
  id: "session-abc123",
  user_id: "user-xyz",
  title: "Lecture 1",
  deleted_at: null,      ← Key: null = active
  updated_at: "2024-01-15T10:30:00Z"
}
```

### 3. Soft Delete (Move to Trash)
```
User clicks Delete → SessionDeletionManager.deleteSession()
    ↓
DeleteSessionUseCase.execute(sessionId)
    ↓
Step 1: FileSessionRepository.delete(sessionId)
    └─ Load session from JSON
    └─ Set: deletedAt = new Date()
    └─ Write JSON back
    └─ ✓ Session now in local trash
    ↓
Step 2: Check if session was synced
    └─ if (session.cloudId && remoteRepository)
    ↓
Step 3: SupabaseSessionRepository.delete(sessionId)
    └─ UPDATE sessions SET deleted_at = now() WHERE id = ?
    └─ ✓ Session now in cloud trash
    ↓
Step 4: DeletedSessionsTracker.markAsDeleted(sessionId)
    └─ Add to deleted-sessions.json
    └─ ✓ Prevent re-download during sync
    ↓
Trash State:
  FileSession: deletedAt = "2024-01-15T11:00:00Z"
  Supabase:   deleted_at = "2024-01-15T11:00:00Z"
  Tracker:    {sessionId} is marked deleted
```

### 4. View Trash
```
User clicks "View Trash" → TrashModal.show()
    ↓
TrashModal.loadDeletedSessions()
    ↓
GetDeletedSessionsUseCase.execute(userId)
    ↓
Step 1: FileSessionRepository.findDeleted()
    └─ Scan all .json files
    └─ Filter: where deletedAt IS NOT NULL
    └─ Return: array of Session objects
    ↓
Step 2: SupabaseSessionRepository.findDeleted(userId)
    └─ SELECT * FROM sessions
    │  WHERE user_id = ? AND deleted_at IS NOT NULL
    │  ORDER BY deleted_at DESC
    └─ Return: array of Session objects
    ↓
Step 3: Merge results
    └─ Use Map to deduplicate by session ID
    └─ Prefer cloud version if exists in both
    ↓
Step 4: Display in TrashModal
    └─ Show title, deletion date, countdown (30 days)
    └─ Offer restore or permanent delete buttons
```

### 5. Restore from Trash (DANGEROUS PATH)
```
User clicks "Restore" in trash → TrashModal.handleRestore()
    ↓
RestoreSessionUseCase.execute(sessionId)
    ↓
Step 1: FileSessionRepository.restore(sessionId)
    ├─ Load JSON file
    ├─ Set: deletedAt = undefined
    ├─ Write JSON back
    └─ ✓ SUCCESS: Session removed from local trash
    ↓
Step 2: Check if remote repository exists
    ├─ if (remoteRepository)
    └─ ✓ YES: Try to restore in cloud
    ↓
Step 3: SupabaseSessionRepository.restore(sessionId)
    ├─ UPDATE sessions
    │  SET deleted_at = NULL, updated_at = now()
    │  WHERE id = ?
    │
    │ 🔴 PROBLEM HERE:
    │ If session doesn't exist in table:
    │ ├─ Supabase returns { error: null } (no error!)
    │ ├─ No rows are affected (0 affected rows)
    │ └─ We don't check this - we assume success
    │
    └─ Code doesn't validate row count:
        if (error) throw new Error(...);
        // ❌ Missing: if (!data || data.length === 0) throw error
    ↓
Step 4: DeletedSessionsTracker.remove(sessionId)
    ├─ Remove from deleted-sessions.json
    └─ ✓ Session no longer marked deleted
    ↓
Final State (if session missing from cloud):
  FileSession: deletedAt = undefined     ← Removed from trash
  Supabase:   [MISSING - doesn't exist]  ← Still not there!
  Tracker:    [REMOVED]                  ← No longer tracking
  ↓
  RESULT: Session is gone forever!
  (Not in local trash, not in cloud, not being tracked)
```

### 6. Empty Trash (Permanent Delete)
```
User clicks "Empty Trash" → TrashModal.handleEmptyTrash()
    ↓
PermanentlyDeleteSessionUseCase.executeMultiple(sessionIds)
    ↓
For each sessionId:
    ↓
Step 1: Load session for audio path
    └─ FileSessionRepository.findById(sessionId)
    │  ❌ RETURNS NULL (it's in trash, not active list!)
    └─ Proceed anyway with warning message
    ↓
Step 2: Delete audio file
    └─ Skip if session is null
    ↓
Step 3: Hard delete locally
    └─ FileSessionRepository.permanentlyDelete(sessionId)
    └─ fs.unlink(~/.scribeCat/sessions/{id}.json)
    └─ ✓ File removed from disk
    ↓
Step 4: Hard delete from cloud
    └─ SupabaseSessionRepository.permanentlyDelete(sessionId)
    ├─ DELETE FROM sessions WHERE id = ?
    │
    │ 🔴 PROBLEM HERE:
    │ If session doesn't exist in table:
    │ ├─ Supabase returns { error: null } (no error!)
    │ ├─ No rows are deleted
    │ └─ We don't check this - we assume success
    │
    └─ Code doesn't validate:
        if (error) throw new Error(...);
        // ❌ Missing: if (!data || data.length === 0) throw error
    ↓
Final State:
  FileSession: [DELETED]  ← Permanently removed from disk
  Supabase:   [MISSING]   ← Already gone or permanently deleted
  Tracker:    [N/A]       ← Not relevant for hard delete
  ✓ Session is gone
```

---

## Critical Bug: The Silent Failure Pattern

### When does it happen?

```
Scenario A: TTL/Auto-cleanup (Most likely)
─────────────────────────────────────────
1. User deletes session 30 days ago
2. Supabase has TTL that auto-deletes rows where deleted_at < 30 days
3. FileSessionRepository still has the JSON file
4. User tries to restore from trash
5. SupabaseSessionRepository.restore() runs on non-existent row
6. No error thrown
7. Session is lost


Scenario B: Manual deletion in Supabase
───────────────────────────────────────
1. User deletes session
2. Someone manually deletes row from Supabase console
3. FileSessionRepository still has it
4. User tries to restore
5. Same silent failure


Scenario C: Cloud sync cleanup
──────────────────────────────
1. User is offline when they delete
2. When back online, sync processes
3. Supabase cleanup runs (if TTL enabled)
4. Cloud row is gone, local JSON remains
5. User tries to restore
6. Silent failure
```

### Why It's A Bug

```
Expected Behavior:
  restore() called on non-existent session
  → Should throw error: "Session not found in trash"
  → UI should show error message
  → Session remains in trash

Actual Behavior:
  restore() called on non-existent session
  → No error thrown (Supabase returns success)
  → UI shows success
  → Session is removed from local trash AND tracker
  → Session is lost forever
```

---

## Code Flow with Error Points

### FileSessionRepository Methods

```typescript
// ✓ SAFE: Checks if file exists
async findById(sessionId: string): Promise<Session | null> {
  try {
    const data = await fs.readFile(sessionPath, 'utf-8');
    const session = Session.fromJSON(JSON.parse(data));
    
    // ✓ Filters out deleted sessions
    if (session.deletedAt) return null;
    
    return session;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;  // ✓ File not found = returns null, not error
    }
    throw error;
  }
}

// ✓ SAFE: Always succeeds, just marks deletedAt
async delete(sessionId: string): Promise<void> {
  const session = await this.findById(sessionId);
  if (!session) return;  // ✓ Safe to call on non-existent
  session.deletedAt = new Date();
  await this.save(session);
}

// ✓ SAFE: Clears deletedAt field
async restore(sessionId: string): Promise<void> {
  const sessionPath = this.getSessionPath(sessionId);
  const data = await fs.readFile(sessionPath, 'utf-8');
  const session = Session.fromJSON(JSON.parse(data));
  session.deletedAt = undefined;
  await this.save(session);
  // ✓ If file doesn't exist, throws error (expected)
}

// ✓ SAFE: Just unlinks file
async permanentlyDelete(sessionId: string): Promise<void> {
  try {
    await fs.unlink(sessionPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
    // ✓ If already gone, treat as success
  }
}
```

### SupabaseSessionRepository Methods - THE PROBLEM

```typescript
// 🔴 BUG: Doesn't check if session exists
async restore(sessionId: string): Promise<void> {
  const { error } = await client
    .from(this.tableName)
    .update({ deleted_at: null, updated_at: now() })
    .eq('id', sessionId);
  
  if (error) throw new Error(...);
  // ❌ Missing validation:
  // if (!data || data.length === 0) {
  //   throw new Error('Session not found - already deleted from cloud');
  // }
  // ✓ Supabase update() on non-existent row returns no error!
}

// 🔴 BUG: update() doesn't validate affected rows
async update(session: Session): Promise<void> {
  const { data, error } = await client
    .from(this.tableName)
    .update(updates)
    .eq('id', session.id)
    .select();  // select() returns the updated rows
  
  if (error) throw new Error(...);
  
  // ⚠️ WARNING ONLY - doesn't throw
  if (!data || data.length === 0) {
    console.warn('Update succeeded but no rows affected');
    // ❌ Should throw error here!
  }
}

// 🔴 BUG: delete() doesn't check if session existed
async permanentlyDelete(sessionId: string): Promise<void> {
  const { error } = await client
    .from(this.tableName)
    .delete()
    .eq('id', sessionId);
  
  if (error) throw new Error(...);
  // ❌ Missing: check if any rows were actually deleted
  // Supabase delete() on non-existent row returns no error!
}
```

---

## Integration Points

### IPC Handlers → Use Cases

```
Renderer Process               Main Process
(TrashModal)                   (IPC Handler)
    │                              │
    ├─ scribeCat.session.getDeleted()
    │                          GetDeletedSessionsUseCase
    │                          ├─ localRepository.findDeleted()
    │                          └─ remoteRepository.findDeleted()
    │                              
    ├─ scribeCat.session.restore()
    │                          RestoreSessionUseCase
    │                          ├─ localRepository.restore() ✓
    │                          ├─ remoteRepository.restore() 🔴
    │                          └─ deletedTracker.remove()
    │
    └─ scribeCat.session.permanentlyDelete()
                              PermanentlyDeleteSessionUseCase
                              ├─ Delete audio file
                              ├─ localRepository.permanentlyDelete() ✓
                              └─ remoteRepository.permanentlyDelete() 🔴
```

---

## Summary of Problems

| Component | Problem | Severity | Impact |
|-----------|---------|----------|--------|
| SupabaseSessionRepository.restore() | No validation of row count | CRITICAL | Silent failure, session lost |
| SupabaseSessionRepository.update() | Warns but doesn't error | HIGH | Can proceed with failed update |
| SupabaseSessionRepository.permanentlyDelete() | No validation of row count | CRITICAL | Silent failure on non-existent sessions |
| RestoreSessionUseCase | No pre-check if session exists | CRITICAL | Doesn't catch repository failures |
| PermanentlyDeleteSessionUseCase | Doesn't validate load result | HIGH | Proceeds even if can't load session |
| SyncManager.syncAllFromCloud() | No cleanup of orphaned trash | HIGH | Lost sessions can't be detected |
| DeletedSessionsTracker | No cloud sync | MEDIUM | Out of sync during failures |

