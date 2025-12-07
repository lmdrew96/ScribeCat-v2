# StudyQuest Bug Fix Plan for Claude Code

## Overview

This document provides a comprehensive plan to fix 8 bugs identified in the StudyQuest refactored codebase. Issues are ordered by priority (critical first).

**Repository:** `lmdrew96/ScribeCat-v2`  
**Branch:** `main`  
**Date:** December 7, 2025

---

## Issue #1: DungeonHandler `battleHandler` Reference Doesn't Exist [CRITICAL]

### Problem
In `StudyQuestDungeonHandler.ts`, the `onEnemyEncounter` callback tries to access `this.battleHandler`, but `battleHandler` lives on the Modal, not the DungeonHandler. The boss flag is never set for Explore mode battles.

### File
`src/renderer/components/studyquest/handlers/StudyQuestDungeonHandler.ts`

### Current Code (lines ~160-168)
```typescript
onEnemyEncounter: async (enemyData: any, isBoss: boolean) => {
  // Delegate to battle handler via callback
  const battleHandler = (this as any).battleHandler;  // ❌ Doesn't exist
  if (battleHandler) {
    battleHandler.setIsCurrentBattleBoss(isBoss);
  }
  const battle = await this.manager.startBattle(isBoss);
  if (battle) {
    this.callbacks.showView('battle');
  }
},
```

### Solution
Add a new callback `setBattleBossFlag` to `DungeonHandlerCallbacks` interface and use it instead of direct access.

### Step 1: Update types.ts
**File:** `src/renderer/components/studyquest/handlers/types.ts`

Add to `DungeonHandlerCallbacks` interface:
```typescript
export interface DungeonHandlerCallbacks extends HandlerCallbacks {
  getDungeonExploreView: () => DungeonExploreView | null;
  setDungeonExploreView: (view: DungeonExploreView | null) => void;
  getBattleCanvas: () => BattleCanvas | null;
  getSelectedColor: () => CatColor;
  setBattleBossFlag: (isBoss: boolean) => void;  // ADD THIS LINE
}
```

### Step 2: Update Modal to provide the callback
**File:** `src/renderer/components/StudyQuestModal.ts`

Find where `dungeonHandler` is initialized (around line 115) and add the callback:
```typescript
// Dungeon handler
this.dungeonHandler = new StudyQuestDungeonHandler(this.container, this.manager, {
  ...baseCallbacks,
  getDungeonExploreView: () => this.dungeonHandler?.getDungeonExploreView() || null,
  setDungeonExploreView: () => {}, // Managed internally
  getBattleCanvas: () => this.battleHandler?.getBattleCanvas() || null,
  getSelectedColor: () => this.characterHandler?.getSelectedColor() || 'brown',
  setBattleBossFlag: (isBoss: boolean) => this.battleHandler?.setIsCurrentBattleBoss(isBoss),  // ADD THIS LINE
});
```

### Step 3: Update DungeonHandler to use the callback
**File:** `src/renderer/components/studyquest/handlers/StudyQuestDungeonHandler.ts`

Replace the `onEnemyEncounter` callback (around line 160):
```typescript
onEnemyEncounter: async (enemyData: any, isBoss: boolean) => {
  // Set boss flag via callback to Modal's battleHandler
  this.callbacks.setBattleBossFlag(isBoss);
  const battle = await this.manager.startBattle(isBoss);
  if (battle) {
    this.callbacks.showView('battle');
  }
},
```

---

## Issue #2: Item Use Doesn't Display Enemy Turn [CRITICAL]

### Problem
When using an item in battle, the manager's `useItemInBattle()` returns only a boolean. The handler can't access the battle result (playerLog, enemyLog), so the enemy's turn is never displayed.

### Files
- `src/renderer/managers/StudyQuestManager.ts`
- `src/renderer/components/studyquest/handlers/StudyQuestBattleHandler.ts`

### Solution
Change manager's `useItemInBattle()` to return the full battle result, then update the handler to display both player and enemy actions.

### Step 1: Update Manager's useItemInBattle return type
**File:** `src/renderer/managers/StudyQuestManager.ts`

Find `useItemInBattle` method (around line 490) and change it:

**FROM:**
```typescript
async useItemInBattle(itemId: string): Promise<boolean> {
```

**TO:**
```typescript
async useItemInBattle(itemId: string): Promise<{
  success: boolean;
  battle?: StudyQuestBattleData;
  playerLog?: BattleLogEntry;
  enemyLog?: BattleLogEntry | null;
} | null> {
```

