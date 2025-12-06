# StudyQuest Improvements Implementation Plan

## Overview

This plan covers the improvements needed to bring StudyQuest from its current MVP state to a polished, fully-integrated feature. The focus is on completing the core Study → Earn → Play loop and adding battle polish.

---

## Priority 1: Study Integration Hooks (Critical Path)

**Goal:** Connect studying activities to XP/Gold rewards - this is the entire point of the game.

### 1.1 Create StudyQuestIntegration Service

Create a lightweight integration layer that managers can call:

**File:** `src/renderer/managers/StudyQuestIntegration.ts`

```typescript
/**
 * Tracks study activity and awards StudyQuest rewards.
 * Used by other managers to report study activities.
 */
export class StudyQuestIntegration {
  private studyQuestManager: StudyQuestManager | null = null;
  private sessionStartTime: number | null = null;
  private aiToolsUsed = 0;
  private aiChatsUsed = 0;

  setManager(manager: StudyQuestManager): void;
  startSession(): void;
  endSession(): Promise<void>;
  recordAIToolUse(): void;
  recordAIChatMessage(): void;
}
```

### 1.2 Hook into RecordingManager

**File:** `src/renderer/managers/RecordingManager.ts`

Add integration when recording starts/stops:

- `startRecording()` → Call `studyQuestIntegration.startSession()`
- `stopRecording()` → Call `studyQuestIntegration.endSession()` with duration

### 1.3 Hook into AIManager

**File:** `src/renderer/managers/AIManager.ts`

Track AI usage:

- `generateSummary()` → `studyQuestIntegration.recordAIToolUse()`
- `generateFlashcards()` → `studyQuestIntegration.recordAIToolUse()`
- `chat()` → `studyQuestIntegration.recordAIChatMessage()`

### 1.4 Hook into StudyModeManager

**File:** `src/renderer/managers/StudyModeManager.ts`

Track study sessions:

- When entering study mode with a session → start tracking
- When exiting or switching sessions → award rewards

### Implementation Steps:

1. Create `StudyQuestIntegration.ts` service class
2. Add instance to `app.ts` initialization
3. Pass reference to RecordingManager, AIManager, StudyModeManager
4. Add hook calls at appropriate points
5. Test reward flow end-to-end

---

## Priority 2: Item Usage in Battle

**Goal:** Allow players to use potions/items during battle.

### 2.1 Add Item Selection Modal

**File:** `src/renderer/components/StudyQuestModal.ts`

When "Item" button is clicked:

1. Show overlay with consumable items from inventory
2. Filter to only show items usable in battle (type: 'consumable')
3. On item select, call `manager.useItemInBattle(itemId)`
4. Close modal and continue battle

### 2.2 Add Battle Item Use Method

**File:** `src/renderer/managers/StudyQuestManager.ts`

```typescript
async useItemInBattle(itemId: string): Promise<boolean> {
  const item = this.state.inventory.find(i => i.item.id === itemId);
  if (!item || item.item.itemType !== 'consumable') return false;

  // Get healing effect
  const healing = item.item.healAmount || 0;

  // Call battle action with item effect
  await this.battleAction('item', { healing });

  // Decrement item count
  await this.useItem(itemId);

  return true;
}
```

### 2.3 Update Battle UI

Add item selection grid that appears when Item button is clicked:

```html
<div class="studyquest-battle-items" id="battle-items" style="display: none;">
  <div class="studyquest-battle-items-grid">
    <!-- Populated with consumable items -->
  </div>
  <button class="pixel-btn" id="btn-cancel-item">Cancel</button>
</div>
```

### Implementation Steps:

1. Add `renderBattleItems()` method to StudyQuestModal
2. Show/hide items panel on Item button click
3. Add item click handlers that call `useItemInBattle`
4. Add cancel button to return to normal battle view
5. Update `handleBattleAction` to handle item action properly
6. Add visual feedback (heal animation already exists)

---

## Priority 3: Attack Animation Sequence

**Goal:** Show attack animation BEFORE damage for better game feel.

### 3.1 Update BattleCanvas

