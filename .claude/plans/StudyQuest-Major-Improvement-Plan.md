# StudyQuest Implementation Plan

> **Purpose:** Comprehensive roadmap for improving StudyQuest mini-game  
> **Total Items:** 15  
> **Estimated Total Effort:** ~20-30 hours  

---

## Table of Contents
1. [Phase 1: Critical Fixes](#phase-1-critical-fixes) (Items 1-2)
2. [Phase 2: UX Improvements](#phase-2-ux-improvements) (Items 3-7)
3. [Phase 3: Code Quality](#phase-3-code-quality) (Items 8-11)
4. [Phase 4: Polish & Quick Wins](#phase-4-polish--quick-wins) (Items 12-15)

---

## Phase 1: Critical Fixes
*These block core gameplay loops*

### Item 1: Inventory Item Interaction System
**Priority:** 🔴 Critical  
**Effort:** 2-3 hours  
**Files:** `StudyQuestModal.ts`, possibly new `ItemDetailModal.ts`

#### Problem
Clicking inventory items only logs to console. Players cannot use consumables outside of battle or equip weapons/armor.

#### Implementation Steps

**Step 1.1:** Create item detail popup component
```typescript
// Add to StudyQuestModal.ts or create new component
interface ItemDetailPopup {
  item: InventorySlot;
  position: { x: number; y: number };
}

private showItemDetail(slot: InventorySlot, event: MouseEvent): void {
  // Create popup near click position
  const popup = document.createElement('div');
  popup.className = 'studyquest-item-popup';
  popup.innerHTML = `
    <div class="studyquest-item-popup-header">
      <span class="item-icon">${this.getItemIcon(slot.item.itemType)}</span>
      <h4>${slot.item.name}</h4>
    </div>
    <p class="item-description">${slot.item.description || 'No description'}</p>
    <div class="item-stats">
      ${slot.item.attackBonus ? `<span>+${slot.item.attackBonus} ATK</span>` : ''}
      ${slot.item.defenseBonus ? `<span>+${slot.item.defenseBonus} DEF</span>` : ''}
      ${slot.item.healAmount ? `<span>Restores ${slot.item.healAmount} HP</span>` : ''}
    </div>
    <div class="item-actions">
      ${this.getItemActions(slot)}
    </div>
  `;
  // Position and append
}
```

**Step 1.2:** Implement action buttons based on item type
```typescript
private getItemActions(slot: InventorySlot): string {
  const actions: string[] = [];
  
  switch (slot.item.itemType) {
    case 'consumable':
      actions.push(`<button class="pixel-btn" data-action="use">Use</button>`);
      break;
    case 'weapon':
    case 'armor':
      if (slot.isEquipped) {
        actions.push(`<button class="pixel-btn" data-action="unequip">Unequip</button>`);
      } else {
        actions.push(`<button class="pixel-btn pixel-btn-success" data-action="equip">Equip</button>`);
      }
      break;
  }
  
  // All items can be dropped (sold back for half price?)
  actions.push(`<button class="pixel-btn pixel-btn-danger" data-action="drop">Drop</button>`);
  
  return actions.join('');
}
```

**Step 1.3:** Wire up action handlers
```typescript
private async handleItemAction(itemId: string, action: string): Promise<void> {
  switch (action) {
    case 'use':
      await this.manager.useItem(itemId);
      break;
    case 'equip':
      await this.manager.equipItem(itemId);
      break;
    case 'unequip':
      await this.manager.unequipItem(itemId);
      break;
    case 'drop':
      const confirmed = await this.showConfirmDialog(
        'Drop Item',
        'Are you sure? This cannot be undone.'
      );
      if (confirmed) await this.manager.dropItem(itemId);
      break;
  }
  this.closeItemPopup();
  await this.loadInventory(); // Refresh
}
```

**Step 1.4:** Add CSS for popup
```css
.studyquest-item-popup {
  position: absolute;
  background: var(--sq-panel-bg);
  border: 2px solid var(--sq-border);
  border-radius: 8px;
  padding: 12px;
  min-width: 200px;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

.studyquest-item-popup-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.item-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
```

#### Manager Methods Needed
Add to `StudyQuestManager.ts`:
- `useItem(itemId: string): Promise<boolean>` — Use consumable, apply effect
- `equipItem(itemId: string): Promise<boolean>` — Equip weapon/armor
- `unequipItem(itemId: string): Promise<boolean>` — Remove equipment
- `dropItem(itemId: string): Promise<boolean>` — Remove from inventory

---

### Item 2: Equipment System
**Priority:** 🔴 Critical  
**Effort:** 3-4 hours  
**Files:** `StudyQuestManager.ts`, `StudyQuestCharacter.ts` (domain entity)

#### Problem
Items have equipment properties but no system to actually equip them and affect character stats.

#### Implementation Steps

**Step 2.1:** Extend character data structure
```typescript
// In StudyQuestCharacter.ts or types
interface CharacterEquipment {
  weapon: string | null;    // Item ID
  armor: string | null;     // Item ID
  accessory: string | null; // Item ID (future)
}

interface StudyQuestCharacterData {
  // ... existing fields
  equipment: CharacterEquipment;
  baseAttack: number;  // Stat without equipment
  baseDefense: number; // Stat without equipment
}
```

**Step 2.2:** Implement equip/unequip in manager
```typescript
async equipItem(itemId: string): Promise<boolean> {
  const character = this.state.character;
  if (!character) return false;
  
  const inventory = await this.loadInventory();
  const slot = inventory.find(s => s.item.id === itemId);
  if (!slot) return false;
  
  const item = slot.item;
  const equipSlot = item.itemType === 'weapon' ? 'weapon' : 
                    item.itemType === 'armor' ? 'armor' : null;
  
  if (!equipSlot) return false;
  
  // Unequip current item in that slot first
  const currentEquipped = character.equipment[equipSlot];
  if (currentEquipped) {
    await this.unequipItem(currentEquipped);
  }
  
  // Equip new item
  character.equipment[equipSlot] = itemId;
  
  // Recalculate stats
  this.recalculateStats(character);
  
  await this.saveCharacter();
  this.notify(`Equipped ${item.name}!`);
  return true;
}

private recalculateStats(character: StudyQuestCharacterData): void {
  // Start with base stats
  character.attack = character.baseAttack;
  character.defense = character.baseDefense;
  
  // Add equipment bonuses
  const inventory = this.state.inventory;
  
  for (const slotKey of ['weapon', 'armor', 'accessory']) {
    const itemId = character.equipment[slotKey];
    if (itemId) {
      const slot = inventory.find(s => s.item.id === itemId);
      if (slot) {
        character.attack += slot.item.attackBonus || 0;
        character.defense += slot.item.defenseBonus || 0;
      }
    }
  }
}
```

**Step 2.3:** Update character sheet to show equipment
```typescript
// In renderCharacterSheet()
<div class="studyquest-equipment-section">
  <h3>Equipment</h3>
  <div class="equipment-slot" data-slot="weapon">
    <span class="slot-label">${SQ_ICONS.weapon} Weapon:</span>
    <span class="slot-value">${this.getEquippedItemName('weapon')}</span>
  </div>
  <div class="equipment-slot" data-slot="armor">
    <span class="slot-label">${SQ_ICONS.armor} Armor:</span>
    <span class="slot-value">${this.getEquippedItemName('armor')}</span>
  </div>
</div>
```

**Step 2.4:** Visual indicator in inventory for equipped items
```css
.studyquest-inventory-slot.equipped {
  border: 2px solid var(--sq-gold);
  box-shadow: 0 0 8px var(--sq-gold);
}

.studyquest-inventory-slot.equipped::after {
  content: 'E';
  position: absolute;
  top: 2px;
  right: 2px;
  font-size: 10px;
  color: var(--sq-gold);
  font-weight: bold;
}
```

#### Data Migration
Existing characters need `equipment` object and `baseAttack`/`baseDefense`:
```typescript
// Migration helper
if (!character.equipment) {
  character.equipment = { weapon: null, armor: null, accessory: null };
  character.baseAttack = character.attack;
  character.baseDefense = character.defense;
}
```

---

## Phase 2: UX Improvements
*Enhance player experience and game feel*

### Item 3: Dungeon Random Events
**Priority:** 🟠 High  
**Effort:** 3-4 hours  
**Files:** `StudyQuestModal.ts`, `StudyQuestManager.ts`

#### Problem
Dungeon runs are linear: Find Enemy → Fight → Next Floor. No exploration feel.

#### Implementation Steps

**Step 3.1:** Define event types
```typescript
// New file: src/domain/entities/DungeonEvents.ts
type DungeonEventType = 
  | 'battle'      // Standard enemy encounter
  | 'treasure'    // Find gold/item
  | 'trap'        // Lose HP
  | 'rest_spot'   // Free healing
  | 'mystery'     // Random positive/negative
  | 'merchant'    // Buy items mid-dungeon
  | 'nothing';    // Empty room

interface DungeonEvent {
  type: DungeonEventType;
  title: string;
  description: string;
  choices: DungeonEventChoice[];
}

interface DungeonEventChoice {
  text: string;
  action: () => Promise<void>;
  risk?: 'safe' | 'risky' | 'dangerous';
}
```

**Step 3.2:** Create event generator
```typescript
// In StudyQuestManager.ts
generateDungeonEvent(floor: number, dungeonDifficulty: number): DungeonEvent {
  const roll = Math.random() * 100;
  
  // Weighted probabilities based on floor
  if (roll < 40) return this.createBattleEvent();
  if (roll < 55) return this.createTreasureEvent(floor);
  if (roll < 65) return this.createTrapEvent(floor);
  if (roll < 75) return this.createRestSpotEvent();
  if (roll < 85) return this.createMysteryEvent(floor);
  return this.createEmptyEvent();
}

private createTreasureEvent(floor: number): DungeonEvent {
  const goldAmount = 10 + floor * 5 + Math.floor(Math.random() * 20);
  return {
    type: 'treasure',
    title: '✨ Treasure Found!',
    description: `You discover a hidden stash containing ${goldAmount} gold!`,
    choices: [
      {
        text: `Take the gold (+${goldAmount}G)`,
        action: async () => {
          await this.addGold(goldAmount);
        },
        risk: 'safe'
      }
    ]
  };
}

private createTrapEvent(floor: number): DungeonEvent {
  const damage = 5 + floor * 2;
  return {
    type: 'trap',
    title: '⚠️ Trap!',
    description: `You triggered a hidden trap!`,
    choices: [
      {
        text: `Take the hit (-${damage} HP)`,
        action: async () => {
          await this.damageCharacter(damage);
        },
        risk: 'dangerous'
      },
      {
        text: 'Try to dodge (50% chance)',
        action: async () => {
          if (Math.random() > 0.5) {
            this.notify('You dodged the trap!');
          } else {
            await this.damageCharacter(damage * 1.5);
            this.notify('Failed to dodge! Extra damage taken.');
          }
        },
        risk: 'risky'
      }
    ]
  };
}
```

**Step 3.3:** Replace "Find Enemy" button with "Explore"
```typescript
// In renderDungeonRun()
<button class="pixel-btn" id="btn-explore">
  ${SQ_ICONS.quest} Explore
</button>

// Handler
content.querySelector('#btn-explore')?.addEventListener('click', async () => {
  const event = this.manager.generateDungeonEvent(currentFloor, dungeon.difficulty);
  this.showDungeonEvent(event);
});
```

**Step 3.4:** Create event display modal
```typescript
private showDungeonEvent(event: DungeonEvent): void {
  const eventHtml = `
    <div class="studyquest-event-overlay">
      <div class="studyquest-event-card">
        <h3 class="event-title">${event.title}</h3>
        <p class="event-description">${event.description}</p>
        <div class="event-choices">
          ${event.choices.map((choice, i) => `
            <button class="pixel-btn event-choice ${choice.risk || ''}" 
                    data-choice="${i}">
              ${choice.text}
            </button>
          `).join('')}
        </div>
      </div>
    </div>
  `;
  // Render and attach handlers
}
```

---

### Item 4: Battle Action Tooltips
**Priority:** 🟠 High  
**Effort:** 1 hour  
**Files:** `StudyQuestModal.ts`, CSS

#### Problem
Players don't know what Defend does (heals small amount + reduces incoming damage).

#### Implementation Steps

**Step 4.1:** Add tooltip data attributes
```typescript
// In getModalHTML() battle actions section
<button class="pixel-btn studyquest-battle-action" 
        data-action="attack"
        data-tooltip="Deal damage based on your ATK stat. May critical hit for 1.5x damage!">
  ${SQ_ICONS.attack} Attack
</button>
<button class="pixel-btn studyquest-battle-action" 
        data-action="defend"
        data-tooltip="Recover 10% HP and reduce incoming damage by 50% this turn.">
  ${SQ_ICONS.defend} Defend
</button>
<button class="pixel-btn studyquest-battle-action" 
        data-action="item"
        data-tooltip="Use a consumable item from your inventory.">
  ${SQ_ICONS.itemUse} Item
</button>
<button class="pixel-btn studyquest-battle-action" 
        data-action="flee"
        data-tooltip="Attempt to escape battle. 50% base chance, +10% per SPD above enemy.">
  ${SQ_ICONS.flee} Flee
</button>
```

**Step 4.2:** Add tooltip CSS
```css
.studyquest-battle-action {
  position: relative;
}

.studyquest-battle-action::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 11px;
  white-space: nowrap;
  max-width: 200px;
  white-space: normal;
  text-align: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
  z-index: 100;
}

.studyquest-battle-action:hover::after {
  opacity: 1;
}
```

---

### Item 5: Character Creation Cat Preview
**Priority:** 🟠 High  
**Effort:** 2 hours  
**Files:** `StudyQuestModal.ts`, `SpriteLoader.ts`

#### Problem
Players pick a cat color without seeing what it looks like.

#### Implementation Steps

**Step 5.1:** Add preview canvas to character creation
```typescript
// In character creation HTML
<div class="studyquest-cat-preview">
  <canvas id="cat-preview-canvas" width="128" height="128"></canvas>
  <p class="preview-label">Your Cat</p>
</div>
```

**Step 5.2:** Create preview renderer
```typescript
private catPreviewCanvas: HTMLCanvasElement | null = null;
private catPreviewCtx: CanvasRenderingContext2D | null = null;
private previewAnimationFrame: number | null = null;
private previewFrameCounter = 0;

private initCatPreview(): void {
  this.catPreviewCanvas = this.container?.querySelector('#cat-preview-canvas');
  if (!this.catPreviewCanvas) return;
  
  this.catPreviewCtx = this.catPreviewCanvas.getContext('2d');
  if (this.catPreviewCtx) {
    this.catPreviewCtx.imageSmoothingEnabled = false;
  }
  
  this.updateCatPreview();
}

private async updateCatPreview(): Promise<void> {
  if (!this.catPreviewCtx) return;
  
  // Load sprite for current color
  await SpriteLoader.loadCatSprites(this.selectedColor);
  
  // Start animation loop
  this.startPreviewAnimation();
}

private startPreviewAnimation(): void {
  if (this.previewAnimationFrame) return;
  
  const animate = () => {
    this.renderCatPreview();
    this.previewFrameCounter++;
    this.previewAnimationFrame = requestAnimationFrame(animate);
  };
  
  this.previewAnimationFrame = requestAnimationFrame(animate);
}

private renderCatPreview(): void {
  if (!this.catPreviewCtx || !this.catPreviewCanvas) return;
  
  const ctx = this.catPreviewCtx;
  const canvas = this.catPreviewCanvas;
  
  // Clear
  ctx.fillStyle = 'transparent';
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw cat idle animation
  const sprite = SpriteLoader.getCatSprite(this.selectedColor, 'idle');
  if (sprite) {
    const frameIndex = Math.floor(this.previewFrameCounter / 8) % sprite.frameCount;
    SpriteLoader.drawFrame(ctx, sprite, frameIndex, 64, 80, 3, false);
  }
}
```

**Step 5.3:** Update color picker to refresh preview
```typescript
// In color picker click handler
this.selectedColor = colorId;
localStorage.setItem('studyquest-cat-color', colorId);
this.updateCatPreview(); // Add this line
```

**Step 5.4:** Clean up on view change
```typescript
private stopPreviewAnimation(): void {
  if (this.previewAnimationFrame) {
    cancelAnimationFrame(this.previewAnimationFrame);
    this.previewAnimationFrame = null;
  }
}

// Call in showView() when leaving character-create
if (this.currentView === 'character-create' && view !== 'character-create') {
  this.stopPreviewAnimation();
}
```

---

### Item 6: Battle Item Panel Transition
**Priority:** 🟠 Medium  
**Effort:** 30 minutes  
**Files:** CSS

#### Problem
Actions panel disappears instantly when opening items — jarring UX.

#### Implementation Steps

```css
.studyquest-battle-actions,
.studyquest-battle-items {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.studyquest-battle-actions.hiding {
  opacity: 0;
  transform: translateY(-10px);
}

.studyquest-battle-items {
  opacity: 0;
  transform: translateY(10px);
}

.studyquest-battle-items.visible {
  opacity: 1;
  transform: translateY(0);
}
```

```typescript
// Update showBattleItems()
private showBattleItems(): void {
  const actionsPanel = this.container?.querySelector('#battle-actions') as HTMLElement;
  const itemsPanel = this.container?.querySelector('#battle-items') as HTMLElement;
  
  // Animate out
  actionsPanel?.classList.add('hiding');
  
  setTimeout(() => {
    actionsPanel.style.display = 'none';
    itemsPanel.style.display = 'flex';
    
    // Trigger reflow then animate in
    void itemsPanel.offsetWidth;
    itemsPanel.classList.add('visible');
  }, 200);
}
```

---

### Item 7: Stat Explanations
**Priority:** 🟠 Medium  
**Effort:** 1 hour  
**Files:** `StudyQuestModal.ts`

#### Problem
Players don't know what Speed does or how stats affect gameplay.

#### Implementation Steps

**Step 7.1:** Add info icons to character sheet
```typescript
const STAT_EXPLANATIONS = {
  hp: 'Health Points. Reach 0 and you lose the battle.',
  attack: 'Determines damage dealt. Final damage = ATK - enemy DEF.',
  defense: 'Reduces incoming damage. Higher = less damage taken.',
  speed: 'Affects turn order and flee chance. +10% flee per SPD above enemy.',
  gold: 'Currency for buying items at the shop.',
};

// In renderCharacterSheet()
<div class="studyquest-stat-row">
  <span class="studyquest-stat-label">
    ${SQ_ICONS.atk} Attack
    <span class="stat-info" data-tooltip="${STAT_EXPLANATIONS.attack}">?</span>
  </span>
  <span class="studyquest-stat-value">${char.attack}</span>
</div>
```

**Step 7.2:** Style info icons
```css
.stat-info {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--sq-muted);
  color: var(--sq-text);
  font-size: 10px;
  cursor: help;
  margin-left: 4px;
}

.stat-info:hover::after {
  content: attr(data-tooltip);
  position: absolute;
  /* ... tooltip styles from Item 4 */
}
```

---

## Phase 3: Code Quality
*Improve maintainability and prevent bugs*

### Item 8: Centralize XP Formula
**Priority:** 🟡 Medium  
**Effort:** 30 minutes  
**Files:** `StudyQuestCharacter.ts`, `StudyQuestModal.ts`, `StudyQuestManager.ts`

#### Problem
XP formula `100 + (level * 50)` is duplicated in multiple places.

#### Implementation Steps

**Step 8.1:** Create utility function
```typescript
// In StudyQuestCharacter.ts or new utils file
export function getXpRequiredForLevel(level: number): number {
  return 100 + (level * 50);
}

export function getXpProgress(character: StudyQuestCharacterData): {
  current: number;
  required: number;
  percent: number;
} {
  const required = getXpRequiredForLevel(character.level);
  const current = character.currentXp || 0;
  return {
    current,
    required,
    percent: Math.min(100, (current / required) * 100),
  };
}
```

**Step 8.2:** Replace all instances
Search for `100 + (` and `level * 50` — replace with utility call:
```typescript
// Before
const xpNeeded = 100 + (character.level * 50);
const percent = (character.currentXp / xpNeeded) * 100;

// After
const { required, percent } = getXpProgress(character);
```

---

### Item 9: Explicit Enemy Sprite Keys
**Priority:** 🟡 Low  
**Effort:** 1 hour  
**Files:** Enemy definitions, `BattleCanvas.ts`

#### Problem
`guessEnemyType()` relies on name matching which is fragile.

#### Implementation Steps

**Step 9.1:** Ensure all enemy definitions include sprite keys
```typescript
// Enemy definition example
{
  id: 'yarn_elemental',
  name: 'Yarn Elemental',
  spriteKey: 'yarn_elemental',      // Explicit!
  backgroundKey: 'alley',           // Explicit!
  // ... stats
}
```

**Step 9.2:** Update battle creation to always pass keys
```typescript
// In startBattle()
const battle: StudyQuestBattleData = {
  // ... other fields
  enemySpriteKey: enemy.spriteKey || 'slime',
  backgroundKey: dungeon.backgroundKey || 'battle_default',
};
```

**Step 9.3:** Simplify BattleCanvas (optional)
Remove or deprecate `guessEnemyType()` and `guessBattlerType()` once all enemies have explicit keys.

---

### Item 10: Consolidate Instance State
**Priority:** 🟡 Medium  
**Effort:** 1-2 hours  
**Files:** `StudyQuestModal.ts`, `StudyQuestManager.ts`

#### Problem
Some state lives in modal (`dungeonCompletionRewards`, `isCurrentBattleBoss`) instead of manager.

#### Implementation Steps

**Step 10.1:** Move state to manager
```typescript
// In StudyQuestManager state
interface StudyQuestState {
  // ... existing
  dungeonCompletionRewards: DungeonCompletionRewards | null;
  isCurrentBattleBoss: boolean;
}
```

**Step 10.2:** Update modal to read from manager
```typescript
// Before
this.isCurrentBattleBoss = isBoss;

// After
this.manager.setCurrentBattleIsBoss(isBoss);

// Reading
const isBoss = this.manager.getState().isCurrentBattleBoss;
```

**Step 10.3:** Add manager methods
```typescript
setCurrentBattleIsBoss(isBoss: boolean): void {
  this.state.isCurrentBattleBoss = isBoss;
  this.notifySubscribers();
}

setDungeonCompletionRewards(rewards: DungeonCompletionRewards | null): void {
  this.state.dungeonCompletionRewards = rewards;
  this.notifySubscribers();
}
```

---

### Item 11: Class-Specific Abilities (Future Feature)
**Priority:** 🟡 Low (Future)  
**Effort:** 4-6 hours  
**Files:** Multiple

#### Problem
All classes play identically despite different stats.

#### Implementation Plan (High-Level)

**Step 11.1:** Define abilities per class
```typescript
interface ClassAbility {
  id: string;
  name: string;
  description: string;
  cooldown: number;        // Turns
  mpCost?: number;         // If adding MP system
  effect: AbilityEffect;
}

const CLASS_ABILITIES: Record<string, ClassAbility[]> = {
  scholar: [
    {
      id: 'arcane_blast',
      name: 'Arcane Blast',
      description: 'Deal magic damage ignoring 50% of enemy DEF',
      cooldown: 3,
      effect: { type: 'damage', modifier: 1.2, ignoreDefense: 0.5 }
    },
    {
      id: 'meditate',
      name: 'Meditate',
      description: 'Restore 30% HP over 2 turns',
      cooldown: 4,
      effect: { type: 'hot', percent: 0.15, duration: 2 }
    }
  ],
  knight: [
    {
      id: 'shield_bash',
      name: 'Shield Bash',
      description: 'Deal damage and stun enemy for 1 turn',
      cooldown: 3,
      effect: { type: 'damage', modifier: 0.8, stun: 1 }
    },
    {
      id: 'fortify',
      name: 'Fortify',
      description: 'Increase DEF by 50% for 3 turns',
      cooldown: 4,
      effect: { type: 'buff', stat: 'defense', modifier: 1.5, duration: 3 }
    }
  ],
  rogue: [
    {
      id: 'backstab',
      name: 'Backstab',
      description: '2x damage if enemy is stunned or you acted first',
      cooldown: 2,
      effect: { type: 'damage', modifier: 2.0, conditional: 'first_strike' }
    },
    {
      id: 'smoke_bomb',
      name: 'Smoke Bomb',
      description: 'Guarantee escape from battle',
      cooldown: 5,
      effect: { type: 'flee', guaranteed: true }
    }
  ]
};
```

**Step 11.2:** Add "Skills" button to battle UI
**Step 11.3:** Track cooldowns in battle state
**Step 11.4:** Implement ability effects in battle logic

*This is a larger feature — recommend as separate issue/PR.*

---

## Phase 4: Polish & Quick Wins
*Small improvements with big impact*

### Item 12: Save Indicator
**Priority:** 🟢 Low  
**Effort:** 30 minutes  
**Files:** `StudyQuestManager.ts`, `StudyQuestModal.ts`

#### Implementation

```typescript
// In manager after successful save
async saveCharacter(): Promise<void> {
  await this.storage.save(this.state.character);
  this.showSaveIndicator();
}

private showSaveIndicator(): void {
  // Emit event or call modal method
  window.dispatchEvent(new CustomEvent('studyquest:saved'));
}

// In modal
window.addEventListener('studyquest:saved', () => {
  this.showToast('💾 Progress saved!');
});
```

---

### Item 13: Boss Introduction Screen
**Priority:** 🟢 Low  
**Effort:** 1 hour  
**Files:** `StudyQuestModal.ts`

#### Implementation

```typescript
private async startEncounter(isBoss: boolean): Promise<void> {
  this.isCurrentBattleBoss = isBoss;
  
  if (isBoss) {
    await this.showBossIntro();
  }
  
  const battle = await this.manager.startBattle(isBoss);
  if (battle) {
    this.showView('battle');
  }
}

private showBossIntro(): Promise<void> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'studyquest-boss-intro';
    overlay.innerHTML = `
      <div class="boss-intro-content">
        <div class="boss-intro-icon">${pixelIcon('fire', 64)}</div>
        <h2 class="boss-intro-title">⚔️ BOSS BATTLE ⚔️</h2>
        <p class="boss-intro-subtitle">Prepare yourself...</p>
      </div>
    `;
    
    this.container?.appendChild(overlay);
    StudyQuestSound.play('boss-warning'); // Add this sound
    
    // Auto-dismiss after 2 seconds
    setTimeout(() => {
      overlay.classList.add('fade-out');
      setTimeout(() => {
        overlay.remove();
        resolve();
      }, 500);
    }, 2000);
  });
}
```

```css
.studyquest-boss-intro {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  animation: boss-flash 0.5s ease-in-out infinite alternate;
}

@keyframes boss-flash {
  from { background: rgba(60, 0, 0, 0.9); }
  to { background: rgba(0, 0, 0, 0.9); }
}

.boss-intro-title {
  font-size: 32px;
  color: #ef4444;
  text-shadow: 0 0 20px #ef4444;
  animation: boss-pulse 0.3s ease-in-out infinite;
}

@keyframes boss-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}
```

---

### Item 14: Inn Healing Animation
**Priority:** 🟢 Low  
**Effort:** 30 minutes  
**Files:** `StudyQuestModal.ts`

#### Implementation

```typescript
private async handleInn(): Promise<void> {
  // ... existing validation code ...
  
  if (confirmed) {
    // Show healing animation
    await this.showInnAnimation();
    
    const success = await this.manager.healCharacter(healingInfo.cost);
    if (success) {
      this.renderCharacterSheet();
      this.updatePlayerInfo(this.manager.getState().character);
    }
  }
}

private showInnAnimation(): Promise<void> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'studyquest-inn-animation';
    overlay.innerHTML = `
      <div class="inn-content">
        <div class="zzz-container">
          <span class="zzz">💤</span>
          <span class="zzz">💤</span>
          <span class="zzz">💤</span>
        </div>
        <p>Resting...</p>
      </div>
    `;
    
    this.container?.appendChild(overlay);
    StudyQuestSound.play('heal');
    
    setTimeout(() => {
      overlay.remove();
      resolve();
    }, 1500);
  });
}
```

```css
.zzz {
  font-size: 24px;
  opacity: 0;
  animation: float-up 1.5s ease-out forwards;
}

.zzz:nth-child(2) { animation-delay: 0.3s; }
.zzz:nth-child(3) { animation-delay: 0.6s; }

@keyframes float-up {
  0% { opacity: 0; transform: translateY(20px); }
  50% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-40px); }
}
```

---

### Item 15: Victory/Defeat Overlay Screens
**Priority:** 🟢 Low  
**Effort:** 1-2 hours  
**Files:** `StudyQuestModal.ts`

#### Problem
Victory/defeat are just text in battle log. Should be celebratory/dramatic.

#### Implementation

```typescript
private async handleBattleEnd(battle: StudyQuestBattleData): Promise<void> {
  this.updateBattleActionButtons(false);

  if (battle.result === 'victory') {
    await this.battleCanvas?.playDeathAnimation('enemy');
    await this.showVictoryOverlay(battle.rewards);
  } else if (battle.result === 'defeat') {
    await this.battleCanvas?.playDeathAnimation('player');
    await this.showDefeatOverlay();
  } else if (battle.result === 'fled') {
    // Keep simple for flee
    this.addBattleLogEntry('Escaped successfully!', 'info');
  }

  // ... rest of existing code
}

private showVictoryOverlay(rewards: BattleRewards | null): Promise<void> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'studyquest-result-overlay victory';
    overlay.innerHTML = `
      <div class="result-content">
        <h2 class="result-title">⭐ VICTORY! ⭐</h2>
        ${rewards ? `
          <div class="result-rewards">
            <div class="reward-item">
              <span class="reward-icon">${SQ_ICONS.star}</span>
              <span class="reward-value">+${rewards.xp} XP</span>
            </div>
            <div class="reward-item">
              <span class="reward-icon">${SQ_ICONS.coin}</span>
              <span class="reward-value">+${rewards.gold} Gold</span>
            </div>
          </div>
        ` : ''}
        <button class="pixel-btn pixel-btn-success result-continue">Continue</button>
      </div>
    `;
    
    this.container?.appendChild(overlay);
    StudyQuestSound.play('victory');
    
    overlay.querySelector('.result-continue')?.addEventListener('click', () => {
      overlay.remove();
      resolve();
    });
  });
}

private showDefeatOverlay(): Promise<void> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'studyquest-result-overlay defeat';
    overlay.innerHTML = `
      <div class="result-content">
        <h2 class="result-title">💀 DEFEAT 💀</h2>
        <p class="result-message">You lost 25% of your gold...</p>
        <p class="result-submessage">Returning to town to recover.</p>
        <button class="pixel-btn result-continue">Continue</button>
      </div>
    `;
    
    this.container?.appendChild(overlay);
    StudyQuestSound.play('defeat');
    
    overlay.querySelector('.result-continue')?.addEventListener('click', () => {
      overlay.remove();
      resolve();
    });
  });
}
```

```css
.studyquest-result-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  animation: fade-in 0.3s ease;
}

.studyquest-result-overlay.victory {
  background: radial-gradient(circle, rgba(34, 197, 94, 0.3) 0%, rgba(0,0,0,0.9) 100%);
}

.studyquest-result-overlay.defeat {
  background: radial-gradient(circle, rgba(239, 68, 68, 0.3) 0%, rgba(0,0,0,0.9) 100%);
}

.result-title {
  font-size: 36px;
  margin-bottom: 24px;
  animation: bounce-in 0.5s ease;
}

.victory .result-title {
  color: #ffd700;
  text-shadow: 0 0 20px #ffd700;
}

.defeat .result-title {
  color: #ef4444;
  text-shadow: 0 0 20px #ef4444;
}

.result-rewards {
  display: flex;
  gap: 24px;
  margin-bottom: 24px;
}

.reward-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 20px;
  color: white;
}

@keyframes bounce-in {
  0% { transform: scale(0); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}
```

---

## Implementation Order Recommendation

### Sprint 1: Core Functionality (Must Have)
1. ✅ Item 1: Inventory Item Interaction
2. ✅ Item 2: Equipment System
3. ✅ Item 8: Centralize XP Formula

### Sprint 2: Game Feel (Should Have)
4. ✅ Item 4: Battle Action Tooltips
5. ✅ Item 5: Character Creation Cat Preview
6. ✅ Item 7: Stat Explanations
7. ✅ Item 12: Save Indicator

### Sprint 3: Exploration & Polish (Nice to Have)
8. ✅ Item 3: Dungeon Random Events
9. ✅ Item 13: Boss Introduction Screen
10. ✅ Item 15: Victory/Defeat Overlay Screens

### Sprint 4: Code Quality & Extras
11. ✅ Item 6: Battle Item Panel Transition
12. ✅ Item 9: Explicit Enemy Sprite Keys
13. ✅ Item 10: Consolidate Instance State
14. ✅ Item 14: Inn Healing Animation

### Future Backlog
15. 📋 Item 11: Class-Specific Abilities

---

## Testing Checklist

After implementation, verify:

- [ ] Can view item details by clicking inventory slot
- [ ] Can use consumable items from inventory (not just battle)
- [ ] Can equip/unequip weapons and armor
- [ ] Character stats update when equipping items
- [ ] Equipped items show visual indicator in inventory
- [ ] Character sheet shows equipment slots
- [ ] Battle tooltips appear on hover
- [ ] Cat preview animates during character creation
- [ ] Color changes update preview immediately
- [ ] Stats have info icons with explanations
- [ ] XP bars use centralized formula
- [ ] "Progress saved" indicator appears
- [ ] Boss battles show intro screen
- [ ] Victory shows reward overlay
- [ ] Defeat shows penalty overlay
- [ ] Inn shows sleep animation
- [ ] Dungeon exploration has random events
- [ ] Item panel animates smoothly

---

*Generated for ScribeCat StudyQuest by Claude*  
*Last Updated: December 2024*