Then update the method body to return the full result:

**FROM (around line 524):**
```typescript
// Execute battle action with item effect
const result = await this.battleAction('item', { healing });
if (!result) {
  return false;
}

// Decrement item quantity (use the item)
await this.useItem(itemId);

return true;
```

**TO:**
```typescript
// Execute battle action with item effect
const result = await this.battleAction('item', { healing });
if (!result) {
  return { success: false };
}

// Decrement item quantity (use the item)
await this.useItem(itemId);

return {
  success: true,
  battle: result.battle,
  playerLog: result.playerLog,
  enemyLog: result.enemyLog,
};
```

### Step 2: Update BattleHandler to use the new return value
**File:** `src/renderer/components/studyquest/handlers/StudyQuestBattleHandler.ts`

Find `useItemInBattle` method (around line 390) and replace the entire method:

```typescript
/**
 * Use an item in battle
 */
private async useItemInBattle(itemId: string): Promise<void> {
  this.hideBattleItems();
  this.isBattleProcessing = true;
  this.updateBattleActionButtons(false);

  const result = await this.manager.useItemInBattle(itemId);
  
  if (!result || !result.success) {
    this.addBattleLogEntry('Failed to use item!', 'miss');
    this.isBattleProcessing = false;
    this.updateBattleActionButtons(true);
    return;
  }

  // Update canvas with new battle state
  if (result.battle) {
    this.battleCanvas?.updateBattle(result.battle);
  }

  // Show player action (item use)
  if (result.playerLog) {
    await this.handleBattleLogEntry(result.playerLog);
  }

  // Check if battle ended after player action
  if (result.battle && result.battle.result !== 'in_progress') {
    await this.handleBattleEnd(result.battle);
    this.isBattleProcessing = false;
    return;
  }

  // Show enemy action if there was one
  if (result.enemyLog) {
    // Delay enemy action display for better UX
    await new Promise(resolve => setTimeout(resolve, 800));
    await this.handleBattleLogEntry(result.enemyLog);

    // Check if battle ended after enemy action
    if (result.battle && result.battle.result !== 'in_progress') {
      await this.handleBattleEnd(result.battle);
      this.isBattleProcessing = false;
      return;
    }
  }

  // Back to player turn
  this.isBattleProcessing = false;
  this.updateBattleActionButtons(true);
}
```

---

## Issue #3: Direct State Mutation in Classic Mode [HIGH]

### Problem
In classic dungeon mode, clicking "Next Floor" directly mutates the state copy instead of using `setState()`. Changes aren't persisted.

### File
`src/renderer/components/studyquest/handlers/StudyQuestDungeonHandler.ts`

### Current Code (lines ~329-335)
```typescript
content.querySelector('#btn-next-floor')?.addEventListener('click', async () => {
  const state = this.manager.getState();
  if (state.dungeonState) {
    state.dungeonState.currentFloor++;  // ❌ Direct mutation
    this.renderDungeonRunClassic();
  }
});
```

### Solution
The Manager needs a method to properly advance the floor. Add it to the manager and call it from the handler.

### Step 1: Add advanceFloor method to Manager
**File:** `src/renderer/managers/StudyQuestManager.ts`

Add this new method after `getCurrentDungeon()` (around line 650):

```typescript
/**
 * Advance to the next floor in current dungeon run
 */
advanceFloor(): boolean {
  if (!this.state.dungeonState) return false;
  
  const dungeon = this.getCurrentDungeon();
  if (!dungeon) return false;
  
  if (this.state.dungeonState.currentFloor >= dungeon.floorCount) {
    return false; // Already on final floor
  }
  
  this.setState({
    dungeonState: {
      ...this.state.dungeonState,
      currentFloor: this.state.dungeonState.currentFloor + 1,
    },
  });
  
  return true;
}
```

### Step 2: Update DungeonHandler to use the new method
**File:** `src/renderer/components/studyquest/handlers/StudyQuestDungeonHandler.ts`

Find the `#btn-next-floor` event listener (around line 329) and replace:

**FROM:**
```typescript
content.querySelector('#btn-next-floor')?.addEventListener('click', async () => {
  const state = this.manager.getState();
  if (state.dungeonState) {
    state.dungeonState.currentFloor++;
    this.renderDungeonRunClassic();
  }
});
```

**TO:**
```typescript
content.querySelector('#btn-next-floor')?.addEventListener('click', async () => {
  if (this.manager.advanceFloor()) {
    this.renderDungeonRunClassic();
  }
});
```