**File:** `src/renderer/components/studyquest/BattleCanvas.ts`

Add method to play attack and wait:

```typescript
async playAttackSequence(attacker: 'player' | 'enemy', damage: number, isCrit: boolean): Promise<void> {
  // 1. Play attack animation
  this.playAttackAnimation(attacker);

  // 2. Wait for attack to "land"
  await this.delay(300);

  // 3. Play damage on target
  const target = attacker === 'player' ? 'enemy' : 'player';
  this.playDamageAnimation(target, damage, isCrit);
}

private delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### 3.2 Update StudyQuestModal Battle Handler

**File:** `src/renderer/components/StudyQuestModal.ts`

Modify `handleBattleLogEntry` to use async sequence:

```typescript
private async handleBattleLogEntry(entry: BattleLogEntry): Promise<void> {
  if (entry.action === 'attack' && entry.damage) {
    // Play attack animation first, then damage
    await this.battleCanvas?.playAttackSequence(
      entry.actor,
      entry.damage,
      entry.isCritical || false
    );
    // ... rest of logging
  }
}
```

### Implementation Steps:

1. Add `delay()` helper to BattleCanvas
2. Create `playAttackSequence()` async method
3. Make `handleBattleLogEntry` async
4. Update calling code to await the animation
5. Adjust timing for smooth feel (300ms attack, 200ms hit)

---

## Priority 4: Death Animation for Enemies

**Goal:** Show death animation when enemy HP reaches 0.

### 4.1 Update BattleCanvas

Add death animation method:

```typescript
async playDeathAnimation(target: 'player' | 'enemy'): Promise<void> {
  if (target === 'enemy') {
    this.animation.enemyAnimation = 'die';
  } else {
    this.animation.playerAnimation = 'die';
  }

  // Wait for animation to complete
  await this.delay(800);

  // Fade out
  // Could add opacity animation here
}
```

### 4.2 Update Battle End Handler

**File:** `src/renderer/components/StudyQuestModal.ts`

```typescript
private async handleBattleEnd(battle: StudyQuestBattleData): Promise<void> {
  this.updateBattleActionButtons(false);

  if (battle.result === 'victory') {
    // Play death animation before victory fanfare
    await this.battleCanvas?.playDeathAnimation('enemy');

    StudyQuestSound.play('victory');
    // ... rest of victory logic
  }
}
```

### Implementation Steps:

1. Add `playDeathAnimation()` to BattleCanvas
2. Make `handleBattleEnd` async
3. Call death animation before victory sound
4. Test with different enemy types

---

## Priority 5: Daily Quest Reset Logic

**Goal:** Reset daily quests at midnight, weekly on Mondays.

### 5.1 Database Function

**File:** `supabase/migrations/056_quest_reset_logic.sql`

```sql
-- Function to check and reset expired quests
CREATE OR REPLACE FUNCTION study_quest_check_quest_resets(p_user_id UUID)
RETURNS void AS $$
DECLARE
  v_now TIMESTAMP := NOW();
  v_today DATE := CURRENT_DATE;
  v_monday DATE := date_trunc('week', CURRENT_DATE)::DATE;
BEGIN
  -- Reset daily quests if last_reset was before today
  UPDATE study_quest_progress
  SET current_progress = 0,
      is_completed = false,
      last_reset_at = v_now
  FROM study_quest_quests q
  WHERE study_quest_progress.quest_id = q.id
    AND study_quest_progress.user_id = p_user_id
    AND q.quest_type = 'daily'
    AND (study_quest_progress.last_reset_at IS NULL
         OR study_quest_progress.last_reset_at::DATE < v_today);

  -- Reset weekly quests if last_reset was before this Monday
  UPDATE study_quest_progress
  SET current_progress = 0,
      is_completed = false,
      last_reset_at = v_now
  FROM study_quest_quests q
  WHERE study_quest_progress.quest_id = q.id
    AND study_quest_progress.user_id = p_user_id
    AND q.quest_type = 'weekly'
    AND (study_quest_progress.last_reset_at IS NULL
         OR study_quest_progress.last_reset_at::DATE < v_monday);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 5.2 Add Reset Check to Character Load

