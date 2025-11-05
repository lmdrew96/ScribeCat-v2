# Phase 5: Integration & Completion

## Overview
Phase 5 brings together all the infrastructure built in Phases 1-4 to create a fully functional cloud-enabled, collaborative note-taking experience.

## What We Have (Phases 1-4 Complete)
✅ **Phase 1**: Supabase backend setup
✅ **Phase 2**: Cloud sync for sessions
✅ **Phase 3**: Session sharing system (session_shares table)
✅ **Phase 4**: Real-time collaboration infrastructure (Yjs, Realtime, UI components)
✅ **Bonus**: Google OAuth already implemented

## Phase 5 Goals
Integrate all components to enable:
1. Users can sign in with Google
2. Users can create and sync sessions to cloud
3. Users can share sessions with other users (viewer/editor permissions)
4. Multiple users can edit shared sessions in real-time
5. All changes sync automatically via CRDT

---

## Implementation Tasks

### Task 1: Integrate CollaborationManager with TipTap Editor

**File**: `src/renderer/managers/study-mode/StudyModeNotesEditorManager.ts`

**Changes**:
1. Import CollaborationManager and Collaboration extension
2. Check if session is shared when loading
3. If shared with editor permission, enable collaboration:
   - Initialize CollaborationManager
   - Get Yjs document
   - Add Collaboration extension to TipTap
   - Connect to real-time channel

**Example Integration**:
```typescript
import { CollaborationManager } from '../collaboration/CollaborationManager.js';
import Collaboration from '@tiptap/extension-collaboration';
import * as Y from 'yjs';

export class StudyModeNotesEditorManager {
  private collaborationManager: CollaborationManager | null = null;
  private yjsDoc: Y.Doc | null = null;

  async startNotesEdit(sessionId: string, currentNotes: string, isShared: boolean, hasEditorPermission: boolean): Promise<void> {
    // ... existing setup ...

    // Enable collaboration if session is shared
    if (isShared && hasEditorPermission) {
      await this.enableCollaboration(sessionId);
    }

    // Create TipTap editor
    this.notesEditor = new Editor({
      extensions: [
        // ... existing extensions ...

        // Add Collaboration extension if collaborating
        ...(this.yjsDoc ? [
          Collaboration.configure({
            document: this.yjsDoc,
          })
        ] : [])
      ],
      content: currentNotes || '',
      // ... rest of config ...
    });
  }

  private async enableCollaboration(sessionId: string): Promise<void> {
    // Get current user from AuthManager
    const user = await this.authManager.getCurrentUser();
    if (!user) return;

    this.collaborationManager = new CollaborationManager();

    this.yjsDoc = await this.collaborationManager.startCollaboration({
      sessionId,
      userId: user.id,
      userName: user.fullName || user.email,
      userEmail: user.email,
      avatarUrl: user.avatarUrl,
      isSharedSession: true,
      hasEditorPermission: true
    });
  }

  async stopNotesEdit(): Promise<void> {
    // ... existing cleanup ...

    if (this.collaborationManager) {
      await this.collaborationManager.stopCollaboration();
      this.collaborationManager = null;
    }
  }
}
```

---

### Task 2: Add Collaborators UI to Study Mode

**File**: `src/renderer/study-mode.ts`

**Changes**:
1. Add collaborators panel container to HTML
2. Initialize CollaboratorsPanel component
3. Listen for collaboration state changes
4. Update UI when users join/leave

**HTML Addition**:
```html
<!-- Add to study mode HTML -->
<div id="collaborators-panel-container" class="hidden"></div>
```

**JavaScript Integration**:
```typescript
import { CollaboratorsPanel } from './components/CollaboratorsPanel.js';

let collaboratorsPanel: CollaboratorsPanel | null = null;

// When collaboration starts
function onCollaborationStart(collaborationManager: CollaborationManager) {
  // Initialize collaborators panel
  collaboratorsPanel = new CollaboratorsPanel('collaborators-panel-container');
  collaboratorsPanel.show();

  // Listen for state changes
  collaborationManager.onStateChange((state) => {
    collaboratorsPanel?.updateCollaborators(state.activeUsers);
    collaboratorsPanel?.updateConnectionState(state.connectionState);
  });
}
```

---

### Task 3: Wire Session Sharing with Collaboration

**File**: Create `src/renderer/managers/SessionSharingManager.ts`

**Purpose**: Manage sharing sessions and checking permissions

**Key Methods**:
```typescript
export class SessionSharingManager {
  /**
   * Check if current user has access to a session
   */
  async checkSessionAccess(sessionId: string): Promise<{
    hasAccess: boolean;
    permission: 'owner' | 'editor' | 'viewer' | null;
    isShared: boolean;
  }> {
    const user = await this.authManager.getCurrentUser();
    if (!user) return { hasAccess: false, permission: null, isShared: false };

    // Check if user is owner
    const session = await this.loadSession(sessionId);
    if (session.userId === user.id) {
      return { hasAccess: true, permission: 'owner', isShared: false };
    }

    // Check if session is shared with user
    const share = await this.getSessionShare(sessionId, user.id);
    if (share) {
      return {
        hasAccess: true,
        permission: share.permission_level,
        isShared: true
      };
    }

    return { hasAccess: false, permission: null, isShared: false };
  }

  /**
   * Share a session with another user
   */
  async shareSession(params: {
    sessionId: string;
    sharedWithEmail: string;
    permissionLevel: 'viewer' | 'editor';
  }): Promise<{ success: boolean; error?: string }> {
    // Call IPC to create session share
    return await window.scribeCat.sharing.shareSession(params);
  }
}
```