---

## Issue #4: TownView Not Stopped on Modal Close [HIGH]

### Problem
When closing the StudyQuest modal, `townView.stop()` is never called. The canvas animation loop continues running in the background.

### File
`src/renderer/components/StudyQuestModal.ts`

### Current Code (lines ~223-234)
```typescript
public close(): void {
  if (!this.isOpen) return;

  this.isOpen = false;
  this.backdrop?.classList.remove('active');
  this.container?.classList.remove('active');

  // Cleanup handlers
  this.battleHandler?.cleanup();
  this.inventoryHandler?.cleanup();
  this.dungeonHandler?.cleanup();
  this.characterHandler?.cleanup();
  // ❌ Missing: townView cleanup
```

### Solution
Add `townView.stop()` to the close method.

**REPLACE** the `close()` method with:
```typescript
public close(): void {
  if (!this.isOpen) return;

  this.isOpen = false;
  this.backdrop?.classList.remove('active');
  this.container?.classList.remove('active');

  // Stop canvas animations
  this.townView?.stop();

  // Cleanup handlers
  this.battleHandler?.cleanup();
  this.inventoryHandler?.cleanup();
  this.dungeonHandler?.cleanup();
  this.characterHandler?.cleanup();

  if (this.unsubscribe) {
    this.unsubscribe();
    this.unsubscribe = null;
  }

  if (this.themeUnsubscribe) {
    this.themeUnsubscribe();
    this.themeUnsubscribe = null;
  }

  logger.info('StudyQuest closed');
}
```

---

## Issue #5: Battle State Cleared During Render [HIGH]

### Problem
After battle ends, a 2-second timeout clears `currentBattle` to null. If the BattleHandler is still rendering overlays, it gets null battle state mid-animation.

### File
`src/renderer/managers/StudyQuestManager.ts`

### Current Code (lines ~688-692)
```typescript
// Clear battle state after a delay
setTimeout(() => {
  this.setState({ currentBattle: null });
}, 2000);
```

### Solution
Remove the automatic timeout. Let the BattleHandler clear the battle state when it's done rendering. Add a method for this.

### Step 1: Remove the setTimeout in battleAction
**File:** `src/renderer/managers/StudyQuestManager.ts`

Find the setTimeout in `battleAction()` (around line 688) and **DELETE** these lines:
```typescript
// Clear battle state after a delay
setTimeout(() => {
  this.setState({ currentBattle: null });
}, 2000);
```

### Step 2: Add a clearBattle method to Manager
**File:** `src/renderer/managers/StudyQuestManager.ts`

Add this method near `battleAction()`:
```typescript
/**
 * Clear current battle state (called by BattleHandler when done rendering)
 */
clearBattle(): void {
  this.setState({ currentBattle: null });
}
```

### Step 3: Update BattleHandler to clear battle when done
**File:** `src/renderer/components/studyquest/handlers/StudyQuestBattleHandler.ts`

In the `handleBattleEnd()` method, at the end (around line 280), **before** the navigation logic, add:
```typescript
// Clear battle state in manager (we're done rendering)
this.manager.clearBattle();
```

So the end of `handleBattleEnd` should look like:
```typescript
// Cleanup and return to appropriate view
this.battleCanvas?.clear();
this.isBattleProcessing = false;
this.isCurrentBattleBoss = false;

// Clear battle state in manager (we're done rendering)
this.manager.clearBattle();

if (battle.result === 'defeat') {
  this.callbacks.getDungeonExploreView()?.stop();
  this.callbacks.showView('town');
} else if (isBossVictoryOnFinalFloor) {
  // ... rest of code
```

---

## Issue #6: Save Indicator Fires Constantly [MEDIUM]

### Problem
The save indicator shows on every state change, even local changes that don't persist to database.

### File
`src/renderer/components/StudyQuestModal.ts`

### Current Code (lines ~724-728)
```typescript
private onStateChange(state: StudyQuestState): void {
  this.updatePlayerInfo(state.character);
  if (state.character && !state.isLoading) {
    this.showSaveIndicator();  // ❌ Fires on ANY state change
  }
}
```

### Solution
Remove automatic save indicator from `onStateChange`. Instead, only show it when we know a save actually happened.

### Step 1: Remove from onStateChange
**File:** `src/renderer/components/StudyQuestModal.ts`

