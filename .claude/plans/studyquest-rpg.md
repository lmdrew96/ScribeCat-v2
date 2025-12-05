# StudyQuest: Retro RPG Mini-Game Feature Plan

## Vision

A 16/32-bit style single-player RPG that serves as a **rewarding study break**. Players earn XP and gold from studying, then spend it on dungeon runs, boss battles, and character progression. The game subtly ties into study content without being preachy or educational-first.

**Core Philosophy:** Study → Earn → Play → Progress → Study More

---

## Phase 1: Foundation (Core Systems)

### 1.1 Database Schema

Create Supabase migration for persistent game state:

```sql
-- Tables needed:
-- study_quest_characters: Player character data
-- study_quest_inventory: Items and equipment
-- study_quest_quests: Quest definitions and progress
-- study_quest_dungeons: Dungeon/level definitions
-- study_quest_combat_log: Battle history (optional)
```

**Character Table:**
- user_id, name, class, level, xp, gold
- hp, max_hp, attack, defense, speed
- equipped_weapon_id, equipped_armor_id
- current_dungeon_id, dungeon_progress
- total_battles_won, total_quests_completed
- created_at, updated_at

**Inventory Table:**
- user_id, item_id, quantity, is_equipped
- Item types: weapon, armor, consumable, key_item

**Quest Table:**
- Quest definitions with requirements
- User quest progress tracking
- Daily/weekly quest rotation

### 1.2 Domain Layer

Create entities following existing patterns:

```
src/domain/entities/
├── StudyQuestCharacter.ts    # Player character entity
├── StudyQuestItem.ts         # Item/equipment entity
├── StudyQuestQuest.ts        # Quest entity
├── StudyQuestDungeon.ts      # Dungeon/level entity
└── StudyQuestBattle.ts       # Combat encounter entity

src/domain/repositories/
└── IStudyQuestRepository.ts  # Repository interface
```

### 1.3 Infrastructure Layer

```
src/infrastructure/services/supabase/
└── SupabaseStudyQuestRepository.ts
```

### 1.4 IPC Handlers

```
src/main/ipc/handlers/
└── StudyQuestHandlers.ts

Channels:
- studyquest:get-character
- studyquest:create-character
- studyquest:add-xp
- studyquest:add-gold
- studyquest:get-inventory
- studyquest:equip-item
- studyquest:use-item
- studyquest:get-quests
- studyquest:complete-quest
- studyquest:start-dungeon
- studyquest:battle-action
- studyquest:save-progress
```

### 1.5 Application Use Cases

```
src/application/use-cases/studyquest/
├── CreateCharacterUseCase.ts
├── AddStudyRewardsUseCase.ts    # Convert study metrics → XP/gold
├── StartDungeonUseCase.ts
├── ProcessBattleUseCase.ts
├── CompleteQuestUseCase.ts
└── LevelUpUseCase.ts
```

---

## Phase 2: Core Game Mechanics

### 2.1 XP & Reward System

**Study → Rewards Conversion:**

| Activity | XP | Gold |
|----------|----|----- |
| 1 minute study time | 2 XP | 1 gold |
| AI tool usage | 5 XP | 2 gold |
| AI chat message | 3 XP | 1 gold |
| Session completed | 50 XP | 25 gold |
| Daily login | 20 XP | 10 gold |
| Achievement unlocked | 100 XP | 50 gold |

**Level Progression:**
- Level 1→2: 100 XP
- Level 2→3: 250 XP
- Level N→N+1: 100 + (N * 50) XP
- Max level: 50

**Level-up Rewards:**
- +10 max HP
- +2 attack, +1 defense, +1 speed
- Unlock new dungeons every 5 levels
- Unlock new equipment tiers

### 2.2 Character Classes

**Three starting classes (choose at character creation):**

| Class | HP | ATK | DEF | SPD | Special |
|-------|----|----|-----|-----|---------|
| Scholar | 80 | 8 | 6 | 8 | +25% XP gain |
| Knight | 120 | 10 | 8 | 4 | +25% gold gain |
| Rogue | 90 | 12 | 4 | 10 | +25% crit chance |

### 2.3 Combat System

**Turn-based, retro JRPG style:**

```
┌─────────────────────────────────────┐
│  [Enemy Sprite]                     │
│  Goblin  HP: ████████░░ 80/100      │
│                                     │
├─────────────────────────────────────┤
│  [Player Sprite]                    │
│  Hero Lv.5  HP: ██████████ 100/100  │
│                                     │
│  ┌─────────┬─────────┐              │
│  │ Attack  │ Defend  │              │
│  ├─────────┼─────────┤              │
│  │ Item    │ Flee    │              │
│  └─────────┴─────────┘              │
└─────────────────────────────────────┘
```