**File:** `src/infrastructure/services/supabase/SupabaseStudyQuestRepository.ts`

Call the reset function when loading character:

```typescript
async getCharacter(userId: string): Promise<StudyQuestCharacterData | null> {
  // First, check for quest resets
  await this.client.rpc('study_quest_check_quest_resets', { p_user_id: userId });

  // Then load character as normal
  // ...
}
```

### 5.3 Add last_reset_at Column

Add to progress table if not exists:

```sql
ALTER TABLE study_quest_progress
ADD COLUMN IF NOT EXISTS last_reset_at TIMESTAMP WITH TIME ZONE;
```

### Implementation Steps:

1. Create migration file with reset function
2. Add `last_reset_at` column to progress table
3. Update repository to call reset on character load
4. Test daily reset (manually adjust timestamps)
5. Test weekly reset

---

## Priority 6: Level-Up Celebration Animation

**Goal:** Show GSAP animation when player levels up.

### 6.1 Create Level-Up Component

**File:** `src/renderer/components/studyquest/LevelUpOverlay.ts`

```typescript
import gsap from 'gsap';

export class LevelUpOverlay {
  private container: HTMLElement;

  show(oldLevel: number, newLevel: number): Promise<void> {
    // Create overlay with level-up text
    // Animate with GSAP
    return new Promise(resolve => {
      const tl = gsap.timeline({ onComplete: resolve });

      tl.from('.levelup-text', { scale: 0, duration: 0.3, ease: 'back.out' })
        .to('.levelup-level', { textContent: newLevel, duration: 0 })
        .from('.levelup-stats', { opacity: 0, y: 20, stagger: 0.1 })
        .to('.levelup-overlay', { opacity: 0, duration: 0.5, delay: 2 });
    });
  }
}
```

### 6.2 Integrate with StudyQuestManager

Trigger overlay when `awardStudyRewards` returns `leveledUp: true`:

```typescript
if (result.leveledUp) {
  await this.levelUpOverlay.show(oldLevel, result.newLevel!);
  StudyQuestSound.play('level-up');
}
```

### Implementation Steps:

1. Create LevelUpOverlay component
2. Add GSAP animations (scale, stagger, fade)
3. Add HTML/CSS for overlay
4. Trigger from StudyQuestManager
5. Add stat increase display (+10 HP, +2 ATK, etc.)

---

## Priority 7: Inn Healing with Gold Cost

**Goal:** Show confirmation and cost before healing at inn.

### 7.1 Update Inn Handler

**File:** `src/renderer/components/StudyQuestModal.ts`

```typescript
private async handleInn(): Promise<void> {
  const state = this.manager.getState();
  const char = state.character;
  if (!char) return;

  const missingHp = char.maxHp - char.hp;
  if (missingHp === 0) {
    this.showToast('Already at full health!');
    return;
  }

  const cost = Math.ceil(missingHp * 0.5); // 0.5 gold per HP

  if (char.gold < cost) {
    this.showToast(`Not enough gold! Need ${cost}G`);
    return;
  }

  // Show confirmation
  const confirmed = await this.showConfirmDialog(
    'Rest at Inn',
    `Restore ${missingHp} HP for ${cost} Gold?`
  );

  if (confirmed) {
    const success = await this.manager.healCharacter(cost);
    if (success) {
      StudyQuestSound.play('inn-heal');
    }
  }
}
```

### 7.2 Update Heal IPC Handler

**File:** `src/main/ipc/handlers/StudyQuestHandlers.ts`

Accept cost parameter and deduct gold:

```typescript
ipcMain.handle('studyquest:heal-character', async (event, { characterId, cost }) => {
  // Deduct gold
  // Restore HP
  // Return updated character
});
```

### Implementation Steps:

1. Add confirmation dialog component (or reuse existing)
2. Calculate healing cost based on missing HP
3. Update IPC handler to accept and deduct cost
4. Play inn-heal sound on success
5. Show error if not enough gold

---

## Priority 8: XP Bar in Header

**Goal:** Show progress to next level in the header.

### 8.1 Update Header HTML