**REPLACE** `onStateChange` method with:
```typescript
/**
 * Handle state changes from manager
 */
private onStateChange(state: StudyQuestState): void {
  this.updatePlayerInfo(state.character);

  if (this.container) {
    const continueBtn = this.container.querySelector('#btn-continue') as HTMLElement;
    if (continueBtn) {
      continueBtn.style.display = state.character ? 'block' : 'none';
    }
  }
  // Note: Save indicator is now triggered by explicit save operations, not state changes
}
```

### Step 2: Add a public method to show save indicator
**File:** `src/renderer/components/StudyQuestModal.ts`

Make `showSaveIndicator()` public so it can be called when needed:
```typescript
/**
 * Show save indicator when saving game state (public for explicit saves)
 */
public showSaveIndicator(): void {
  // ... existing implementation
}
```

### Step 3 (Optional): Call showSaveIndicator after actual saves
If you want the save indicator to show after real saves, you could call it from:
- After `healCharacter()` succeeds
- After `buyItem()` succeeds
- After battle rewards are granted
- After dungeon completion

This is optional - the indicator can simply be removed if it's not needed.

---

## Issue #7: Fallback State Divergence [MEDIUM]

### Problem
In `awardGold()`, `takeDamage()`, and `healCharacterDirect()`, if the IPC call fails, the catch block directly mutates local state. This causes state to diverge from database.

### File
`src/renderer/managers/StudyQuestManager.ts`

### Current Code (example from awardGold, around line 912)
```typescript
catch (error) {
  logger.error('Failed to award gold:', error);
  // Fallback: update local state
  this.state.character.gold += amount;  // ❌ Direct mutation
  this.state.character.totalGoldEarned = (this.state.character.totalGoldEarned || 0) + amount;
  this.notifyListeners();
  return true;
}
```

### Solution
Option A (Safer): Don't fallback - return false and let the UI handle the error.
Option B (Better UX): Use proper setState for fallback, but mark state as "dirty" or "unsynced".

For simplicity, let's use Option A - remove the fallback and return false.

### Step 1: Fix awardGold
**File:** `src/renderer/managers/StudyQuestManager.ts`

Find `awardGold()` (around line 900) and replace the catch block:

**FROM:**
```typescript
catch (error) {
  logger.error('Failed to award gold:', error);
  // Fallback: update local state
  this.state.character.gold += amount;
  this.state.character.totalGoldEarned = (this.state.character.totalGoldEarned || 0) + amount;
  this.notifyListeners();
  return true;
}
```

**TO:**
```typescript
catch (error) {
  logger.error('Failed to award gold:', error);
  return false;
}
```

### Step 2: Fix takeDamage
**File:** `src/renderer/managers/StudyQuestManager.ts`

Find `takeDamage()` (around line 930) and replace the catch block:

**FROM:**
```typescript
catch (error) {
  logger.error('Failed to apply damage:', error);
  // Fallback: update local state
  this.state.character.hp = Math.max(0, this.state.character.hp - amount);
  this.notifyListeners();
  return true;
}
```

**TO:**
```typescript
catch (error) {
  logger.error('Failed to apply damage:', error);
  return false;
}
```

### Step 3: Fix healCharacterDirect
**File:** `src/renderer/managers/StudyQuestManager.ts`

Find `healCharacterDirect()` (around line 955) and replace the catch block:

**FROM:**
```typescript
catch (error) {
  logger.error('Failed to heal character:', error);
  // Fallback: update local state
  this.state.character.hp = Math.min(this.state.character.maxHp, this.state.character.hp + amount);
  this.notifyListeners();
  return true;
}
```

**TO:**
```typescript
catch (error) {
  logger.error('Failed to heal character:', error);
  return false;
}
```

---

## Issue #8: BattlerType Validation Incomplete [LOW]

### Problem
The hardcoded `validBattlers` array in `BattleCanvas.ts` may not include all battler types, causing HD battlers to fall back to sprite sheets.

### File
`src/renderer/components/studyquest/BattleCanvas.ts`

### Current Code (lines ~100-106)
```typescript
private validateBattlerType(key: string): BattlerType | null {
  const validBattlers: BattlerType[] = [
    'yarn_elemental', 'roomba', 'rubber_ducky',
    'dog_warrior', 'dog', 'fishmonger', 'nerf_ranger', 'rat', 'rat_fighter',
    'rat_mage', 'rat_necromancer', 'rat_ranger', 'rat_warrior', 'ruff_dog',
    'squirrel_warrior', 'can_opener_boss', 'tuna_can', 'big_rubber_ducky'
  ];
  return validBattlers.includes(key as BattlerType) ? (key as BattlerType) : null;
}
```

