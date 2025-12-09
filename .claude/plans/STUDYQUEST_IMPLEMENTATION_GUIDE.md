# StudyQuest Implementation Guide

> **Living Document** - Update progress checkboxes as work completes.
> 
> **Last Updated**: December 2025
> **Engine**: KAPLAY (https://kaplayjs.com)
> **Platform**: Electron (ScribeCat-v2)

---

## Table of Contents

1. [Game Overview](#game-overview)
2. [Architecture](#architecture)
3. [Technical Standards](#technical-standards)
4. [Asset Management](#asset-management)
5. [Core Systems Specifications](#core-systems-specifications)
6. [Scene Specifications](#scene-specifications)
7. [Data Structures](#data-structures)
8. [Session Checklist](#session-checklist)
9. [Integration Points](#integration-points)
10. [Known Patterns & Solutions](#known-patterns--solutions)

---

## Game Overview

### Concept
StudyQuest is a cozy turn-based RPG where you play as a cat exploring dungeons, battling silly enemies, and decorating your home. Progress is earned through both gameplay AND studying with ScribeCat.

### Core Loop
```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   Study with ScribeCat ──► Earn XP/Gold ──┐            │
│                                            │            │
│   ┌────────────────────────────────────────┘            │
│   │                                                     │
│   ▼                                                     │
│   Town Hub ◄──────────────────────────────┐            │
│   │                                        │            │
│   ├──► Home (decorate, view collection)    │            │
│   ├──► Shop (buy items, gear, furniture)   │            │
│   ├──► Inn (heal HP for gold)              │            │
│   └──► Dungeon Gate                        │            │
│        │                                   │            │
│        ▼                                   │            │
│        Dungeon Exploration                 │            │
│        │                                   │            │
│        ▼                                   │            │
│        Battle ──► Victory ──► Rewards ─────┘            │
│               └──► Defeat ──► Back to Town             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### The World

| Location | Purpose |
|----------|---------|
| **Home** | Personal space. View cat collection, place furniture, see achievements. |
| **Town** | Hub area. Access shop, inn, home, and dungeon gate. |
| **Shop** | Buy consumables, equipment, and home decorations. |
| **Inn** | Heal HP to full for a gold cost. |
| **Dungeon** | Procedural rooms with enemies, treasure, and a boss. |
| **Battle** | Turn-based combat against enemies. |

### Progression Systems

| System | Source | Rewards |
|--------|--------|---------|
| **Levels** | XP from battles + studying | Stat increases (HP, ATK, DEF) |
| **Gold** | Battles + studying + treasure | Buy items, gear, furniture |
| **Cat Colors** | Achievements, milestones | Unlock: brown, orange, gray, white, black, + special |
| **Costumes** | Rare dungeon drops | Hats, collars, accessories |
| **Furniture** | Shop + dungeon drops | Home decorations |
| **Dungeons** | Beat previous boss | Unlock new themed areas |

### Enemy Theme
All enemies are silly, cat-themed:
- Yarn Elemental
- Rubber Ducky
- Roomba
- Vacuum Cleaner (boss)
- Laser Pointer
- Cardboard Box Mimic
- Cucumber (jump scare!)
- Water Spray Bottle (boss)

---

## Architecture

### File Structure
```
src/renderer/game/
├── index.ts                 # KAPLAY initialization, game instance management
├── config.ts                # Game constants (speeds, sizes, etc.)
│
├── scenes/
│   ├── index.ts             # Scene registration barrel
│   ├── TitleScene.ts        # Main menu / title screen
│   ├── TownScene.ts         # Town hub area
│   ├── HomeScene.ts         # Player's home
│   ├── ShopScene.ts         # Shop interface
│   ├── InnScene.ts          # Inn interface  
│   ├── DungeonScene.ts      # Dungeon exploration
│   └── BattleScene.ts       # Turn-based combat
│
├── components/
│   ├── index.ts             # Component barrel
│   ├── Player.ts            # Player cat entity factory
│   ├── Enemy.ts             # Enemy entity factory
│   ├── NPC.ts               # Town NPC factory
│   ├── Furniture.ts         # Placeable furniture factory
│   └── Door.ts              # Door/transition zone factory
│
├── systems/
│   ├── index.ts             # Systems barrel
│   ├── movement.ts          # Player movement + collision
│   ├── interaction.ts       # Proximity-based interaction detection
│   ├── effects.ts           # Visual effects (flash, particles, floating numbers)
│   ├── camera.ts            # Camera shake, zoom, flash
│   ├── sound.ts             # Audio manager
│   ├── battle.ts            # Battle logic (damage calc, turn management)
│   ├── dungeon.ts           # Dungeon generation
│   └── save.ts              # Save/load game state
│
├── ui/
│   ├── index.ts             # UI barrel
│   ├── UISystem.ts          # Core UI manager (themes, dialogs)
│   ├── HUD.ts               # In-game HUD (HP, gold, minimap)
│   ├── BattleUI.ts          # Battle-specific UI (action menu, HP bars)
│   ├── ShopUI.ts            # Shop item list and purchase UI
│   ├── InventoryUI.ts       # Inventory/equipment screens
│   └── HomeUI.ts            # Furniture placement UI
│
├── state/
│   ├── index.ts             # State barrel
│   ├── GameState.ts         # Central game state singleton
│   ├── PlayerState.ts       # Player stats, inventory, equipment
│   ├── DungeonState.ts      # Current dungeon floor, room, progress
│   ├── BattleState.ts       # Current battle state machine
│   └── HomeState.ts         # Furniture placements, unlocks
│
└── data/
    ├── enemies.ts           # Enemy definitions (stats, sprites, drops)
    ├── items.ts             # Item definitions (consumables, equipment)
    ├── furniture.ts         # Furniture definitions
    ├── dungeons.ts          # Dungeon theme definitions
    └── achievements.ts      # Achievement definitions
```

### Module Responsibilities

| Module | Single Responsibility |
|--------|----------------------|
| `scenes/` | Orchestrate game flow, load assets, wire up systems |
| `components/` | Create game entities with standard interfaces |
| `systems/` | Game logic that operates on entities |
| `ui/` | All visual UI elements and menus |
| `state/` | All game data, persistence, state machines |
| `data/` | Static game content definitions |

---

## Technical Standards

### KAPLAY Initialization
```typescript
// index.ts - Standard initialization
import kaplay, { KAPLAYCtx } from 'kaplay';

export function initGame(canvas: HTMLCanvasElement): KAPLAYCtx {
  return kaplay({
    canvas,
    width: 480,          // Base resolution
    height: 320,
    scale: 2,            // 2x scaling for crisp pixels
    crisp: true,         // Pixel-perfect rendering
    background: [26, 26, 46],
    global: false,       // Don't pollute window
    debug: false,        // Toggle for development
  });
}
```

### Scene Registration Pattern
```typescript
// scenes/ExampleScene.ts
import type { KAPLAYCtx } from 'kaplay';

export interface ExampleSceneData {
  // Data passed via k.go('example', data)
  someValue?: string;
}

export function registerExampleScene(k: KAPLAYCtx): void {
  k.scene('example', async (data: ExampleSceneData = {}) => {
    // 1. Load assets (if not preloaded)
    // 2. Create entities
    // 3. Set up systems
    // 4. Wire up input
    // 5. Start scene logic
  });
}
```

### Component Factory Pattern
```typescript
// components/Example.ts
import type { KAPLAYCtx, GameObj } from 'kaplay';

export interface ExampleConfig {
  k: KAPLAYCtx;
  x: number;
  y: number;
}

export interface Example {
  entity: GameObj;
  // Methods that operate on the entity
  doSomething(): void;
  destroy(): void;
}

export async function createExample(config: ExampleConfig): Promise<Example> {
  const { k, x, y } = config;
  
  const entity = k.add([
    k.sprite('example-sprite'),
    k.pos(x, y),
    k.anchor('center'),
    k.area(),
    'example', // Tag for queries
  ]);
  
  return {
    entity,
    doSomething() {
      // Implementation
    },
    destroy() {
      k.destroy(entity);
    },
  };
}
```

### State Singleton Pattern
```typescript
// state/ExampleState.ts
type Listener = (data?: unknown) => void;

class ExampleStateManager {
  // State properties
  value: number = 0;
  
  // Event emitter
  private listeners = new Map<string, Set<Listener>>();
  
  // Mutator methods (emit events)
  setValue(v: number): void {
    this.value = v;
    this.emit('valueChanged', v);
  }
  
  // Event methods
  on(event: string, cb: Listener): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
  }
  
  off(event: string, cb: Listener): void {
    this.listeners.get(event)?.delete(cb);
  }
  
  private emit(event: string, data?: unknown): void {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }
  
  reset(): void {
    this.value = 0;
    this.emit('reset');
  }
}

export const ExampleState = new ExampleStateManager();
```

### Tween Usage
```typescript
// Simple tween
await k.tween(0, 100, 0.5, (v) => entity.pos.x = v, k.easings.easeOutQuad);

// Chained tweens
await k.tween(startX, targetX, 0.2, (v) => entity.pos.x = v);
await k.tween(1, 1.2, 0.1, (v) => entity.scale.x = entity.scale.y = v);
await k.tween(1.2, 1, 0.1, (v) => entity.scale.x = entity.scale.y = v);

// Parallel tweens (don't await)
k.tween(0, 1, 0.3, (v) => overlay.opacity = v);
k.tween(entity.pos.y, entity.pos.y - 20, 0.3, (v) => entity.pos.y = v);
```

### Input Handling
```typescript
// Keyboard
k.onKeyPress('enter', () => handleInteraction());
k.onKeyDown('left', () => moveLeft());
k.onKeyRelease('space', () => endCharge());

// Mouse
k.onClick(() => handleClick());
k.onMouseMove((pos) => updateCursor(pos));

// Checking state in update loop
k.onUpdate(() => {
  if (k.isKeyDown('left')) { /* continuous movement */ }
  if (k.isMousePressed('left')) { /* just clicked */ }
});
```

### Z-Index Layering Convention
```
0-9      Background tiles
10-19    Floor decorations
20-29    Entities (NPCs, enemies)
30-39    Player
40-49    Foreground decorations
50-99    HUD elements
100-199  Menus
200-299  Dialogs/modals
300+     Transitions/overlays
```

---

## Asset Management

### Sprite Organization
```
assets/
├── sprites/
│   ├── cats/
│   │   ├── brown/          # idle.png, walk.png (spritesheets)
│   │   ├── orange/
│   │   ├── gray/
│   │   ├── white/
│   │   └── black/
│   ├── enemies/
│   │   ├── slime.png
│   │   ├── yarn.png
│   │   └── ...
│   ├── npcs/
│   │   ├── shopkeeper.png
│   │   └── innkeeper.png
│   └── items/
│       ├── potion.png
│       └── ...
├── tilesets/
│   ├── dungeon.png
│   ├── town.png
│   └── home.png
├── backgrounds/
│   ├── battle/
│   │   ├── backyard.png
│   │   ├── alley.png
│   │   └── ...
│   └── locations/
│       ├── town.png
│       └── home.png
├── ui/
│   ├── themes/
│   │   ├── blue/
│   │   ├── pink/
│   │   ├── beige/
│   │   └── brown/
│   └── icons/
│       ├── heart.png
│       ├── coin.png
│       └── ...
└── audio/
    ├── music/
    │   ├── town.mp3
    │   ├── dungeon.mp3
    │   └── battle.mp3
    └── sfx/
        ├── hit.wav
        ├── coin.wav
        └── ...
```

### Sprite Loading Pattern
```typescript
// Load spritesheet with animations
k.loadSprite('cat-brown-idle', 'assets/sprites/cats/brown/idle.png', {
  sliceX: 6,  // 6 frames horizontal
  sliceY: 1,
  anims: {
    idle: { from: 0, to: 5, loop: true, speed: 8 },
  },
});

// Load single sprite
k.loadSprite('potion', 'assets/sprites/items/potion.png');

// Load spritesheet with multiple anims
k.loadSprite('cat-brown', 'assets/sprites/cats/brown/sheet.png', {
  sliceX: 6,
  sliceY: 4,
  anims: {
    idle: { from: 0, to: 5, loop: true, speed: 8 },
    walk: { from: 6, to: 11, loop: true, speed: 10 },
    attack: { from: 12, to: 17, loop: false, speed: 12 },
    hurt: { from: 18, to: 23, loop: false, speed: 10 },
  },
});
```

---

## Core Systems Specifications

### Movement System (`systems/movement.ts`)

**Purpose**: Handle player movement with collision bounds.

**Interface**:
```typescript
interface MovementConfig {
  k: KAPLAYCtx;
  player: Player;
  speed: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

function setupMovement(config: MovementConfig): void;
```

**Behavior**:
- Arrow keys OR WASD for 8-direction movement
- Normalize diagonal speed
- Clamp to bounds
- Update player animation (idle vs walk)
- Flip sprite based on direction
- Respect `player.canMove` flag

---

### Interaction System (`systems/interaction.ts`)

**Purpose**: Detect when player is near interactable objects.

**Interface**:
```typescript
interface InteractionConfig {
  k: KAPLAYCtx;
  player: Player;
  interactables: Interactable[];
  onHighlight?: (target: Interactable | null) => void;
}

interface Interactable {
  entity: GameObj;
  type: string;
  promptText: string;
  onInteract: () => void;
}

function setupInteraction(config: InteractionConfig): void;
```

**Behavior**:
- Check distance to all interactables each frame
- Highlight nearest if within range (e.g., 40px)
- Show interaction prompt ("Press ENTER to...")
- Call `onInteract` when player presses ENTER/SPACE while highlighted

---

### Effects System (`systems/effects.ts`)

**Purpose**: Visual feedback effects.

**Interface**:
```typescript
// Flash an entity a color (damage = red, heal = green)
function flashEntity(k: KAPLAYCtx, entity: GameObj, color: Color, duration?: number): void;

// Show floating number that rises and fades
function showFloatingNumber(
  k: KAPLAYCtx,
  x: number,
  y: number,
  value: number | string,
  type: 'damage' | 'heal' | 'xp' | 'gold' | 'miss'
): void;

// Scale pulse effect
function pulseEntity(k: KAPLAYCtx, entity: GameObj, scale?: number, duration?: number): Promise<void>;

// Particle burst
function spawnParticles(k: KAPLAYCtx, x: number, y: number, count?: number, color?: Color): void;
```

**Colors**:
- Damage: `rgb(239, 68, 68)` (red)
- Heal: `rgb(74, 222, 128)` (green)
- XP: `rgb(250, 204, 21)` (yellow)
- Gold: `rgb(251, 191, 36)` (amber)
- Miss: `rgb(148, 163, 184)` (gray)

---

### Camera System (`systems/camera.ts`)

**Purpose**: Camera effects for game feel.

**Interface**:
```typescript
// Screen shake with decay
function shakeCamera(k: KAPLAYCtx, intensity?: number, duration?: number): void;

// Flash overlay
function flashScreen(k: KAPLAYCtx, color?: Color, duration?: number): void;

// Smooth zoom
function zoomCamera(k: KAPLAYCtx, targetScale: number, duration?: number): Promise<void>;
```

---

### Sound System (`systems/sound.ts`)

**Purpose**: Audio management with volume control.

**Interface**:
```typescript
interface SoundSystem {
  loadSound(name: string, path: string): void;
  loadMusic(name: string, path: string): void;
  
  play(name: string, volume?: number): void;
  playMusic(name: string, volume?: number, loop?: boolean): void;
  stopMusic(): void;
  
  setMasterVolume(v: number): void;
  setSFXVolume(v: number): void;
  setMusicVolume(v: number): void;
}

function createSoundSystem(k: KAPLAYCtx): SoundSystem;
```

---

### Battle System (`systems/battle.ts`)

**Purpose**: Turn-based combat logic.

**Interface**:
```typescript
interface BattleConfig {
  player: PlayerStats;
  enemy: EnemyDefinition;
}

interface BattleResult {
  victory: boolean;
  xpGained: number;
  goldGained: number;
  drops: Item[];
}

// Damage formula
function calculateDamage(attacker: Stats, defender: Stats, isDefending: boolean): number;

// Returns 0.8 - 1.2 multiplier
function getRandomMultiplier(): number;

// Check if attack crits (e.g., 10% chance, 1.5x damage)
function rollCrit(luck: number): { isCrit: boolean; multiplier: number };
```

**Damage Formula**:
```
baseDamage = attacker.attack - defender.defense / 2
randomized = baseDamage * random(0.8, 1.2)
final = max(1, floor(randomized))
if defending: final = floor(final / 2)
if crit: final = floor(final * 1.5)
```

---

### Dungeon Generation (`systems/dungeon.ts`)

**Purpose**: Procedurally generate dungeon floors.

**Interface**:
```typescript
interface DungeonConfig {
  theme: string;       // 'backyard', 'alley', etc.
  floorNumber: number; // Affects difficulty
  roomCount: number;   // 5-10 rooms typical
}

interface DungeonFloor {
  id: string;
  theme: string;
  rooms: Map<string, DungeonRoom>;
  startRoomId: string;
  bossRoomId: string;
}

interface DungeonRoom {
  id: string;
  type: 'normal' | 'treasure' | 'boss' | 'start';
  connections: { north?: string; south?: string; east?: string; west?: string };
  contents: RoomContent[];
  visited: boolean;
  cleared: boolean;
}

interface RoomContent {
  type: 'enemy' | 'chest' | 'healing';
  x: number; // 0-1 normalized position
  y: number;
  data: unknown; // Enemy ID, chest contents, etc.
  triggered: boolean;
}

function generateDungeon(config: DungeonConfig): DungeonFloor;
```

**Generation Algorithm**:
1. Create start room at center
2. Randomly grow rooms in cardinal directions
3. Ensure connectivity (no orphans)
4. Place boss room furthest from start
5. Sprinkle treasure room(s)
6. Populate normal rooms with enemies/chests

---

### Save System (`systems/save.ts`)

**Purpose**: Persist game state.

**Interface**:
```typescript
interface SaveData {
  version: number;
  player: PlayerSaveData;
  home: HomeSaveData;
  progress: ProgressSaveData;
  settings: SettingsSaveData;
}

// Save via IPC to main process (SQLite)
async function saveGame(slot: number): Promise<void>;
async function loadGame(slot: number): Promise<SaveData | null>;
async function deleteSave(slot: number): Promise<void>;
async function listSaves(): Promise<SaveSlot[]>;
```

---

## Scene Specifications

### Title Scene (`scenes/TitleScene.ts`)

**Purpose**: Main menu.

**Elements**:
- Game logo/title
- "New Game" button
- "Continue" button (if save exists)
- "Settings" button
- Background art

**Flow**:
- New Game → Character creation (pick cat color) → Town
- Continue → Load save → Town (or last location)
- Settings → Settings overlay

---

### Town Scene (`scenes/TownScene.ts`)

**Purpose**: Central hub for all activities.

**Elements**:
- Town background with buildings
- Player cat (walkable area)
- Building entrances: Shop, Inn, Home, Dungeon Gate
- NPCs walking around? (optional, decorative)

**Interactables**:
| Location | Prompt | Action |
|----------|--------|--------|
| Shop door | "Enter Shop" | `k.go('shop')` |
| Inn door | "Enter Inn" | `k.go('inn')` |
| Home door | "Go Home" | `k.go('home')` |
| Dungeon gate | "Enter Dungeon" | Dungeon select → `k.go('dungeon', { dungeonId })` |

---

### Home Scene (`scenes/HomeScene.ts`)

**Purpose**: Personal space, collection viewing, decoration.

**Elements**:
- Room background with placeable furniture spots
- Player cat
- Cat Collection display (trophy wall showing unlocked colors)
- Furniture items placed by player
- "Edit Mode" toggle for furniture placement

**Interactables**:
| Location | Prompt | Action |
|----------|--------|--------|
| Door | "Exit Home" | `k.go('town')` |
| Cat Collection | "View Collection" | Open collection overlay |
| Furniture (edit mode) | "Move" / "Remove" | Furniture placement UI |

**Cat Collection Display**:
- Grid of cat sprites (grayed out if locked)
- Current selection highlighted
- Click to change active cat color

---

### Shop Scene (`scenes/ShopScene.ts`)

**Purpose**: Buy items, equipment, furniture.

**Elements**:
- Shopkeeper NPC
- Shop UI overlay with tabs: Items, Equipment, Furniture
- Player gold display
- Item list with prices

**Shop Flow**:
1. Enter scene → shopkeeper greeting
2. Open shop UI (automatic or via interaction)
3. Browse tabs
4. Select item → confirmation dialog
5. Purchase → gold decreases, item added to inventory
6. Exit → back to town

---

### Inn Scene (`scenes/InnScene.ts`)

**Purpose**: Heal HP for gold.

**Elements**:
- Innkeeper NPC
- Cozy inn interior background
- Healing interaction

**Flow**:
1. Talk to innkeeper
2. "Rest for X gold?" dialog
3. Yes → heal to full, deduct gold, play rest animation
4. Exit → back to town

---

### Dungeon Scene (`scenes/DungeonScene.ts`)

**Purpose**: Explore procedural dungeon floors.

**Elements**:
- Room background (based on dungeon theme)
- Player cat
- Room contents (enemies, chests, etc.)
- Doors to connected rooms
- Minimap (corner of screen)
- HUD (HP, gold)

**Flow**:
1. Enter dungeon → generate floor
2. Start in start room
3. Move through doors to explore
4. Touch enemy → transition to battle
5. Touch chest → open chest, get loot
6. Find boss room → boss battle
7. Victory → rewards screen → back to town

**Room Transition**:
1. Player touches door
2. Fade out (0.2s)
3. Load new room, reposition player at opposite door
4. Fade in (0.2s)

---

### Battle Scene (`scenes/BattleScene.ts`)

**Purpose**: Turn-based combat.

**Layout**:
```
┌─────────────────────────────────────────┐
│ [Enemy Name]                  [Floor #] │
│                                         │
│         ┌───────────┐                   │
│         │  ENEMY    │     ████████ HP   │
│         │  SPRITE   │                   │
│         └───────────┘                   │
│                                         │
│  ┌───────────┐                          │
│  │  PLAYER   │      ████████████ HP     │
│  │  SPRITE   │      ████████░░░░ XP     │
│  └───────────┘                          │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ > Attack    Defend              │    │
│  │   Item      Run                 │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

**Battle States**:
```typescript
type BattlePhase = 
  | 'start'        // Battle intro animation
  | 'player_turn'  // Waiting for player input
  | 'player_act'   // Playing player action animation
  | 'enemy_turn'   // Enemy deciding action
  | 'enemy_act'    // Playing enemy action animation
  | 'victory'      // Player won
  | 'defeat'       // Player lost
  | 'flee'         // Player ran away
  ;
```

**Actions**:
| Action | Effect |
|--------|--------|
| Attack | Deal damage to enemy |
| Defend | Reduce damage taken next enemy attack by 50% |
| Item | Open item submenu, use consumable |
| Run | % chance to escape, fail = enemy free hit |

**Battle Flow**:
1. Enter scene with enemy data
2. Play intro (sprites slide in)
3. Player turn: show action menu
4. Player selects action → execute with animation
5. If enemy alive: enemy turn
6. Enemy acts → animation
7. If player alive: back to player turn
8. Loop until victory/defeat

**Victory**:
1. Play victory animation/sound
2. Calculate rewards (XP, gold, drops)
3. Show rewards overlay
4. Level up if applicable
5. Return to dungeon (or town if dungeon complete)

**Defeat**:
1. Play defeat animation/sound
2. "You were defeated..." message
3. Return to town
4. Lose some gold? (optional)

---

## Data Structures

### Player Stats
```typescript
interface PlayerStats {
  // Identity
  catColor: CatColor;
  costume: string | null;
  
  // Combat stats
  level: number;
  xp: number;
  xpToNext: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number; // Turn order? Or just for flavor
  luck: number;  // Crit chance, drop rates
  
  // Resources
  gold: number;
  
  // Equipment
  weapon: Equipment | null;
  armor: Equipment | null;
  accessory: Equipment | null;
  
  // Inventory
  items: InventoryItem[];
}

type CatColor = 'brown' | 'orange' | 'gray' | 'white' | 'black';
```

### Enemy Definition
```typescript
interface EnemyDefinition {
  id: string;
  name: string;
  spriteKey: string;
  
  // Base stats (scaled by dungeon floor)
  baseHp: number;
  baseAttack: number;
  baseDefense: number;
  
  // Rewards
  xpReward: number;
  goldReward: [number, number]; // min-max range
  drops: DropEntry[];
  
  // Behavior
  aiType: 'basic' | 'defensive' | 'aggressive' | 'boss';
}

interface DropEntry {
  itemId: string;
  chance: number; // 0-1
}
```

### Item Definition
```typescript
interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  iconKey: string;
  type: 'consumable' | 'equipment' | 'furniture' | 'key';
  
  // Consumable
  effect?: {
    type: 'heal' | 'buff' | 'damage';
    value: number;
  };
  
  // Equipment
  slot?: 'weapon' | 'armor' | 'accessory';
  stats?: Partial<{ attack: number; defense: number; maxHp: number; luck: number }>;
  
  // Shop
  buyPrice: number;
  sellPrice: number;
}
```

### Furniture Definition
```typescript
interface FurnitureDefinition {
  id: string;
  name: string;
  spriteKey: string;
  size: { width: number; height: number }; // In grid units
  buyPrice: number;
  category: 'floor' | 'wall' | 'table' | 'decoration';
}
```

### Dungeon Definition
```typescript
interface DungeonDefinition {
  id: string;
  name: string;
  description: string;
  backgroundKey: string;
  tilesetKey: string;
  
  // Scaling
  baseEnemyLevel: number;
  floorCount: number;
  
  // Content
  enemyPool: string[]; // Enemy IDs
  bossId: string;
  
  // Unlock
  requiredDungeon: string | null; // Must beat this first
}
```

---

## Session Checklist

### Session 1: The Foundation
- [ ] Clean KAPLAY initialization in `index.ts`
- [ ] Game constants in `config.ts`
- [ ] Cat sprite loading (brown only to start)
- [ ] Player component with idle/walk animations
- [ ] Movement system (8-direction, bounded)
- [ ] Simple test scene with bordered room
- [ ] Player can walk around, animation switches correctly
- [ ] Sprite flips based on direction

**Test**: Walk a cat around a box. Animations play correctly.

---

### Session 2: Room System
- [ ] Room data structure
- [ ] Door component
- [ ] Multiple rooms in test scene
- [ ] Door detection (player near door)
- [ ] Interaction prompt display
- [ ] Fade transition between rooms
- [ ] Player repositioned at entry door

**Test**: Walk through doors between 3-4 rooms.

---

### Session 3: Town Hub
- [ ] Town scene registration
- [ ] Town background
- [ ] Building entrance interactables
- [ ] Interaction system (proximity + prompt)
- [ ] Scene transitions (placeholder destinations)
- [ ] Basic HUD (gold display)

**Test**: Walk around town, enter/exit buildings.

---

### Session 4: Home Scene
- [ ] Home scene registration
- [ ] Home background with furniture spots
- [ ] Cat Collection display component
- [ ] Collection data structure (unlocked cats)
- [ ] View collection interaction
- [ ] Switch active cat color
- [ ] Return to town

**Test**: View cat collection, change active cat.

---

### Session 5: Shop & Inn
- [ ] Shop scene registration
- [ ] Shopkeeper NPC
- [ ] Shop UI (item list, tabs)
- [ ] Purchase flow with confirmation
- [ ] Inventory state management
- [ ] Inn scene registration
- [ ] Healing interaction
- [ ] Gold deduction

**Test**: Buy a potion, heal at inn.

---

### Session 6: Dungeon Generation
- [ ] Dungeon generator function
- [ ] Room type assignment
- [ ] Connection graph
- [ ] Content placement
- [ ] Dungeon scene refactor to use generator
- [ ] Minimap component
- [ ] Room-to-room transitions
- [ ] Dungeon select from town

**Test**: Generate and explore a dungeon.

---

### Session 7: Battle Core
- [ ] Battle scene registration
- [ ] Battle state machine
- [ ] Player/enemy sprite placement
- [ ] HP bar components
- [ ] Action menu (Attack, Defend, Item, Run)
- [ ] Damage calculation
- [ ] Turn flow logic
- [ ] Victory/defeat detection
- [ ] Return to caller scene

**Test**: Fight an enemy, win or lose.

---

### Session 8: Battle Polish
- [ ] Effects system (flash, shake, particles)
- [ ] Camera shake on hit
- [ ] Floating damage numbers
- [ ] Attack animations (tween lunge)
- [ ] Sound effects (hit, victory, defeat)
- [ ] Item submenu in battle
- [ ] Defend reduces damage

**Test**: Battle feels juicy.

---

### Session 9: Progression
- [ ] XP and level up system
- [ ] Level up animation/overlay
- [ ] Stat increases per level
- [ ] Equipment system
- [ ] Equipment affects stats
- [ ] Equipment UI
- [ ] Shop sells equipment

**Test**: Level up, equip weapon, hit harder.

---

### Session 10: Dungeon Loop
- [ ] Enemy encounters in dungeon
- [ ] Battle → return to dungeon flow
- [ ] Treasure chests
- [ ] Boss battles
- [ ] Dungeon victory rewards
- [ ] Dungeon unlock progression
- [ ] Rare drops system

**Test**: Complete a full dungeon run.

---

### Session 11: Home Customization
- [ ] Furniture placement mode
- [ ] Furniture grid system
- [ ] Place/move/remove furniture
- [ ] Furniture shop tab
- [ ] Save/load home layout
- [ ] Furniture from dungeon drops

**Test**: Decorate home, see it persist.

---

### Session 12: ScribeCat Integration
- [ ] IPC hooks for study completion
- [ ] XP/Gold rewards from studying
- [ ] Achievement system
- [ ] Achievement → unlock cat colors
- [ ] Stats display (study history)

**Test**: Study session gives rewards.

---

### Session 13: Polish
- [ ] Music tracks (town, dungeon, battle, home)
- [ ] Full sound effect coverage
- [ ] Save/load game complete
- [ ] Settings (volume, etc.)
- [ ] Balance pass
- [ ] Bug fixes
- [ ] Mobile touch? (stretch goal)

**Test**: Full playthrough feels complete.

---

## Integration Points

### ScribeCat → StudyQuest

**When study session completes**:
```typescript
// Main process sends to renderer
ipcRenderer.on('study-session-complete', (event, data) => {
  const { duration, wordsTranscribed, aiToolsUsed } = data;
  
  // Calculate rewards
  const xpGained = Math.floor(duration / 60) * 10; // 10 XP per minute
  const goldGained = Math.floor(duration / 60) * 5; // 5 gold per minute
  const bonus = aiToolsUsed ? 1.5 : 1; // 50% bonus for using AI tools
  
  PlayerState.addXP(Math.floor(xpGained * bonus));
  PlayerState.addGold(Math.floor(goldGained * bonus));
  
  // Show reward notification
  showRewardNotification(xpGained, goldGained);
});
```

### StudyQuest → Database

**Save player data**:
```typescript
// Via IPC to main process
ipcRenderer.invoke('studyquest:save', {
  slot: 1,
  data: {
    player: PlayerState.serialize(),
    home: HomeState.serialize(),
    progress: ProgressState.serialize(),
  }
});
```

---

## Known Patterns & Solutions

### Async Sprite Loading in Scenes
```typescript
k.scene('example', async (data) => {
  // Load sprites BEFORE creating entities
  await k.loadSprite('cat', 'path/to/cat.png', { ... });
  
  // Now safe to use
  const cat = k.add([k.sprite('cat'), ...]);
});
```

### Preventing Double Transitions
```typescript
let isTransitioning = false;

async function transition(target: string) {
  if (isTransitioning) return;
  isTransitioning = true;
  
  // Do transition...
  await fadeOut();
  k.go(target);
  // isTransitioning resets when new scene loads
}
```

### UI Layering with Containers
```typescript
// Create container for all menu elements
const menu = k.add([k.pos(0, 0), k.z(100)]);

// Add children to container
menu.add([k.sprite('button'), k.pos(10, 10)]);
menu.add([k.text('Play'), k.pos(50, 20)]);

// Destroy all at once
menu.destroy();
```

### State Machine with Switch
```typescript
type Phase = 'idle' | 'acting' | 'done';
let phase: Phase = 'idle';

k.onUpdate(() => {
  switch (phase) {
    case 'idle':
      // Wait for input
      break;
    case 'acting':
      // Animation playing, ignore input
      break;
    case 'done':
      // Cleanup and transition
      break;
  }
});
```

### Click Detection for Sprite Buttons
```typescript
// Option 1: Area component + onClick (preferred)
const btn = k.add([
  k.sprite('button'),
  k.pos(100, 100),
  k.area(),
]);
btn.onClick(() => handleClick());

// Option 2: Manual bounds check (for complex cases)
k.onUpdate(() => {
  if (k.isMousePressed('left')) {
    const mouse = k.mousePos();
    if (isInBounds(mouse, buttonBounds)) {
      handleClick();
    }
  }
});
```

---

## Appendix: Quick Reference

### KAPLAY Essentials
```typescript
// Add entity
const e = k.add([k.sprite('x'), k.pos(0,0), k.area(), 'tag']);

// Destroy entity
k.destroy(e);

// Get entities by tag
const all = k.get('tag');

// Tween
await k.tween(from, to, duration, setter, easing);

// Wait
await k.wait(seconds);

// Input
k.onKeyPress('key', callback);
k.isKeyDown('key');

// Scene
k.scene('name', (data) => { ... });
k.go('name', data);
```

### Common Easings
```typescript
k.easings.linear
k.easings.easeInQuad
k.easings.easeOutQuad
k.easings.easeInOutQuad
k.easings.easeOutBack    // Overshoot
k.easings.easeOutBounce  // Bounce
k.easings.easeOutElastic // Spring
```

### Color Shortcuts
```typescript
k.rgb(255, 0, 0)     // Red
k.rgb(0, 255, 0)     // Green
k.rgb(0, 0, 255)     // Blue
k.rgb(255, 255, 255) // White
k.rgb(0, 0, 0)       // Black
k.hsl2rgb(0.5, 1, 0.5) // From HSL
```

---

*End of Implementation Guide*