**Actions:**
- **Attack**: Deal damage based on ATK vs enemy DEF
- **Defend**: Reduce incoming damage by 50%, gain small HP
- **Item**: Use consumable (potion, bomb, etc.)
- **Flee**: Escape battle (% chance based on SPD)

**Damage Formula:**
```
damage = (attacker.ATK * 2) - defender.DEF + random(-3, 3)
critical = random() < 0.1 ? damage * 1.5 : damage
```

### 2.4 Dungeon System

**Short dungeon runs (5-10 minutes):**

```
Dungeon Structure:
├── Floor 1: 2-3 encounters
├── Floor 2: 2-3 encounters
├── Floor 3: 3-4 encounters
└── Boss Floor: 1 boss battle

Progress saves after each floor.
Defeat = lose 25% gold, return to town.
Victory = bonus XP/gold + rare item chance.
```

**Dungeon Types:**
1. **Training Grounds** (Lv 1-5) - Tutorial dungeon
2. **Dark Forest** (Lv 5-10) - Nature enemies
3. **Crystal Caves** (Lv 10-15) - Mining theme
4. **Haunted Library** (Lv 15-20) - Study easter eggs!
5. **Dragon's Peak** (Lv 20-30) - Fire enemies
6. **Void Realm** (Lv 30-50) - Endgame content

### 2.5 Equipment & Items

**Weapons** (increase ATK):
- Wooden Sword → Iron Sword → Steel Blade → Dragon Fang → Cosmic Edge

**Armor** (increase DEF):
- Cloth Tunic → Leather Armor → Chain Mail → Plate Armor → Astral Robes

**Consumables:**
- Health Potion (restore 50 HP)
- Mana Elixir (restore special ability)
- Bomb (deal 30 damage to enemy)
- Escape Smoke (guaranteed flee)

**Shop System:**
- Buy items with gold
- Prices scale with item tier
- Rare items from dungeon drops only

---

## Phase 3: UI & Rendering

### 3.1 Renderer Architecture

```
src/renderer/
├── managers/
│   └── StudyQuestManager.ts      # Main game coordinator
├── components/
│   └── studyquest/
│       ├── StudyQuestModal.ts    # Main game container
│       ├── TitleScreen.ts        # Start menu
│       ├── CharacterCreate.ts    # New game flow
│       ├── TownView.ts           # Hub area
│       ├── DungeonView.ts        # Dungeon exploration
│       ├── BattleView.ts         # Combat screen
│       ├── InventoryView.ts      # Items/equipment
│       ├── QuestLogView.ts       # Quest tracking
│       ├── ShopView.ts           # Buy/sell items
│       └── CharacterSheet.ts     # Stats display
└── css/
    └── studyquest.css            # Retro pixel styling
```

### 3.2 Visual Style

**16-bit Aesthetic:**
- Pixel art sprites (use Game Asset MCP or pre-made assets)
- Limited color palette per "biome"
- Chunky pixel fonts
- Simple animations (idle, attack, hurt, victory)
- Retro sound effects (optional)

**CSS Approach:**
```css
.studyquest-modal {
  image-rendering: pixelated;
  font-family: 'Press Start 2P', monospace;
  background: #1a1a2e;
  border: 4px solid #4a4a6a;
}

.pixel-button {
  background: linear-gradient(#4a90d9, #2a5a9a);
  border: 3px solid #1a3a6a;
  box-shadow:
    inset 2px 2px 0 #6ab0f9,
    inset -2px -2px 0 #1a4a8a;
}
```

### 3.3 Canvas Rendering (for battles/dungeons)

Use HTML5 Canvas for game scenes:

```typescript
// BattleRenderer.ts
export class BattleRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 480;  // 16:9 retro resolution
    this.canvas.height = 270;
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false; // Crisp pixels
    container.appendChild(this.canvas);
  }

  renderBattle(player: Character, enemy: Enemy): void {
    this.ctx.clearRect(0, 0, 480, 270);
    this.drawBackground();
    this.drawEnemy(enemy);
    this.drawPlayer(player);
    this.drawUI(player, enemy);
  }
}
```

---

## Phase 4: Study Integration

### 4.1 Passive XP Earning

**Hook into existing study tracking:**

```typescript
// In StudyModeManager or SessionDataLoader
async onSessionStudyComplete(session: Session): Promise<void> {
  const xpEarned = this.calculateStudyXP(session);
  const goldEarned = this.calculateStudyGold(session);

  await window.api.invoke('studyquest:add-xp', xpEarned);
  await window.api.invoke('studyquest:add-gold', goldEarned);

  // Show subtle notification
  this.notificationTicker.show({
    message: `+${xpEarned} XP, +${goldEarned} Gold earned!`,
    icon: 'sword',
    duration: 3000
  });
}
```

