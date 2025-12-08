# StudyQuest → KAPLAY Migration Plan

## Overview

**Goal**: Replace custom HTML5 Canvas implementation with KAPLAY for better maintainability and features.

**Current State**: `src/renderer/canvas/` contains ~80KB of custom game code:
- `GameCanvas.ts` - Abstract base class with game loop, input, rendering
- `CatSpriteManager.ts` - Sprite loading/caching/animation
- `StudyBuddyCanvas.ts` - Idle cat companion widget
- `town/TownCanvas.ts` - Explorable town scene
- `dungeon/DungeonCanvas.ts` - Procedurally generated dungeons
- `dungeon/DungeonGenerator.ts` - Dungeon generation algorithm
- `PlayerStatsService.ts` - XP/level/currency tracking
- `UnlockManager.ts` - Unlockable content system

**Target**: KAPLAY v3001+ (actively maintained Kaboom.js fork)

> **Why KAPLAY?** Kaboom.js is deprecated. KAPLAY is the community-maintained continuation with the same API, active development, and bug fixes. Docs: https://kaplayjs.com

---

## Phase 1: Setup & Parallel Structure

### 1.1 Install KAPLAY

```bash
npm install kaplay
```

### 1.2 Create New Directory Structure

Create `src/renderer/game/` alongside existing `src/renderer/canvas/`:

```
src/renderer/game/
├── index.ts              # KAPLAY initialization & scene registration
├── config.ts             # Game constants (matches existing)
├── scenes/
│   ├── StudyBuddyScene.ts
│   ├── TownScene.ts
│   └── DungeonScene.ts
├── sprites/
│   └── catSprites.ts     # Sprite definitions for KAPLAY
├── components/
│   └── player.ts         # Reusable player component
└── systems/
    ├── dungeonGen.ts     # Port of DungeonGenerator logic
    └── minimap.ts        # Port of MiniMap
```

### 1.3 Create KAPLAY Initialization

Create `src/renderer/game/index.ts`:

```typescript
import kaplay, { KAPLAYCtx } from 'kaplay';

let k: KAPLAYCtx | null = null;

export function initGame(canvas: HTMLCanvasElement): KAPLAYCtx {
  k = kaplay({
    canvas,
    width: 480,
    height: 270,
    scale: 2,
    crisp: true,           // Pixel-perfect rendering (replaces imageSmoothingEnabled = false)
    background: [26, 26, 46], // #1a1a2e
    debug: import.meta.env.DEV,
  });
  
  return k;
}

export function getGame(): KAPLAYCtx {
  if (!k) throw new Error('KAPLAY not initialized');
  return k;
}
```

---

## Phase 2: Port Sprite System

### 2.1 Create Sprite Definitions

The existing `CatSpriteManager` loads 32x32 horizontal sprite sheets. Port to `src/renderer/game/sprites/catSprites.ts`:

```typescript
import { getGame } from '../index';

// Frame counts from existing CatSpriteManager
const ANIMATION_FRAMES = {
  idle: 8,
  idle2: 8,
  walk: 6,
  run: 6,
  sit: 8,
  sleep: 8,
  attack: 10,
  hurt: 8,
  die: 8,
  die2: 8,
  jump: 10,
} as const;

// Animation speeds (converted to KAPLAY's FPS format)
// Original was "frames to hold" - KAPLAY uses FPS
// 60fps / holdFrames = animFPS
const ANIMATION_SPEEDS = {
  idle: 7,      // was 8 hold frames → ~7.5 fps
  idle2: 6,     // was 10 hold frames → 6 fps
  walk: 10,     // was 6 hold frames → 10 fps
  run: 15,      // was 4 hold frames → 15 fps
  sit: 5,       // was 12 hold frames → 5 fps
  sleep: 4,     // was 16 hold frames → ~4 fps
  attack: 15,   // was 4 hold frames → 15 fps
  hurt: 10,     // was 6 hold frames → 10 fps
  die: 7,
  die2: 7,
  jump: 12,     // was 5 hold frames → 12 fps
} as const;

// Exact sprite file mappings from CatSpriteManager
const CAT_SPRITE_FILES = {
  brown: {
    idle: 'brown_IdleCattt',
    idle2: 'brown_Idle2Cattt',
    walk: 'brown_RunCattt',
    run: 'brown_RunCattt',
    sit: 'brown_Sittinggg',
    sleep: 'brown_SleepCattt',
    attack: 'brown_AttackCattt',
    hurt: 'brown_HurtCatttt',
    die: 'brown_DieCattt',
    die2: 'brown_Die2Cattt',
    jump: 'brown_JumpCatttt',
  },
  // ... copy other colors from CatSpriteManager.ts
} as const;

type CatColor = keyof typeof CAT_SPRITE_FILES;
type AnimationType = keyof typeof ANIMATION_FRAMES;

export async function loadCatSprites(color: CatColor = 'brown') {
  const k = getGame();
  const files = CAT_SPRITE_FILES[color];
  
  // Load each animation as a separate sprite
  for (const [anim, filename] of Object.entries(files)) {
    const animType = anim as AnimationType;
    const frameCount = ANIMATION_FRAMES[animType];
    
    await k.loadSprite(`cat_${color}_${anim}`, `assets/sprites/studyquest/cats/${filename}.png`, {
      sliceX: frameCount,
      sliceY: 1,
      anims: {
        [anim]: {
          from: 0,
          to: frameCount - 1,
          speed: ANIMATION_SPEEDS[animType],
          loop: !['die', 'die2', 'hurt', 'attack'].includes(anim),
        },
      },
    });
  }
}

// Helper to get sprite name
export function getCatSprite(color: CatColor, anim: AnimationType): string {
  return `cat_${color}_${anim}`;
}
```

