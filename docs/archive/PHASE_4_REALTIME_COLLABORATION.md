# Phase 4: Real-Time Collaboration - Implementation Guide

## Overview
This document provides a comprehensive guide for implementing real-time collaborative note editing in ScribeCat using Yjs (CRDT) and Supabase Realtime.

## Dependencies Installed ✅
- `yjs` - CRDT library for conflict-free collaborative editing
- `y-prosemirror` - Yjs binding for ProseMirror (TipTap's foundation)
- `lib0` - Utility library for Yjs
- `@tiptap/extension-collaboration` - TipTap's collaboration extension

## Architecture Overview

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  TipTap Editor  │ ←─────→ │  Yjs Document    │ ←─────→ │ Supabase        │
│  (Client A)     │         │  (Shared State)  │         │ Realtime        │
└─────────────────┘         └──────────────────┘         │ Broadcast       │
                                     ↕                    └─────────────────┘
┌─────────────────┐         ┌──────────────────┐                 ↕
│  TipTap Editor  │ ←─────→ │  Yjs Document    │         ┌─────────────────┐
│  (Client B)     │         │  (Shared State)  │ ←─────→ │  Other Clients  │
└─────────────────┘         └──────────────────┘         └─────────────────┘
```

## Implementation Steps

### Step 1: Create SupabaseRealtimeService

**File**: `src/infrastructure/services/supabase/SupabaseRealtimeService.ts`

**Purpose**: Manages Supabase Realtime connections, channels, and broadcasts.

**Key Features**:
- Connect/disconnect from Supabase Realtime
- Subscribe to session-specific channels
- Broadcast Yjs updates to other clients
- Receive updates from other clients
- Handle connection state changes
- Track online presence

**Implementation Notes**:
- Use Supabase's `realtime.channel()` API
- Channel naming: `session:{sessionId}` for isolation
- Event types: `yjs-update`, `yjs-awareness`, `presence`
- Handle reconnection logic with exponential backoff
- Clean up subscriptions on disconnect

### Step 2: Create Yjs Provider for Supabase

**File**: `src/infrastructure/services/collaboration/SupabaseYjsProvider.ts`

**Purpose**: Bridges Yjs documents with Supabase Realtime for synchronization.

**Key Responsibilities**:
1. Initialize Yjs document for a session
2. Listen for local Yjs updates and broadcast via Supabase
3. Receive remote updates and apply to local Yjs document
4. Manage awareness (cursor positions, selections, user info)
5. Handle connection lifecycle
6. Persist Yjs state to Supabase for persistence

**Core Logic**:
```typescript
import * as Y from 'yjs'
import { SupabaseRealtimeService } from '../supabase/SupabaseRealtimeService.js'

export class SupabaseYjsProvider {
  private doc: Y.Doc
  private realtimeService: SupabaseRealtimeService
  private awareness: Awareness
  private sessionId: string

  constructor(sessionId: string, doc: Y.Doc) {
    this.sessionId = sessionId
    this.doc = doc
    this.awareness = new Awareness(doc)

    // Set up update listeners
    this.doc.on('update', this.handleLocalUpdate)
    this.awareness.on('change', this.handleAwarenessChange)
  }

  private handleLocalUpdate = (update: Uint8Array, origin: any) => {
    if (origin !== this) {
      // Broadcast to other clients
      this.realtimeService.broadcast('yjs-update', {
        update: Array.from(update)
      })
    }
  }

  private handleRemoteUpdate(update: number[]) {
    // Apply remote update to local doc
    Y.applyUpdate(this.doc, new Uint8Array(update), this)
  }
}
```

### Step 3: Integrate with TipTap Editor

**File**: Modify `src/renderer/managers/study-mode/StudyModeNotesEditorManager.ts`

**Changes Required**:
1. Import Yjs and collaboration extensions
2. Create Yjs document when opening a shared session
3. Initialize SupabaseYjsProvider
4. Add Collaboration extension to TipTap
5. Configure awareness for presence

**Example Configuration**:
```typescript
import { Editor } from '@tiptap/core'
import Collaboration from '@tiptap/extension-collaboration'
import * as Y from 'yjs'

// In session load:
const ydoc = new Y.Doc()
const provider = new SupabaseYjsProvider(sessionId, ydoc)

const editor = new Editor({
  extensions: [
    // ... existing extensions
    Collaboration.configure({
      document: ydoc,
    }),
  ],
  // ... rest of config
})
```

### Step 4: Implement Presence System

**File**: `src/renderer/managers/collaboration/PresenceManager.ts`

**Features**:
- Track users currently viewing/editing a session
- Display user avatars and names
- Show typing indicators
- Handle users joining/leaving
- Update UI in real-time

**Data Structure**:
```typescript
interface UserPresence {
  userId: string
  userName: string
  userEmail: string
  avatarUrl?: string
  color: string  // For cursor color
  cursor?: {
    anchor: number
    head: number
  }
  lastActive: Date
}
```

### Step 5: Add Collaborators UI

**File**: `src/renderer/components/CollaboratorsPanel.ts`

**UI Components**:
1. **Active Users List**
   - Avatar/initials
   - Name
   - Online indicator (green dot)
   - Role (owner/editor/viewer)

2. **User Cursors in Editor**
   - Colored cursor/selection overlay
   - Username label
   - Follow user button

3. **Typing Indicator**
   - Show when remote users are typing
   - Display near their cursor

**CSS** (add to `src/renderer/css/collaboration.css`):
```css
.collaborator-cursor {
  position: absolute;
  pointer-events: none;
  border-left: 2px solid var(--user-color);
}

.collaborator-label {
  position: absolute;
  background: var(--user-color);
  color: white;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 11px;
  white-space: nowrap;
}
```

### Step 6: Persist Yjs State to Supabase

**Database Migration** (`supabase/migrations/004_yjs_state.sql`):
```sql
-- Store Yjs document state for persistence
CREATE TABLE yjs_state (
  session_id UUID PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  state_vector BYTEA NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE yjs_state ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read/write Yjs state for sessions they have access to
CREATE POLICY "Users can manage Yjs state for accessible sessions"
  ON yjs_state
  FOR ALL
  USING (
    session_id IN (
      SELECT id FROM sessions WHERE user_id = auth.uid()
      UNION
      SELECT session_id FROM session_shares WHERE shared_with_user_id = auth.uid()
    )
  );
```

**Implementation**:
- Save Yjs state vector to database periodically (every 30 seconds)
- Load initial state when joining a session
- Use `Y.encodeStateAsUpdate()` to serialize
- Use `Y.applyUpdate()` to deserialize

### Step 7: Handle Connection States

**States to Handle**:
1. **Connecting** - Show spinner
2. **Connected** - Ready for collaboration
3. **Disconnected** - Show offline banner, queue updates
4. **Reconnecting** - Attempt to restore connection
5. **Syncing** - Pulling latest state after reconnection

**UI Indicators**:
- Toast notifications for state changes
- Status badge in editor toolbar
- Disable editing during disconnection (optional)

### Step 8: Enable Realtime in Supabase Dashboard

**Steps**:
1. Go to Supabase Dashboard → Database → Replication
2. Enable replication for `sessions` table
3. Go to API Settings → Realtime
4. Enable Realtime API
5. Configure broadcast settings:
   - Enable `presence`
   - Enable `broadcast`
   - Set message rate limits

### Step 9: Security Considerations

**Authorization**:
```typescript
// Before joining a collaboration session
async function canUserCollaborate(userId: string, sessionId: string): Promise<boolean> {
  // Check if user is owner or has editor permission
  const { data: share } = await supabase
    .from('session_shares')
    .select('permission_level')
    .eq('session_id', sessionId)
    .eq('shared_with_user_id', userId)
    .single()

  if (share?.permission_level === 'editor') return true

  // Check if user is owner
  const { data: session } = await supabase
    .from('sessions')
    .select('user_id')
    .eq('id', sessionId)
    .single()

  return session?.user_id === userId
}
```

**Rate Limiting**:
- Limit broadcast frequency (max 10 updates/second)
- Debounce typing awareness updates
- Batch small updates together

### Step 10: Conflict Resolution

**Yjs Handles This Automatically!**
- Yjs is a CRDT (Conflict-free Replicated Data Type)
- Merges concurrent edits without manual intervention
- Guarantees eventual consistency
- No "merge conflict" dialogs needed

**Edge Cases**:
- Multiple users deleting same content → Deletion wins
- Formatting conflicts → Last edit wins for formatting
- Concurrent inserts → Both inserts preserved, order determined by Yjs algorithm

## Testing Checklist

- [ ] Two users can edit the same session simultaneously
- [ ] Changes from User A appear in User B's editor
- [ ] Cursor positions are visible
- [ ] User list updates when users join/leave
- [ ] Offline edits sync when reconnected
- [ ] No data loss during network interruptions
- [ ] Permissions are enforced (viewers can't edit)
- [ ] Session state persists after all users disconnect
- [ ] Performance is acceptable with 5+ concurrent users

## Performance Optimizations

1. **Lazy Loading**: Only load collaboration features for shared sessions
2. **Update Batching**: Group small updates into larger ones
3. **Compression**: Compress Yjs updates before sending
4. **Throttling**: Limit cursor position updates to 5/second
5. **Connection Pooling**: Reuse Supabase connections across sessions

## Limitations & Future Enhancements

**Current Limitations**:
- No cursor tracking in TipTap v3 (extension not available yet)
- Presence limited to "online/offline" without cursor positions
- No version history/time travel (can be added with Yjs snapshots)

**Future Enhancements**:
- Add cursor tracking when TipTap v3 cursor extension releases
- Implement "Follow User" mode (camera follows another user's cursor)
- Add commenting/annotations on specific text ranges
- Voice chat integration for collaborators
- Live transcription sharing during recording

## Debugging Tips

**Common Issues**:
1. **Updates not syncing**: Check Supabase Realtime is enabled in dashboard
2. **Multiple cursors appearing**: Ensure each client has unique user ID
3. **Performance issues**: Check update frequency, add debouncing
4. **State not persisting**: Verify Yjs state is being saved to database
5. **Connection drops**: Implement reconnection logic with exponential backoff

**Useful Logs**:
```typescript
// Add to provider
ydoc.on('update', (update, origin) => {
  console.log('Yjs update:', { size: update.length, origin })
})

awareness.on('change', ({ added, updated, removed }) => {
  console.log('Awareness change:', { added, updated, removed })
})
```

## Next Steps

1. ✅ Install dependencies (DONE)
2. Create `SupabaseRealtimeService.ts`
3. Create `SupabaseYjsProvider.ts`
4. Modify TipTap editor to use Collaboration extension
5. Add collaborators UI panel
6. Run Supabase migration for Yjs state storage
7. Test with multiple browser windows
8. Deploy and test with real users

## Resources

- [Yjs Documentation](https://docs.yjs.dev/)
- [TipTap Collaboration Guide](https://tiptap.dev/docs/editor/extensions/functionality/collaboration)
- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime)
- [Y-ProseMirror](https://github.com/yjs/y-prosemirror)

## Estimated Timeline

- Supabase Realtime Service: 2-3 hours
- Yjs Provider: 3-4 hours
- TipTap Integration: 2-3 hours
- Presence System: 3-4 hours
- UI Components: 4-5 hours
- Testing & Bug Fixes: 5-8 hours
- **Total**: 19-27 hours of development

---

*Note: This is an advanced feature requiring careful testing. Start with a simple prototype (2 users editing) before scaling to production.*