### 4.2 Study-Themed Easter Eggs

**Subtle connections (not forced education):**

- **Haunted Library dungeon**: Books with quotes from user's notes
- **NPC dialogue**: Occasionally references topics from recent sessions
- **Item names**: Themed around study subjects
  - "Calculus Codex" (+5 ATK)
  - "History Helm" (+3 DEF)
  - "Biology Brew" (restore HP)
- **Boss names**: Playful study references
  - "The Procrastination Dragon"
  - "Exam Specter"
  - "Deadline Demon"

### 4.3 Quest Integration

**Daily Quests (reset at midnight):**
- "Study for 30 minutes" → 100 XP, 50 gold
- "Use 5 AI tools" → 75 XP, 30 gold
- "Complete a dungeon floor" → 80 XP, 40 gold

**Weekly Quests:**
- "Study for 5 hours total" → 500 XP, 250 gold
- "Clear a full dungeon" → 400 XP, 200 gold
- "Defeat 20 enemies" → 300 XP, 150 gold

---

## Phase 5: Polish & Launch

### 5.1 Animations (GSAP)

Leverage existing GSAP system:

```typescript
// Level up animation
gsap.timeline()
  .to('.level-display', { scale: 1.5, duration: 0.3 })
  .to('.level-display', {
    textContent: newLevel,
    duration: 0,
    onComplete: () => this.playSound('levelup')
  })
  .to('.level-display', { scale: 1, duration: 0.3 })
  .from('.stat-increase', { opacity: 0, y: 20, stagger: 0.1 });
```

### 5.2 Sound Effects (Optional)

Simple retro sounds:
- Battle start jingle
- Attack hit/miss
- Item pickup
- Level up fanfare
- Victory theme
- Defeat sound

### 5.3 Achievements Integration

Add StudyQuest achievements to existing system:

- "First Steps" - Create your character
- "Dungeon Delver" - Complete first dungeon
- "Dragon Slayer" - Defeat first boss
- "Level 10" - Reach level 10
- "Treasure Hunter" - Collect 50 items
- "Quest Master" - Complete 100 quests
- "Legendary Hero" - Reach level 50

### 5.4 Persistence & Sync

- **Local**: localStorage backup for offline play
- **Cloud**: Supabase for cross-device sync
- **Auto-save**: After every battle, dungeon floor, purchase

---

## Implementation Order

### Sprint 1: Core Infrastructure
1. Database migration (tables, RLS)
2. Domain entities (Character, Item, Quest, Dungeon)
3. Repository interface + Supabase implementation
4. IPC handlers (basic CRUD)
5. StudyQuestManager skeleton

### Sprint 2: Game Mechanics
1. Character creation flow
2. XP/leveling system
3. Combat engine (turn-based battle logic)
4. Basic dungeon generation
5. Inventory system

### Sprint 3: UI Implementation
1. StudyQuestModal container
2. TownView (hub screen)
3. BattleView (combat UI)
4. Canvas rendering setup
5. Pixel art integration

### Sprint 4: Content & Polish
1. Multiple dungeons
2. Enemy variety
3. Equipment tiers
4. Quest system
5. Shop system

### Sprint 5: Integration & Launch
1. Study XP hooks
2. Achievement integration
3. Animations (GSAP)
4. Sound effects
5. Bug fixes & balance

---

## Technical Considerations

### Performance
- Canvas rendering at 30fps max
- Lazy load dungeon assets
- Cache sprites in memory
- Throttle save operations

### Offline Support
- Full game playable offline via localStorage
- Sync to Supabase when online
- Conflict resolution: server wins for XP/gold

### Testing
- Unit tests for combat formulas
- Integration tests for XP calculations
- Manual playtest for balance

---

## Asset Strategy

### Option A: Pre-made Assets
- Use free pixel art from OpenGameArt, itch.io
- Consistent style pack (e.g., "16-bit RPG bundle")
- Faster implementation

### Option B: AI-Generated (Game Asset MCP)
- Generate custom sprites on-demand
- Unique to ScribeCat
- Slower, requires MCP integration

### Recommendation: Start with Option A
Use pre-made assets for MVP, consider AI generation for future expansion.

---

## Success Metrics

- **Engagement**: % of users who try StudyQuest
- **Retention**: Users returning to play weekly
- **Study correlation**: Does playing increase study time?
- **Progression**: Average player level after 1 month

---

## Future Expansion Ideas

- **Multiplayer raids**: Friends tackle bosses together
- **PvP arena**: Battle other players' characters
- **Seasonal events**: Limited-time dungeons/items
- **Pet system**: Companions that boost stats
- **Crafting**: Combine items for better gear
- **Guilds/Clans**: Group progression
