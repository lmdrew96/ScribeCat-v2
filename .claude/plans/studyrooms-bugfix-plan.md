# Study Rooms Bug Fix Plan

## Overview
10 issues identified across 12 Study Rooms files. 1 critical, 3 high, 4 medium, 2 low priority.

---

## 🔴 CRITICAL

### Issue #1: ChatPanel Typing Timer Crash After Destroy
**File:** `src/renderer/components/ChatPanel.ts`
**Lines:** ~435-445, ~455-465

**Problem:** If `destroy()` is called while a typing timer is pending, the timer callback fires with `this.currentRoomId!` being `null`, causing a crash.

**Before:**
```typescript
public destroy(): void {
  this.chatManager.unsubscribe();
  if (this.currentRoomId) {
    this.chatManager.clearMessages(this.currentRoomId);
  }
  this.container = null;
  this.currentRoomId = null;
  this.currentUserId = null;
  this.userNames.clear();
}
```

**After:**
```typescript
public destroy(): void {
  // Clear typing timer first to prevent callback after cleanup
  if (this.typingTimer !== null) {
    clearTimeout(this.typingTimer);
    this.typingTimer = null;
  }
  
  this.chatManager.unsubscribe();
  if (this.currentRoomId) {
    this.chatManager.clearMessages(this.currentRoomId);
  }
  this.container = null;
  this.currentRoomId = null;
  this.currentUserId = null;
  this.userNames.clear();
}
```

**Test:** Open chat, start typing, quickly exit room. Should not throw errors.

---

## 🟠 HIGH

### Issue #2: GameIntegration handleGameClosed Called After Cleanup
**File:** `src/renderer/components/study-room/StudyRoomGameIntegration.ts`
**Lines:** ~130-150

**Problem:** `handleGameClosed()` can be called after `cleanup()` due to event listener timing, causing null reference access.

**Before:**
```typescript
async handleGameClosed(): Promise<void> {
  this.hideGameContainer();
  await this.gamesManager.cleanup();

  const room = this.studyRoomsManager.getRoomById(this.currentRoomId!);
  const isHost = room?.hostId === this.currentUserId;

  if (!isHost && this.currentRoomId) {
    console.log('[StudyRoomGameIntegration] Restarting game polling after game closed');
    this.startGamePolling();
  }
}
```

**After:**
```typescript
async handleGameClosed(): Promise<void> {
  // Early return if already cleaned up
  if (!this.currentRoomId || !this.currentUserId) {
    this.hideGameContainer();
    return;
  }
  
  // Store values before cleanup
  const roomId = this.currentRoomId;
  const userId = this.currentUserId;
  
  this.hideGameContainer();
  await this.gamesManager.cleanup();

  const room = this.studyRoomsManager.getRoomById(roomId);
  const isHost = room?.hostId === userId;

  if (!isHost && roomId) {
    console.log('[StudyRoomGameIntegration] Restarting game polling after game closed');
    this.startGamePolling();
  }
}
```

**Test:** Start game, exit room during game, verify no console errors.

---

### Issue #3: AudioPlayer Event Listeners Accumulate
**File:** `src/renderer/components/study-room/StudyRoomAudioPlayer.ts`
**Lines:** ~55-65

**Problem:** `setupSpeedControls()` adds event listeners without cleanup, causing accumulation on repeated calls.

**Before:**
```typescript
export class StudyRoomAudioPlayer {
  private sessionPlaybackManager: SessionPlaybackManager;

  constructor() {
    this.sessionPlaybackManager = new SessionPlaybackManager();
  }

  private setupSpeedControls(audioElement: HTMLAudioElement): void {
    document.querySelectorAll('.speed-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const speed = parseFloat((btn as HTMLElement).dataset.speed || '1');
        audioElement.playbackRate = speed;
        document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }
}
```

**After:**
```typescript
export class StudyRoomAudioPlayer {
  private sessionPlaybackManager: SessionPlaybackManager;
  private speedButtonAbortController: AbortController | null = null;

  constructor() {
    this.sessionPlaybackManager = new SessionPlaybackManager();
  }

  /**
   * Cleanup audio player resources
   */
  cleanup(): void {
    this.speedButtonAbortController?.abort();
    this.speedButtonAbortController = null;
  }

  private setupSpeedControls(audioElement: HTMLAudioElement): void {
    // Cleanup previous listeners
    this.speedButtonAbortController?.abort();
    this.speedButtonAbortController = new AbortController();
    
    document.querySelectorAll('.speed-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const speed = parseFloat((btn as HTMLElement).dataset.speed || '1');
        audioElement.playbackRate = speed;
        document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      }, { signal: this.speedButtonAbortController!.signal });
    });
  }
}
```

**Also update StudyRoomView.ts hide():**
```typescript
public hide(): void {
  // ... existing cleanup ...
  this.audioPlayer.cleanup();  // Add this line
  // ...
}
```

**Test:** Enter room with audio, exit, re-enter. Click speed button once, verify only one speed change.

---

### Issue #4: StudyRoomView Show Doesn't Hide on joinRoom Failure
**File:** `src/renderer/components/StudyRoomView.ts`
**Lines:** ~170-185

**Problem:** If joining room fails, the study room view remains visible in a broken state.

