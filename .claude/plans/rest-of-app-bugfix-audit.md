# ScribeCat Rest-of-App Bug Audit

## Overview
Audit of remaining components outside StudyQuest and Study Rooms.
Found 9 issues: 1 critical, 2 high, 4 medium, 2 low.

---

## 🔴 CRITICAL (1 issue)

### Issue #1: BreakReminders Property Name Typo Causes Runtime Errors
**File:** `src/renderer/components/BreakReminders.ts`
**Lines:** ~47, ~151, ~272, ~440

**Problem:** Property `breaksaken` is misspelled (should be `breaksTaken`), but code elsewhere references `breaksTaken`. This causes undefined property access.

**Evidence:**
```typescript
// Line ~47: Interface defines wrong name
interface StudySession {
  breaksTaken: number;  // Wait, actually this IS correct in interface...
}

// Line ~151: But assignment uses typo!
instance.currentSession = {
  startTime: Date.now(),
  lastBreakTime: Date.now(),
  totalStudyTime: 0,
  breaksaken: 0,  // ❌ TYPO! Should be breaksTaken
  sessionDate: new Date().toISOString()
};

// Line ~272: recordBreak() uses correct name
instance.currentSession.breaksTaken++;  // ❌ This fails - property doesn't exist!

// Line ~440: displayBreakReminder uses correct name
const messageIndex = this.config.pomodoroMode && this.currentSession?.breaksTaken % 4 === 0
```

**Impact:** Runtime errors when recording breaks. The `breaksTaken` property will always be `undefined`, and `undefined++` = `NaN`, breaking pomodoro cycle detection.

**Fix:** Change line ~151:
```typescript
instance.currentSession = {
  startTime: Date.now(),
  lastBreakTime: Date.now(),
  totalStudyTime: 0,
  breaksTaken: 0,  // ✓ Fix typo
  sessionDate: new Date().toISOString()
};
```

Also check `loadSession()` for same issue.

---

## 🟠 HIGH (2 issues)

### Issue #2: StudyBuddyWidget Global Event Listeners Never Removed
**File:** `src/renderer/components/StudyBuddyWidget.ts`
**Lines:** ~360-362

**Problem:** Global document event listeners for activity tracking are added but never removed on unmount.

**Code:**
```typescript
private setupEventListeners(): void {
  // ... other listeners ...
  
  // Activity tracking from global events
  document.addEventListener('keydown', () => this.recordActivity());  // ❌ Never removed
  document.addEventListener('mousedown', () => this.recordActivity());  // ❌ Never removed
}

unmount(): void {
  StudyBuddyManager.stop();
  this.buddyCanvas?.stop();
  // ... intervals cleared ...
  this.container.remove();
  // ❌ Missing: removeEventListener for document listeners!
}
```

**Impact:** Memory leak. If widget is unmounted/remounted, duplicate listeners accumulate. Each key/mouse event fires multiple `recordActivity()` calls.

**Fix:**
```typescript
private activityAbortController: AbortController | null = null;

private setupEventListeners(): void {
  this.activityAbortController = new AbortController();
  
  document.addEventListener('keydown', () => this.recordActivity(), 
    { signal: this.activityAbortController.signal });
  document.addEventListener('mousedown', () => this.recordActivity(), 
    { signal: this.activityAbortController.signal });
}

unmount(): void {
  this.activityAbortController?.abort();
  // ... rest of cleanup
}
```

---

### Issue #3: StudyBuddyWidget Custom Position Never Loaded
**File:** `src/renderer/components/StudyBuddyWidget.ts`
**Lines:** ~64, ~485-495

**Problem:** `loadCustomPosition()` method exists but is never called. User's drag position is lost on reload.

**Code:**
```typescript
constructor() {
  this.settings = this.loadSettings();
  // ❌ Missing: this.customPosition = this.loadCustomPosition();
  
  // Create container...
}

// This method exists but is never used!
private loadCustomPosition(): { x: number; y: number } | null {
  try {
    const saved = localStorage.getItem('study-buddy-position');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    logger.warn('Failed to load position:', error);
  }
  return null;
}
```