### Solution
Check the `SpriteLoader.ts` for the full BattlerType definition and ensure all types are included. Also consider making this dynamically reference the type definition.

### Step 1: Check SpriteLoader for BattlerType definition
**File:** `src/renderer/components/studyquest/SpriteLoader.ts`

Find the `BattlerType` export and note all valid values.

### Step 2: Update validBattlers array to match
**File:** `src/renderer/components/studyquest/BattleCanvas.ts`

Update the `validBattlers` array to include all battler types from `SpriteLoader.ts`.

**Better approach** - Import the type and create array from it:
```typescript
// At top of file, import BattlerType values if exported as const array
// Or keep synchronized manually with SpriteLoader

private validateBattlerType(key: string): BattlerType | null {
  // This list should match BattlerType in SpriteLoader.ts
  const validBattlers: BattlerType[] = [
    'yarn_elemental', 'roomba', 'rubber_ducky',
    'dog_warrior', 'dog', 'fishmonger', 'nerf_ranger', 'rat', 'rat_fighter',
    'rat_mage', 'rat_necromancer', 'rat_ranger', 'rat_warrior', 'ruff_dog',
    'squirrel_warrior', 'can_opener_boss', 'tuna_can', 'big_rubber_ducky',
    // Add any additional battler types here if they exist in SpriteLoader.ts
  ];
  return validBattlers.includes(key as BattlerType) ? (key as BattlerType) : null;
}
```

---

## Testing Checklist

After implementing fixes, test the following:

### Issue #1 (Boss Flag)
- [ ] Start a dungeon in Explore mode
- [ ] Encounter a boss on final floor
- [ ] Verify boss intro screen appears
- [ ] Verify dungeon completes after boss defeat

### Issue #2 (Item Use Enemy Turn)
- [ ] Enter battle
- [ ] Use a healing item
- [ ] Verify enemy turn is displayed with animation and log entry
- [ ] Verify HP changes are shown correctly

### Issue #3 (Floor Advancement)
- [ ] Start dungeon in Classic mode
- [ ] Click "Next Floor" button
- [ ] Close and reopen StudyQuest
- [ ] Verify floor number persisted

### Issue #4 (TownView Stop)
- [ ] Open StudyQuest to town view
- [ ] Close modal
- [ ] Check browser dev tools for continued animation frames
- [ ] Verify no errors in console

### Issue #5 (Battle Clear)
- [ ] Win a battle
- [ ] Observe victory overlay plays completely
- [ ] No "Cannot read property of null" errors in console
- [ ] Same test for defeat

### Issue #6 (Save Indicator)
- [ ] Navigate around StudyQuest
- [ ] Verify save indicator doesn't flash constantly
- [ ] If indicator is removed, verify no visual issues

### Issue #7 (Fallback State)
- [ ] These are error conditions - can be tested by temporarily breaking IPC
- [ ] Verify errors are logged but app doesn't crash
- [ ] Verify state remains consistent

### Issue #8 (Battler Types)
- [ ] Encounter various enemy types
- [ ] Verify HD battler images display when available
- [ ] Verify no unexpected fallbacks to sprite sheets

---

## Summary

| Priority | Issue | Files to Modify |
|----------|-------|-----------------|
| 🔴 CRITICAL | #1 Boss Flag | types.ts, Modal.ts, DungeonHandler.ts |
| 🔴 CRITICAL | #2 Item Enemy Turn | Manager.ts, BattleHandler.ts |
| 🟠 HIGH | #3 Floor Mutation | Manager.ts, DungeonHandler.ts |
| 🟠 HIGH | #4 TownView Stop | Modal.ts |
| 🟠 HIGH | #5 Battle Clear | Manager.ts, BattleHandler.ts |
| 🟡 MEDIUM | #6 Save Indicator | Modal.ts |
| 🟡 MEDIUM | #7 Fallback State | Manager.ts |
| 🔵 LOW | #8 Battler Types | BattleCanvas.ts |

Total files to modify: 6
- `src/renderer/components/StudyQuestModal.ts`
- `src/renderer/managers/StudyQuestManager.ts`
- `src/renderer/components/studyquest/handlers/types.ts`
- `src/renderer/components/studyquest/handlers/StudyQuestDungeonHandler.ts`
- `src/renderer/components/studyquest/handlers/StudyQuestBattleHandler.ts`
- `src/renderer/components/studyquest/BattleCanvas.ts`
