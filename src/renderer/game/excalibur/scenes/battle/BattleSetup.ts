/**
 * BattleSetup
 *
 * Handles battle scene setup including background, combatants,
 * and sprite loading.
 */

import * as ex from 'excalibur';
import { GameState } from '../../../state/GameState.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../../../config.js';
import { loadCatAnimation } from '../../adapters/SpriteAdapter.js';
import { type EnemyDefinition, calculateEnemyScale } from '../../../data/enemies.js';
import { loadBackground, createBackgroundActor } from '../../../loaders/BackgroundLoader.js';
import {
  loadStaticEnemySprite,
  loadSlimeAnimation,
  getSlimeColorFromFolder,
  getStaticEnemyIdFromFile,
} from '../../../loaders/EnemySpriteLoader.js';
import { AudioManager } from '../../../audio/AudioManager.js';

export interface BattleSetupConfig {
  enemySize: number;
  playerSize: number;
}

export interface CombatantSetupResult {
  playerEntity: ex.Actor;
  enemyEntity: ex.Actor;
  playerAnimations: Map<string, ex.Animation>;
  enemyAnimations: Map<string, ex.Animation>;
  enemyIsAnimated: boolean;
  playerStartPos: ex.Vector;
  enemyStartPos: ex.Vector;
  uiElements: ex.Actor[];
}

/**
 * Handles battle scene setup and resource loading
 */
export class BattleSetup {
  private scene: ex.Scene;
  private config: BattleSetupConfig;

  constructor(scene: ex.Scene, config: BattleSetupConfig) {
    this.scene = scene;
    this.config = config;
  }

  /**
   * Setup battle background with floor and music
   */
  async setupBackground(floorLevel: number): Promise<ex.Actor[]> {
    const uiElements: ex.Actor[] = [];

    // Try to load a themed background based on dungeon
    const bgImage = await loadBackground('moonlake');

    if (bgImage) {
      const bgActor = createBackgroundActor(bgImage, CANVAS_WIDTH, CANVAS_HEIGHT, 0);
      this.scene.add(bgActor);
    } else {
      // Fallback to solid color
      const bg = new ex.Actor({
        pos: new ex.Vector(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2),
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        z: 0,
      });
      bg.graphics.use(
        new ex.Rectangle({
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          color: ex.Color.fromHex('#1E1E32'),
        })
      );
      this.scene.add(bg);
    }

    // Floor/ground area
    const floor = new ex.Actor({
      pos: new ex.Vector(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 75),
      width: CANVAS_WIDTH,
      height: 150,
      z: 1,
    });
    floor.graphics.use(
      new ex.Rectangle({
        width: CANVAS_WIDTH,
        height: 150,
        color: ex.Color.fromHex('#324632'),
      })
    );
    this.scene.add(floor);

    // Floor level label
    const floorLabel = new ex.Label({
      text: `Floor ${floorLevel}`,
      pos: new ex.Vector(CANVAS_WIDTH - 80, 15),
      font: new ex.Font({ size: 13, color: ex.Color.fromRGB(200, 200, 200) }),
      z: 100,
    });
    this.scene.add(floorLabel);
    uiElements.push(floorLabel);

    // Start battle music
    AudioManager.playSceneMusic('battle');

    return uiElements;
  }

  /**
   * Setup player and enemy combatants with their animations
   */
  async setupCombatants(enemyDef: EnemyDefinition): Promise<CombatantSetupResult> {
    const uiElements: ex.Actor[] = [];
    const targetEnemySize = this.config.enemySize;

    // --- Enemy Setup ---
    const enemyEntity = new ex.Actor({
      pos: new ex.Vector(CANVAS_WIDTH / 2, 120),
      width: targetEnemySize,
      height: targetEnemySize,
      z: 20,
    });

    const enemyAnimations = new Map<string, ex.Animation>();
    let enemyIsAnimated = false;
    let spriteLoaded = false;

    if (enemyDef.spriteFolder) {
      // Animated slime enemy - load all animations
      const slimeColor = getSlimeColorFromFolder(enemyDef.spriteFolder);
      if (slimeColor) {
        const animTypes = ['idle', 'attack', 'hurt', 'death1'] as const;
        for (const animType of animTypes) {
          const anim = await loadSlimeAnimation(slimeColor, animType);
          if (anim) {
            const scale = calculateEnemyScale(enemyDef, targetEnemySize);
            anim.scale = new ex.Vector(scale, scale);
            enemyAnimations.set(animType, anim);
          }
        }

        const idleAnim = enemyAnimations.get('idle');
        if (idleAnim) {
          enemyEntity.graphics.use(idleAnim);
          enemyIsAnimated = true;
          spriteLoaded = true;
        }
      }
    } else if (enemyDef.spriteFile) {
      // Static enemy (single PNG)
      const enemyId = getStaticEnemyIdFromFile(enemyDef.spriteFile);
      if (enemyId) {
        const sprite = await loadStaticEnemySprite(enemyId);
        if (sprite) {
          // Scale to normalize display size
          const scale = calculateEnemyScale(enemyDef, targetEnemySize);
          sprite.scale = new ex.Vector(scale, scale);
          enemyEntity.graphics.use(sprite);
          spriteLoaded = true;
        }
      }
    }

    // Fallback to placeholder if sprite loading failed
    if (!spriteLoaded) {
      const enemyColor = enemyDef.placeholderColor || [150, 50, 50];
      enemyEntity.graphics.use(
        new ex.Rectangle({
          width: targetEnemySize,
          height: targetEnemySize,
          color: ex.Color.fromRGB(enemyColor[0], enemyColor[1], enemyColor[2]),
          strokeColor: ex.Color.Black,
          lineWidth: 3,
        })
      );
    }
    this.scene.add(enemyEntity);

    // Enemy name label
    const enemyName = new ex.Label({
      text: enemyDef.name,
      pos: new ex.Vector(CANVAS_WIDTH / 2, 40),
      font: new ex.Font({ size: 14, color: ex.Color.White }),
      z: 100,
    });
    enemyName.graphics.anchor = ex.Vector.Half;
    this.scene.add(enemyName);
    uiElements.push(enemyName);

    // --- Player Setup ---
    const playerEntity = new ex.Actor({
      pos: new ex.Vector(100, 190),
      width: this.config.playerSize,
      height: this.config.playerSize,
      z: 25,
    });

    // Load all battle animations for player
    const playerAnimations = new Map<string, ex.Animation>();
    const playerAnimTypes = ['idle', 'attack', 'hurt', 'die'] as const;
    for (const animType of playerAnimTypes) {
      try {
        const anim = await loadCatAnimation(GameState.player.catColor, animType);
        if (anim) {
          anim.scale = new ex.Vector(2, 2);
          playerAnimations.set(animType, anim);
        }
      } catch {
        // Animation not available, skip
      }
    }

    // Use idle animation as default
    const idleAnim = playerAnimations.get('idle');
    if (idleAnim) {
      playerEntity.graphics.use(idleAnim);
    } else {
      playerEntity.graphics.use(
        new ex.Rectangle({
          width: this.config.playerSize,
          height: this.config.playerSize,
          color: ex.Color.Gray,
        })
      );
    }
    this.scene.add(playerEntity);

    return {
      playerEntity,
      enemyEntity,
      playerAnimations,
      enemyAnimations,
      enemyIsAnimated,
      playerStartPos: playerEntity.pos.clone(),
      enemyStartPos: enemyEntity.pos.clone(),
      uiElements,
    };
  }
}