**Impact:** User experience issue. Custom widget position doesn't persist across sessions despite position being saved.

**Fix:** Add to constructor:
```typescript
constructor() {
  this.settings = this.loadSettings();
  this.customPosition = this.loadCustomPosition();  // Add this line
  // ...
}
```

---

## 🟡 MEDIUM (4 issues)

### Issue #4: MessagesView Listener Never Unsubscribed
**File:** `src/renderer/components/MessagesView.ts`
**Lines:** ~30-36

**Problem:** Messages change listener is added in constructor but never removed. No destroy/cleanup method exists.

**Code:**
```typescript
constructor(container: HTMLElement, messagesManager: MessagesManager, friendsManager?: FriendsManager) {
  this.container = container;
  this.messagesManager = messagesManager;
  this.friendsManager = friendsManager || null;

  // Listen for changes - NEVER UNSUBSCRIBED
  this.messagesManager.addMessagesChangeListener(() => {
    if (this.currentView === 'inbox' || this.currentView === 'sent') {
      this.render();
    }
  });
}
// ❌ No destroy() method to remove listener
```

**Impact:** If MessagesView is recreated (e.g., on route change), old listeners persist and may try to render into stale containers.

**Fix:** Add destroy method:
```typescript
private messagesChangeListener: (() => void) | null = null;

constructor(...) {
  // ...
  this.messagesChangeListener = () => {
    if (this.currentView === 'inbox' || this.currentView === 'sent') {
      this.render();
    }
  };
  this.messagesManager.addMessagesChangeListener(this.messagesChangeListener);
}

destroy(): void {
  if (this.messagesChangeListener) {
    this.messagesManager.removeMessagesChangeListener(this.messagesChangeListener);
    this.messagesChangeListener = null;
  }
}
```

---

### Issue #5: AuthScreen Username Debounce Timer Type
**File:** `src/renderer/components/AuthScreen.ts`
**Line:** ~163

**Problem:** `usernameCheckTimeout` uses `number` type but `window.setTimeout` returns different types in different contexts.

**Code:**
```typescript
let usernameCheckTimeout: number | null = null;  // ❌ Should be ReturnType<typeof setTimeout>

usernameInput?.addEventListener('input', () => {
  // ...
  if (usernameCheckTimeout) {
    clearTimeout(usernameCheckTimeout);
  }

  usernameCheckTimeout = window.setTimeout(async () => {  // ❌ Type mismatch possible
    // ...
  }, 500);
});
```

**Impact:** TypeScript type safety issue. Could cause compilation errors with strict settings.

**Fix:**
```typescript
let usernameCheckTimeout: ReturnType<typeof setTimeout> | null = null;
```

---

### Issue #6: MessagesView renderAvatar Edge Case
**File:** `src/renderer/components/MessagesView.ts`
**Lines:** ~400-410

**Problem:** Same `getInitials` edge case as identified in Study Rooms - empty name causes crash.

**Code:**
```typescript
private renderAvatar(message: MessageData, view: 'inbox' | 'sent'): string {
  // ...
  const name = view === 'inbox'
    ? (message.senderFullName || message.senderUsername || message.senderEmail)
    : (message.recipientFullName || message.recipientUsername || message.recipientEmail);

  // This can crash if all are empty/null
  const initials = name
    ? name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()  // ❌ n[0] crashes on empty string
    : '??';

  return `<div class="avatar-initials">${initials}</div>`;
}
```

**Fix:**
```typescript
const initials = name && name.trim().length > 0
  ? name.trim().split(' ').filter(p => p.length > 0).slice(0, 2).map(n => n[0]).join('').toUpperCase() || '??'
  : '??';
```

---

### Issue #7: BreakReminders Session Validation Incomplete
**File:** `src/renderer/components/BreakReminders.ts`
**Lines:** ~595-615

**Problem:** `loadSession()` resets `startTime` and `lastBreakTime` to `now` when loading a valid session. This loses historical tracking data.

**Code:**
```typescript
// Session is valid, but reset startTime to prevent massive time accumulation
// Keep totalStudyTime and other stats, but start fresh timer
this.currentSession = {
  ...session,
  startTime: now, // Reset to current time to fix time calculation
  lastBreakTime: now // Reset last break to prevent immediate reminder
};
```