---

## Phase 3: Port StudyBuddyCanvas (Simplest First)

This is the idle cat widget - easiest to port. Create `src/renderer/game/scenes/StudyBuddyScene.ts`:

```typescript
import { getGame } from '../index';
import { loadCatSprites, getCatSprite } from '../sprites/catSprites';

interface StudyBuddyState {
  isActive: boolean;
  isSleeping: boolean;
  catColor: string;
}

export function registerStudyBuddyScene() {
  const k = getGame();
  
  k.scene('studyBuddy', async (state: StudyBuddyState) => {
    const { isActive, isSleeping, catColor } = state;
    
    // Load sprites for selected cat
    await loadCatSprites(catColor as any);
    
    // Determine animation
    let anim = 'idle';
    if (isSleeping) anim = 'sleep';
    else if (!isActive) anim = 'idle2';
    
    // Add the cat
    const cat = k.add([
      k.sprite(getCatSprite(catColor as any, anim as any)),
      k.pos(k.width() / 2, k.height() / 2),
      k.anchor('center'),
      k.scale(2),
    ]);
    
    cat.play(anim);
    
    // Optional: Add click interaction
    cat.onClick(() => {
      // Could trigger special animation or emit event
      cat.play('jump');
      k.wait(0.8, () => cat.play(anim));
    });
  });
}
```

### 3.1 Integration Point

The existing code likely renders StudyBuddyCanvas into an HTML canvas element. Create a wrapper:

```typescript
// src/renderer/game/StudyBuddyGame.ts
import { initGame } from './index';
import { registerStudyBuddyScene } from './scenes/StudyBuddyScene';

export class StudyBuddyGame {
  private k: ReturnType<typeof initGame>;
  
  constructor(canvas: HTMLCanvasElement) {
    this.k = initGame(canvas);
    registerStudyBuddyScene();
  }
  
  start(catColor: string, isActive: boolean, isSleeping: boolean) {
    this.k.go('studyBuddy', { catColor, isActive, isSleeping });
  }
  
  updateState(isActive: boolean, isSleeping: boolean) {
    // Re-enter scene with new state
    // Or use KAPLAY's state management
  }
  
  destroy() {
    this.k.quit();
  }
}
```

---

## Phase 4: Port TownCanvas

Create `src/renderer/game/scenes/TownScene.ts`:

```typescript
import { getGame } from '../index';
import { loadCatSprites, getCatSprite } from '../sprites/catSprites';

export function registerTownScene() {
  const k = getGame();
  
  k.scene('town', async (data: { catColor: string }) => {
    // Load assets
    await loadCatSprites(data.catColor as any);
    
    // Load tileset (you'll need to adapt this to your actual tileset)
    await k.loadSprite('town_tiles', 'assets/sprites/studyquest/town/tileset.png', {
      sliceX: 16,
      sliceY: 16,
    });
    
    // Define tile map (convert from your existing TownCanvas layout)
    const map = k.addLevel([
      '================',
      '=              =',
      '=   B      S   =',
      '=              =',
      '=      P       =',
      '=              =',
      '=   L      G   =',
      '=              =',
      '================',
    ], {
      tileWidth: 32,
      tileHeight: 32,
      tiles: {
        '=': () => [
          k.sprite('town_tiles', { frame: 0 }),
          k.area(),
          k.body({ isStatic: true }),
          k.tile({ isObstacle: true }),
        ],
        'B': () => [
          k.sprite('town_tiles', { frame: 10 }), // Library building
          k.area(),
          'building',
          'library',
        ],
        'S': () => [
          k.sprite('town_tiles', { frame: 11 }), // Shop
          k.area(),
          'building',
          'shop',
        ],
        // ... other tiles
      },
    });
    
    // Add player cat
    const player = k.add([
      k.sprite(getCatSprite(data.catColor as any, 'idle')),
      k.pos(k.width() / 2, k.height() / 2),
      k.anchor('center'),
      k.scale(2),
      k.area(),
      k.body(),
      'player',
    ]);
    
    player.play('idle');
    
    // Movement
    const SPEED = 120;
    
    k.onUpdate(() => {
      let dx = 0;
      let dy = 0;
      
      if (k.isKeyDown('left') || k.isKeyDown('a')) dx = -1;
      if (k.isKeyDown('right') || k.isKeyDown('d')) dx = 1;
      if (k.isKeyDown('up') || k.isKeyDown('w')) dy = -1;
      if (k.isKeyDown('down') || k.isKeyDown('s')) dy = 1;
      
      const moving = dx !== 0 || dy !== 0;
      
      if (moving) {
        // Normalize diagonal movement
        const len = Math.sqrt(dx * dx + dy * dy);
        player.move(dx / len * SPEED, dy / len * SPEED);
        
        // Flip sprite based on direction
        if (dx !== 0) player.flipX = dx < 0;
        
        // Switch to walk animation
        if (player.curAnim() !== 'walk') {
          player.use(k.sprite(getCatSprite(data.catColor as any, 'walk')));
          player.play('walk');
        }
      } else {
        // Switch to idle
        if (player.curAnim() !== 'idle') {
          player.use(k.sprite(getCatSprite(data.catColor as any, 'idle')));
          player.play('idle');
        }
      }
    });
    
    // Building interactions
    player.onCollide('building', (building) => {
      if (k.isKeyPressed('enter') || k.isKeyPressed('space')) {
        if (building.is('library')) {
          // Emit event or transition
          k.go('library');
        } else if (building.is('shop')) {
          k.go('shop');
        }
      }
    });
  });
}
```

---

## Phase 5: Port DungeonCanvas (Most Complex)

### 5.1 Port DungeonGenerator

The procedural generation logic is pure TypeScript - it can stay mostly as-is. Create `src/renderer/game/systems/dungeonGen.ts` and copy the core algorithm from `DungeonGenerator.ts`, adapting the output format for KAPLAY's `addLevel()`.

Key changes:
- Instead of outputting a 2D tile array for manual rendering, output a string array for KAPLAY
- Keep the BSP/room connection logic identical

### 5.2 Create DungeonScene

```typescript
import { getGame } from '../index';
import { loadCatSprites, getCatSprite } from '../sprites/catSprites';
import { generateDungeon } from '../systems/dungeonGen';

export function registerDungeonScene() {
  const k = getGame();
  
  k.scene('dungeon', async (data: { catColor: string; floor: number }) => {
    await loadCatSprites(data.catColor as any);
    
    // Generate dungeon layout
    const { mapString, startPos, exitPos, enemies } = generateDungeon(data.floor);
    
    // Load dungeon tileset
    await k.loadSprite('dungeon_tiles', 'assets/sprites/studyquest/dungeon/tileset.png', {
      sliceX: 16,
      sliceY: 16,
    });
    
    // Create level from generated map
    const level = k.addLevel(mapString, {
      tileWidth: 16,
      tileHeight: 16,
      tiles: {
        '#': () => [
          k.sprite('dungeon_tiles', { frame: 0 }), // Wall
          k.area(),
          k.body({ isStatic: true }),
          k.tile({ isObstacle: true }),
        ],
        '.': () => [
          k.sprite('dungeon_tiles', { frame: 1 }), // Floor
        ],
        'E': () => [
          k.sprite('dungeon_tiles', { frame: 5 }), // Exit stairs
          k.area(),
          'exit',
        ],
      },
    });
    
    // Add player
    const player = k.add([
      k.sprite(getCatSprite(data.catColor as any, 'idle')),
      k.pos(startPos.x * 16, startPos.y * 16),
      k.anchor('center'),
      k.scale(1), // Smaller scale for dungeon
      k.area(),
      k.body(),
      'player',
    ]);
    
    // Camera follow
    player.onUpdate(() => {
      k.camPos(player.pos);
    });
    
    // Movement (similar to town but with camera)
    // ... movement code ...
    
    // Exit collision
    player.onCollide('exit', () => {
      k.go('dungeon', { catColor: data.catColor, floor: data.floor + 1 });
    });
    
    // Mini-map (as UI layer)
    // Port MiniMap.ts logic here
  });
}
```