**File:** `src/renderer/components/StudyQuestModal.ts`

Add mini XP bar:

```html
<div class="studyquest-stat studyquest-xp-stat">
  <span class="studyquest-stat-icon">${SQ_ICONS.star}</span>
  <div class="studyquest-mini-xp-bar">
    <div class="studyquest-mini-xp-fill" id="studyquest-xp-bar"></div>
  </div>
  <span class="studyquest-stat-value" id="studyquest-level">Lv.--</span>
</div>
```

### 8.2 Update Player Info

```typescript
private updatePlayerInfo(character: StudyQuestCharacterData | null): void {
  // ... existing code ...

  const xpBar = this.container?.querySelector('#studyquest-xp-bar') as HTMLElement;
  if (xpBar && character) {
    const xpNeeded = 100 + (character.level * 50);
    const percent = (character.currentXp / xpNeeded) * 100;
    xpBar.style.width = `${percent}%`;
  }
}
```

### 8.3 Add CSS

```css
.studyquest-mini-xp-bar {
  width: 60px;
  height: 8px;
  background: #333355;
  border: 2px solid #4a4a6a;
  border-radius: 2px;
  overflow: hidden;
}

.studyquest-mini-xp-fill {
  height: 100%;
  background: linear-gradient(180deg, #ffd700 0%, #cc9900 100%);
  transition: width 0.3s ease;
}
```

### Implementation Steps:

1. Add XP bar HTML to header
2. Add CSS styling
3. Update `updatePlayerInfo` to set bar width
4. Add smooth transition animation

---

## Implementation Order

### Sprint A: Core Loop (Days 1-2)
1. ✅ Study Integration Hooks (Priority 1)
2. ✅ Item Usage in Battle (Priority 2)

### Sprint B: Battle Polish (Days 3-4)
3. ✅ Attack Animation Sequence (Priority 3)
4. ✅ Death Animation (Priority 4)

### Sprint C: Quest & Rewards (Day 5)
5. ✅ Daily Quest Reset (Priority 5)
6. ✅ Level-Up Animation (Priority 6)

### Sprint D: UI Polish (Day 6)
7. ✅ Inn Healing Cost (Priority 7)
8. ✅ XP Bar in Header (Priority 8)

---

## Testing Checklist

- [ ] Study for 5 minutes, verify XP/Gold awarded
- [ ] Use AI summary tool, verify bonus XP
- [ ] Use potion in battle, verify HP restored
- [ ] Attack enemy, verify attack animation plays first
- [ ] Defeat enemy, verify death animation before victory
- [ ] Complete daily quest, exit app, return next day, verify reset
- [ ] Level up from studying, verify animation plays
- [ ] Visit inn, verify cost shown and gold deducted
- [ ] Check header XP bar updates in real-time

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/renderer/managers/StudyQuestIntegration.ts` | NEW - Integration service |
| `src/renderer/managers/RecordingManager.ts` | Add study hooks |
| `src/renderer/managers/AIManager.ts` | Add AI usage hooks |
| `src/renderer/managers/StudyModeManager.ts` | Add session hooks |
| `src/renderer/components/StudyQuestModal.ts` | Battle items, inn cost, XP bar |
| `src/renderer/components/studyquest/BattleCanvas.ts` | Attack/death sequences |
| `src/renderer/components/studyquest/LevelUpOverlay.ts` | NEW - Level animation |
| `src/renderer/css/study-quest.css` | XP bar, level-up styles |
| `supabase/migrations/056_quest_reset_logic.sql` | NEW - Quest reset function |
| `src/infrastructure/services/supabase/SupabaseStudyQuestRepository.ts` | Call reset function |
| `src/main/ipc/handlers/StudyQuestHandlers.ts` | Heal with cost |

---

## Success Metrics

After implementation:
- [ ] Users earn XP passively while studying
- [ ] Battle feels responsive with proper animation timing
- [ ] Items are usable in combat
- [ ] Quests reset properly on schedule
- [ ] Level-ups feel rewarding with animation
- [ ] Inn has clear cost/benefit
- [ ] Progress is always visible in header