**Impact:** If user closes app during a study session and reopens, their accumulated time in `totalStudyTime` is preserved but the "time since last break" calculation restarts from 0. This is arguably intentional but could cause confusion.

**Note:** This is more of a design question than a bug. Document behavior or make it configurable.

---

## 🔵 LOW (2 issues)

### Issue #8: Dead Code - showOAuthInstructions
**File:** `src/renderer/components/AuthScreen.ts`
**Lines:** ~235-280

**Problem:** `showOAuthInstructions()` method exists but is never called. The OAuth flow now uses a floating window approach instead.

**Impact:** Dead code increases bundle size and maintenance burden. Should be removed or the floating window approach should call it.

---

### Issue #9: Console Log Pollution in MessagesView
**File:** `src/renderer/components/MessagesView.ts`

**Problem:** No debug console.logs found in this file, but there's inconsistent error handling - some errors show `alert()`, others use `console.error()`.

**Impact:** Inconsistent UX. Should use a consistent error notification approach (e.g., toast notifications).

---

---

## Additional Issues Found (Supplemental)

### Issue #10: ColorPicker Document Listener Never Removed
**File:** `src/renderer/components/editor/ColorPicker.ts`
**Lines:** ~145-155

**Problem:** `createColorPickerButton()` adds a document click handler but never removes it.

**Code:**
```typescript
const closeHandler = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  if (!button.contains(target) && !palette.contains(target)) {
    palette.classList.remove('show');
  }
};

document.addEventListener('click', closeHandler);  // ❌ Never removed!

return { button, palette };
```

**Impact:** Memory leak. Each color picker button created accumulates permanent document listeners.

**Severity:** Medium

**Fix:** Return cleanup function or use AbortController:
```typescript
const abortController = new AbortController();
document.addEventListener('click', closeHandler, { signal: abortController.signal });
return { button, palette, cleanup: () => abortController.abort() };
```

---

### Issue #11: FriendsModal Listeners Never Unsubscribed
**File:** `src/renderer/components/FriendsModal.ts`
**Lines:** ~52-58

**Problem:** Friends and requests listeners are added but never removed.

**Code:**
```typescript
constructor(friendsManager: FriendsManager, messagesManager?: MessagesManager) {
  // ...
  this.friendsManager.addFriendsListener(() => this.refreshCurrentTab());  // ❌ Never removed
  this.friendsManager.addRequestsListener(() => this.refreshCurrentTab());  // ❌ Never removed
  
  if (this.messagesManager) {
    this.messagesManager.addUnreadCountListener((count) => this.updateMessagesBadge(count));  // ❌ Never removed
  }
}
```

**Impact:** If FriendsModal is recreated, stale listeners persist.

**Severity:** Medium

---

### Issue #12: CommandPalette Global Listener Never Removed
**File:** `src/renderer/components/CommandPalette.ts`
**Lines:** ~130-145

**Problem:** Global Cmd+K listener added but never removed.

**Code:**
```typescript
private setupKeyboardListener(): void {
  document.addEventListener('keydown', (e) => {  // ❌ Never removed
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      this.toggle();
    }
    // ...
  });
}
```

**Impact:** If CommandPalette is recreated, duplicate listeners fire. Pressing Cmd+K toggles multiple times.

**Severity:** Medium

---

### Issue #13: AccountSettingsModal getInitials Edge Case
**File:** `src/renderer/components/AccountSettingsModal.ts`
**Lines:** ~215-225

**Problem:** Same `getInitials` edge case - empty string array element access.

**Code:**
```typescript
private getInitials(fullName?: string, email?: string): string {
  if (fullName) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();  // ❌ parts[0] could be empty
    }
    return fullName.substring(0, 2).toUpperCase();
  }
  // ...
}
```

**Impact:** Crash if fullName is whitespace-only (e.g., "   ").

**Severity:** Medium

---

## Files Summary