**Before:**
```typescript
try {
  await this.studyRoomsManager.joinRoom(roomId);
} catch (error) {
  console.error('Failed to join room:', error);
  ErrorModal.show('Failed to Join Room', 'Could not join the study room. Please check your connection.');
  if (this.onExit) this.onExit();
  return;
}
```

**After:**
```typescript
try {
  await this.studyRoomsManager.joinRoom(roomId);
} catch (error) {
  console.error('Failed to join room:', error);
  ErrorModal.show('Failed to Join Room', 'Could not join the study room. Please check your connection.');
  this.hide();  // Restore previous view state
  if (this.onExit) this.onExit();
  return;
}
```

**Test:** Mock joinRoom to fail, verify previous view is restored correctly.

---

## 🟡 MEDIUM

### Issue #5: Debug Console.logs in BrowseRoomsModal
**File:** `src/renderer/components/BrowseRoomsModal.ts`
**Lines:** ~470-500

**Fix:** Remove all debug console.log statements in `attachRoomCardListeners()`:

```typescript
private attachRoomCardListeners(): void {
  // Enter room
  const enterButtons = document.querySelectorAll('[data-action="enter"]');

  enterButtons.forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const clickedRoomId = (e.target as HTMLElement).dataset.roomId;

      if (clickedRoomId && this.onJoinRoom) {
        this.close();
        this.onJoinRoom(clickedRoomId);
      }
    });
  });
  // ... rest of method without console.logs
}
```

---

### Issue #6: Unused showJoinButton Parameter
**File:** `src/renderer/components/BrowseRoomsModal.ts`
**Line:** ~330

**Fix:** Remove unused parameter:

```typescript
// Before
private renderRoomCard(room: StudyRoomData, showJoinButton: boolean = false): string {

// After
private renderRoomCard(room: StudyRoomData): string {
```

Also update caller in `renderActiveRooms()`:
```typescript
// Before
container.innerHTML = rooms.map(room => this.renderRoomCard(room, true)).join('');

// After
container.innerHTML = rooms.map(room => this.renderRoomCard(room)).join('');
```

---

### Issue #7: getInitials Edge Case (Multiple Files)
**Files:**
- `src/renderer/components/BrowseRoomsModal.ts`
- `src/renderer/components/CreateRoomModal.ts`
- `src/renderer/components/ChatPanel.ts`
- `src/renderer/components/study-room/StudyRoomParticipants.ts`

**Fix:** Update all implementations:

```typescript
private getInitials(name: string): string {
  if (!name || name.trim().length === 0) return '??';
  const trimmed = name.trim();
  const parts = trimmed.split(' ').filter(p => p.length > 0);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return trimmed.substring(0, Math.min(2, trimmed.length)).toUpperCase();
}
```

**Consider:** Extract to shared utility in `src/renderer/utils/formatting.ts`.

---

### Issue #8: Timer Type Inconsistencies
**Files:**
- `src/renderer/managers/social/StudyRoomsManager.ts`
- `src/renderer/components/ChatPanel.ts`

**Fix StudyRoomsManager.ts:**
```typescript
// Before
private loadRoomsDebounceTimer: NodeJS.Timeout | null = null;
private loadParticipantsDebounceTimers: Map<string, NodeJS.Timeout> = new Map();

// After
private loadRoomsDebounceTimer: ReturnType<typeof setTimeout> | null = null;
private loadParticipantsDebounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
```

**Fix ChatPanel.ts:**
```typescript
// Before
private typingTimer: number | null = null;

// After
private typingTimer: ReturnType<typeof setTimeout> | null = null;
```

---

## 🔵 LOW

### Issue #9: ChatManager destroy() Inconsistent Cleanup
**File:** `src/renderer/managers/social/ChatManager.ts`
**Line:** ~250

**Fix:**
```typescript
public destroy(): void {
  this.unsubscribe();
  this.messages.clear();
  this.currentUserId = null;
  this.currentUserName = null;  // Add this line
}
```

---

### Issue #10: Static Singleton Pattern (No Fix Required)
**File:** `src/renderer/components/study-room/StudyRoomParticipants.ts`

**Note:** This is technical debt, not a bug. Document for future refactoring if multiple simultaneous rooms are ever needed. No immediate fix required.

---

## Files to Modify Summary

| File | Issues |
|------|--------|
| `ChatPanel.ts` | #1, #7, #8 |
| `StudyRoomGameIntegration.ts` | #2 |
| `StudyRoomAudioPlayer.ts` | #3 |
| `StudyRoomView.ts` | #4 (+ #3 cleanup call) |
| `BrowseRoomsModal.ts` | #5, #6, #7 |
| `CreateRoomModal.ts` | #7 |
| `StudyRoomParticipants.ts` | #7 |
| `StudyRoomsManager.ts` | #8 |
| `ChatManager.ts` | #9 |

---

## Testing Checklist

- [ ] #1: Open chat → type → quickly exit room → no crash
- [ ] #2: Start game → exit room during game → no console errors
- [ ] #3: Enter room with audio → exit → re-enter → click speed once → single speed change
- [ ] #4: Force joinRoom failure → previous view restored correctly
- [ ] #5: No debug logs in console during normal browse rooms usage
- [ ] #7: Pass empty string to getInitials → returns "??" not crash
- [ ] #8: TypeScript compiles without timer type errors
- [ ] #9: Call ChatManager.destroy() → currentUserName is null