---

### Task 4: Add Sharing UI to Study Mode

**Features to Add**:
1. **Share Button** in study mode toolbar
2. **Share Dialog** modal with:
   - Email input to share with
   - Permission dropdown (Viewer / Editor)
   - List of current shares
   - Revoke access button
3. **Shared Badge** indicator when viewing shared session

**UI Example**:
```html
<button id="share-session-btn" class="toolbar-btn" title="Share Session">
  <span class="btn-icon">👥</span>
</button>

<!-- Share Modal -->
<div id="share-modal" class="modal hidden">
  <div class="modal-content">
    <h3>Share Session</h3>
    <input type="email" id="share-email" placeholder="Enter email address">
    <select id="share-permission">
      <option value="viewer">Viewer</option>
      <option value="editor">Editor</option>
    </select>
    <button id="share-submit-btn">Share</button>

    <h4>Shared With</h4>
    <div id="shares-list"></div>
  </div>
</div>
```

---

### Task 5: Add IPC Handlers for Sharing Operations

**File**: Create `src/main/ipc/handlers/SharingHandlers.ts`

**Methods**:
```typescript
// Share a session
ipcMain.handle('sharing:shareSession', async (event, params) => {
  // Call use case to create share
});

// Get shares for a session
ipcMain.handle('sharing:getSessionShares', async (event, sessionId) => {
  // Fetch shares from Supabase
});

// Revoke access
ipcMain.handle('sharing:revokeAccess', async (event, shareId) => {
  // Delete share from Supabase
});
```

---

### Task 6: Enable Realtime Updates for Shared Sessions

**Changes**:
- When opening a shared session, check permissions
- If has editor permission, enable collaboration
- If viewer permission, enable read-only mode with live updates

**Read-Only Mode**:
```typescript
if (permissionLevel === 'viewer') {
  this.notesEditor.setEditable(false);
  // Still show live updates via Yjs, but user can't edit
}
```

---

### Task 7: Update Session List to Show Shared Sessions

**File**: `src/renderer/components/SessionList.ts`

**Changes**:
1. Fetch both owned and shared sessions
2. Show visual indicator for shared sessions
3. Display share badge and permission level
4. Sort by last updated

**Example Badge**:
```html
<div class="session-item">
  <div class="session-info">
    <h3>Session Title</h3>
    <span class="shared-badge">
      <svg>👥</svg> Shared (Editor)
    </span>
  </div>
</div>
```

---

### Task 8: Add Collaboration CSS to Main App

**File**: `src/renderer/index.html` or CSS imports

**Add**:
```html
<link rel="stylesheet" href="css/collaboration.css">
```

---

### Task 9: Testing Checklist

Test the full collaboration flow:

- [ ] User A signs in with Google
- [ ] User A creates a new session with notes
- [ ] Session syncs to cloud automatically
- [ ] User A shares session with User B's email (editor permission)
- [ ] User B signs in and sees shared session in their list
- [ ] User B opens shared session
- [ ] Collaboration automatically starts
- [ ] Both users can edit simultaneously
- [ ] Changes appear in real-time for both users
- [ ] Cursor positions/presence visible
- [ ] Connection status shows "Connected"
- [ ] Network interruption → shows "Reconnecting" → resumes
- [ ] User A changes permission to "viewer"
- [ ] User B's editor becomes read-only
- [ ] User A revokes access
- [ ] User B loses access to session

---

### Task 10: Run Supabase Migration

Execute the Yjs state migration:

```bash
# In Supabase Dashboard → SQL Editor
# Run: supabase/migrations/004_yjs_state.sql
```

---

## Implementation Order

1. ✅ **Phase 4 Infrastructure** (Complete)
   - Yjs provider
   - Realtime service
   - CollaborationManager
   - CollaboratorsPanel

2. **Integration** (This Phase)
   1. Integrate CollaborationManager with TipTap
   2. Add sharing UI (share button, modal, permissions)
   3. Add IPC handlers for sharing
   4. Wire session list to show shared sessions
   5. Add collaborators panel to study mode
   6. Enable real-time updates based on permissions

3. **Testing & Polish**
   - Multi-client testing
   - Error handling
   - Loading states
   - Edge cases (network issues, permission changes)

---

## Key Files to Modify

### Renderer
- `src/renderer/managers/study-mode/StudyModeNotesEditorManager.ts` - Add collaboration
- `src/renderer/study-mode.ts` - Add collaborators UI
- `src/renderer/components/SessionList.ts` - Show shared sessions
- `src/renderer/managers/SessionSharingManager.ts` - **New file**

### Main Process
- `src/main/ipc/handlers/SharingHandlers.ts` - **New file**
- `src/main/main.ts` - Register sharing handlers

### Preload
- `src/preload/preload.ts` - Expose sharing APIs

---

## Estimated Timeline

- Task 1-2 (TipTap + UI integration): 3-4 hours
- Task 3-4 (Sharing manager + UI): 3-4 hours
- Task 5 (IPC handlers): 1-2 hours
- Task 6-7 (Realtime updates + session list): 2-3 hours
- Task 8-9 (CSS + testing): 2-3 hours
- **Total**: 11-16 hours

---

## Success Criteria

✅ Users can sign in with Google
✅ Sessions auto-sync to cloud
✅ Users can share sessions via email
✅ Multiple users can edit simultaneously
✅ Real-time updates visible to all collaborators
✅ Permissions enforced (viewer can't edit)
✅ Presence tracking shows active users
✅ Network resilience (auto-reconnect)

---

*This completes the full collaborative note-taking system!*