| File | Issues |
|------|--------|
| `BreakReminders.ts` | #1 (Critical), #7 |
| `StudyBuddyWidget.ts` | #2, #3 |
| `MessagesView.ts` | #4, #6, #9 |
| `AuthScreen.ts` | #5, #8 |
| `ColorPicker.ts` | #10 |
| `FriendsModal.ts` | #11 |
| `CommandPalette.ts` | #12 |
| `AccountSettingsModal.ts` | #13 |

---

## Priority Order for Fixes

1. **#1 (Critical)**: BreakReminders `breaksaken` typo - runtime errors
2. **#2 (High)**: StudyBuddyWidget global listeners - memory leak
3. **#3 (High)**: StudyBuddyWidget position not loaded - broken feature
4. **#4 (Medium)**: MessagesView listener leak
5. **#5 (Medium)**: AuthScreen timer type
6. **#6 (Medium)**: MessagesView avatar crash
7. **#10 (Medium)**: ColorPicker listener leak
8. **#11 (Medium)**: FriendsModal listeners leak
9. **#12 (Medium)**: CommandPalette global listener
10. **#13 (Medium)**: AccountSettingsModal getInitials
11. **#7 (Medium)**: BreakReminders session reset behavior
12. **#8 (Low)**: Dead OAuth code
13. **#9 (Low)**: Inconsistent error handling

---

## Quick Fix Code Snippets

### Fix #1 - BreakReminders Typo
```typescript
// In BreakReminders.ts, line ~151
instance.currentSession = {
  startTime: Date.now(),
  lastBreakTime: Date.now(),
  totalStudyTime: 0,
  breaksTaken: 0,  // Was: breaksaken
  sessionDate: new Date().toISOString()
};
```

### Fix #2 - StudyBuddyWidget Listeners
```typescript
// Add property
private activityAbortController: AbortController | null = null;

// In setupEventListeners()
this.activityAbortController = new AbortController();
document.addEventListener('keydown', () => this.recordActivity(), 
  { signal: this.activityAbortController.signal });
document.addEventListener('mousedown', () => this.recordActivity(), 
  { signal: this.activityAbortController.signal });

// In unmount()
this.activityAbortController?.abort();
```

### Fix #3 - StudyBuddyWidget Position
```typescript
// In constructor
constructor() {
  this.settings = this.loadSettings();
  this.customPosition = this.loadCustomPosition();  // ADD THIS
  // ...
}
```

### Fix #13 - AccountSettingsModal getInitials
```typescript
private getInitials(fullName?: string, email?: string): string {
  if (fullName && fullName.trim().length > 0) {
    const parts = fullName.trim().split(/\s+/).filter(p => p.length > 0);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return fullName.trim().substring(0, Math.min(2, fullName.trim().length)).toUpperCase() || '?';
  }
  if (email && email.length > 0) {
    return email.substring(0, Math.min(2, email.length)).toUpperCase();
  }
  return '?';
}
```

---

## Pattern: Global getInitials Utility

Multiple files have the same `getInitials` issue. Consider extracting to shared utility:

**File:** `src/renderer/utils/formatting.ts`

```typescript
/**
 * Get initials from a name string, safely handling edge cases
 */
export function getInitials(name?: string | null, fallback: string = '??'): string {
  if (!name || name.trim().length === 0) return fallback;
  
  const parts = name.trim().split(/\s+/).filter(p => p.length > 0);
  
  if (parts.length === 0) return fallback;
  
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  
  return parts[0].substring(0, Math.min(2, parts[0].length)).toUpperCase();
}
```

Then update all files to use this shared utility:
- `BrowseRoomsModal.ts`
- `CreateRoomModal.ts`
- `ChatPanel.ts`
- `StudyRoomParticipants.ts`
- `MessagesView.ts`
- `AccountSettingsModal.ts`

---

## Summary

**Total Issues Found: 13**
- Critical: 1
- High: 2
- Medium: 8
- Low: 2

**Main Patterns:**
1. **Memory leaks from unremoved listeners** (#2, #4, #10, #11, #12) - Most common issue
2. **getInitials edge cases** (#6, #13) - Repeated across multiple files
3. **Typos causing runtime errors** (#1) - Critical but rare
4. **Dead/unused code** (#3, #8) - Low priority cleanup