---

## Phase 6: Testing & Cleanup

### 6.1 Create Feature Flag

During migration, allow switching between old and new:

```typescript
// src/renderer/game/config.ts
export const USE_KAPLAY = true; // Toggle during development
```

### 6.2 Update Entry Points

Modify wherever the canvas games are instantiated (likely in `app.ts` or component files) to conditionally use the new KAPLAY versions.

### 6.3 Remove Old Code

Once all features are ported and tested:

1. Delete `src/renderer/canvas/` directory
2. Remove any canvas-specific utilities
3. Update imports throughout the app

---

## File-by-File Migration Checklist

| Old File | New Location | Status |
|----------|--------------|--------|
| `GameCanvas.ts` | Replaced by KAPLAY core | ✅ |
| `CatSpriteManager.ts` | `game/sprites/catSprites.ts` | ✅ |
| `StudyBuddyCanvas.ts` | `game/scenes/StudyBuddyScene.ts` | ✅ |
| `town/TownCanvas.ts` | `game/scenes/TownScene.ts` | ✅ |
| `dungeon/DungeonCanvas.ts` | `game/scenes/DungeonScene.ts` | ✅ |
| `dungeon/DungeonGenerator.ts` | Reused from canvas (pure logic) | ✅ |
| `dungeon/DungeonLayout.ts` | Reused from canvas (pure data) | ✅ |
| `dungeon/MiniMap.ts` | Pending (UI overlay) | ⬜ |
| `PlayerStatsService.ts` | Keep as-is (pure data) | ✅ |
| `UnlockManager.ts` | Keep as-is (pure data) | ✅ |

---

## Key KAPLAY Concepts Cheat Sheet

| Your Old Code | KAPLAY Equivalent |
|---------------|-------------------|
| `requestAnimationFrame` loop | Built-in, automatic |
| `ctx.drawImage()` | `k.add([k.sprite(...)])` |
| `ctx.fillRect()` | `k.add([k.rect(...)])` |
| `ctx.fillText()` | `k.add([k.text(...)])` |
| `document.addEventListener('keydown')` | `k.onKeyDown()` or `k.isKeyDown()` |
| Manual collision detection | `k.area()` + `k.onCollide()` |
| `this.keys.has('w')` | `k.isKeyDown('w')` |
| Scene switching via class instantiation | `k.go('sceneName')` |
| Frame-based animation counter | `sprite.play('animName')` |

---

## Commands for Claude Code

When working on this migration, use these prompts:

1. **Start Phase 1:**
   > "Install kaplay and create the new directory structure in src/renderer/game/ as outlined in the migration plan"

2. **Port Sprites:**
   > "Port CatSpriteManager.ts to the new KAPLAY sprite system in src/renderer/game/sprites/catSprites.ts"

3. **Port StudyBuddy:**
   > "Create StudyBuddyScene.ts using KAPLAY, matching the functionality of StudyBuddyCanvas.ts"

4. **Port Town:**
   > "Port TownCanvas.ts to TownScene.ts, converting the tile rendering to KAPLAY's addLevel()"

5. **Port Dungeon:**
   > "Port DungeonCanvas.ts and DungeonGenerator.ts to KAPLAY, keeping the procedural generation logic intact"

6. **Cleanup:**
   > "Remove the old src/renderer/canvas/ directory now that all features are ported to KAPLAY"

---

## Gotchas & Tips

1. **Electron + KAPLAY**: KAPLAY works fine in Electron's renderer process. No special config needed.

2. **Asset paths**: Keep using relative paths from the HTML file. KAPLAY's `loadSprite()` uses the same path resolution.

3. **Multiple KAPLAY instances**: If StudyBuddy and Town/Dungeon are in different parts of the UI, you might need separate KAPLAY instances on different canvases. That's fine - just call `kaplay()` with different canvas elements.

4. **TypeScript types**: KAPLAY has excellent TypeScript support. Import types from `'kaplay'` as needed.

5. **Scale/crisp rendering**: Your existing code uses `scale: 2` and `imageSmoothingEnabled = false`. KAPLAY's `crisp: true` option handles this globally.
