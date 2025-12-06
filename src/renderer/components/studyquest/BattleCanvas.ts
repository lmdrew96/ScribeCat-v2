/**
 * BattleCanvas
 *
 * Canvas-based renderer for StudyQuest battle scenes.
 * Handles drawing sprites, HP bars, damage numbers, and battle animations.
 */

import { createLogger } from '../../../shared/logger.js';
import type { BattleParticipant, StudyQuestBattleData } from '../../../domain/entities/StudyQuestBattle.js';
import { SpriteLoader, type CatColor, type EnemyType, type BattlerType, type BackgroundType, type AnimationType } from './SpriteLoader.js';

const logger = createLogger('BattleCanvas');

// Canvas dimensions
const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 270;

// Colors
const COLORS = {
  background: '#1a1a2e',
  groundLight: '#2a2a4e',
  groundDark: '#1f1f3a',
  hpBarBg: '#333355',
  hpBarPlayer: '#22c55e',
  hpBarEnemy: '#ef4444',
  hpBarLow: '#f59e0b',
  white: '#ffffff',
  gold: '#ffd700',
  textShadow: '#000000',
  crit: '#ff6b6b',
  heal: '#4ade80',
  miss: '#888888',
};

interface DamageNumber {
  x: number;
  y: number;
  value: number;
  color: string;
  opacity: number;
  offsetY: number;
  isCrit: boolean;
}

interface AnimationState {
  playerShake: number;
  enemyShake: number;
  playerFlash: number;
  enemyFlash: number;
  damageNumbers: DamageNumber[];
  playerAnimation: AnimationType;
  enemyAnimation: AnimationType;
  frameCounter: number;
}

export class BattleCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animationFrame: number | null = null;
  private battle: StudyQuestBattleData | null = null;
  private playerColor: CatColor = 'brown';
  private enemyType: EnemyType = 'slime';
  private battlerType: BattlerType | null = null; // For HD static battler images
  private backgroundType: BackgroundType = 'battle_default';
  private spritesLoaded = false;
  private backgroundLoaded = false;

  private animation: AnimationState = {
    playerShake: 0,
    enemyShake: 0,
    playerFlash: 0,
    enemyFlash: 0,
    damageNumbers: [],
    playerAnimation: 'idle',
    enemyAnimation: 'idle',
    frameCounter: 0,
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.canvas.width = CANVAS_WIDTH;
    this.canvas.height = CANVAS_HEIGHT;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false; // Crisp pixel art

    logger.info('BattleCanvas initialized');
  }

  /**
   * Set battle data and start rendering
   */
  async setBattle(battle: StudyQuestBattleData, playerColor: CatColor = 'brown'): Promise<void> {
    this.battle = battle;
    this.playerColor = playerColor;

    // Check if enemy should use HD battler or sprite sheet
    this.battlerType = this.guessBattlerType(battle.enemy.name);
    this.enemyType = this.guessEnemyType(battle.enemy.name);
    this.backgroundType = this.guessBackgroundType(battle.enemy.name);

    // Load sprites and assets
    await this.loadSprites();

    this.startRenderLoop();
  }

  /**
   * Update battle state
   */
  updateBattle(battle: StudyQuestBattleData): void {
    this.battle = battle;
  }

  /**
   * Clear battle and stop rendering
   */
  clear(): void {
    this.battle = null;
    this.stopRenderLoop();
    this.clearCanvas();
  }

  /**
   * Play damage animation for player or enemy
   */
  playDamageAnimation(target: 'player' | 'enemy', damage: number, isCrit: boolean): void {
    if (target === 'player') {
      this.animation.playerShake = 10;
      this.animation.playerFlash = 6;
      this.animation.playerAnimation = 'hurt';
      setTimeout(() => {
        this.animation.playerAnimation = 'idle';
      }, 400);
    } else {
      this.animation.enemyShake = 10;
      this.animation.enemyFlash = 6;
      this.animation.enemyAnimation = 'hurt';
      setTimeout(() => {
        this.animation.enemyAnimation = 'idle';
      }, 400);
    }

    // Add floating damage number
    const x = target === 'player' ? 120 : 360;
    const y = target === 'player' ? 160 : 80;

    this.animation.damageNumbers.push({
      x: x + (Math.random() * 20 - 10),
      y,
      value: damage,
      color: isCrit ? COLORS.crit : COLORS.white,
      opacity: 1,
      offsetY: 0,
      isCrit,
    });
  }

  /**
   * Play attack animation
   */
  playAttackAnimation(attacker: 'player' | 'enemy'): void {
    if (attacker === 'player') {
      this.animation.playerAnimation = 'attack';
      setTimeout(() => {
        this.animation.playerAnimation = 'idle';
      }, 500);
    } else {
      this.animation.enemyAnimation = 'attack';
      setTimeout(() => {
        this.animation.enemyAnimation = 'idle';
      }, 500);
    }
  }

  /**
   * Play heal animation
   */
  playHealAnimation(target: 'player' | 'enemy', amount: number): void {
    const x = target === 'player' ? 120 : 360;
    const y = target === 'player' ? 160 : 80;

    this.animation.damageNumbers.push({
      x,
      y,
      value: amount,
      color: COLORS.heal,
      opacity: 1,
      offsetY: 0,
      isCrit: false,
    });
  }

  /**
   * Play miss animation
   */
  playMissAnimation(target: 'player' | 'enemy'): void {
    const x = target === 'player' ? 120 : 360;
    const y = target === 'player' ? 160 : 80;

    this.animation.damageNumbers.push({
      x,
      y,
      value: -1, // Special value for "MISS"
      color: COLORS.miss,
      opacity: 1,
      offsetY: 0,
      isCrit: false,
    });
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async loadSprites(): Promise<void> {
    try {
      const loadPromises: Promise<void>[] = [
        SpriteLoader.loadCatSprites(this.playerColor),
        SpriteLoader.loadBackground(this.backgroundType),
      ];

      // Load either battler or sprite sheet enemy
      if (this.battlerType) {
        loadPromises.push(SpriteLoader.loadBattler(this.battlerType));
      } else {
        loadPromises.push(SpriteLoader.loadEnemySprites(this.enemyType));
      }

      await Promise.all(loadPromises);
      this.spritesLoaded = true;
      this.backgroundLoaded = true;
      logger.info('Battle sprites and background loaded');
    } catch (error) {
      logger.error('Failed to load sprites:', error);
      this.spritesLoaded = false;
    }
  }

  private startRenderLoop(): void {
    if (this.animationFrame !== null) return;

    const render = (): void => {
      this.render();
      this.updateAnimations();
      this.animationFrame = requestAnimationFrame(render);
    };

    this.animationFrame = requestAnimationFrame(render);
  }

  private stopRenderLoop(): void {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  private clearCanvas(): void {
    this.ctx.fillStyle = COLORS.background;
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  private render(): void {
    if (!this.battle) {
      this.clearCanvas();
      return;
    }

    // Clear canvas
    this.clearCanvas();

    // Draw background
    this.drawBackground();

    // Draw enemy (on the right, facing left)
    this.drawCharacter(
      this.battle.enemy,
      360,
      80,
      this.animation.enemyShake,
      this.animation.enemyFlash > 0,
      false, // isPlayer
      true // flipX - enemy faces left
    );

    // Draw player (on the left, facing right)
    this.drawCharacter(
      this.battle.player,
      120,
      160,
      this.animation.playerShake,
      this.animation.playerFlash > 0,
      true, // isPlayer
      false // flipX
    );

    // Draw HP bars
    this.drawHpBar(this.battle.player, 20, 220, true);
    this.drawHpBar(this.battle.enemy, 280, 40, false);

    // Draw turn indicator
    this.drawTurnIndicator();

    // Draw damage numbers
    this.drawDamageNumbers();
  }

  private drawBackground(): void {
    // Try to draw loaded background image
    if (this.backgroundLoaded) {
      SpriteLoader.drawBackground(this.ctx, this.backgroundType, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Add slight darkening overlay for better contrast
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      return;
    }

    // Fallback: Simple gradient ground
    const gradient = this.ctx.createLinearGradient(0, CANVAS_HEIGHT / 2, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, COLORS.groundDark);
    gradient.addColorStop(1, COLORS.groundLight);

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, CANVAS_HEIGHT / 2, CANVAS_WIDTH, CANVAS_HEIGHT / 2);

    // Simple pattern for retro feel
    this.ctx.strokeStyle = COLORS.groundDark;
    this.ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const y = CANVAS_HEIGHT / 2 + i * 20;
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(CANVAS_WIDTH, y);
      this.ctx.stroke();
    }
  }

  private drawCharacter(
    participant: BattleParticipant,
    x: number,
    y: number,
    shake: number,
    flash: boolean,
    isPlayer: boolean,
    flipX: boolean
  ): void {
    const shakeOffset = shake > 0 ? (Math.random() * 4 - 2) : 0;
    const drawX = x + shakeOffset;

    this.ctx.save();

    if (flash) {
      this.ctx.globalAlpha = 0.5;
    }

    if (isPlayer) {
      // Draw player cat sprite
      const animType = this.animation.playerAnimation;
      const sprite = SpriteLoader.getCatSprite(this.playerColor, animType);

      if (sprite && this.spritesLoaded) {
        const frameIndex = Math.floor(this.animation.frameCounter / 6) % sprite.frameCount;
        SpriteLoader.drawFrame(this.ctx, sprite, frameIndex, drawX, y, 2, flipX);
      } else {
        this.drawPlaceholderCharacter(drawX, y, isPlayer, participant.isDefending);
      }
    } else {
      // Draw enemy - use battler (HD static image) or sprite sheet
      if (this.battlerType && this.spritesLoaded) {
        // HD battler image - draw larger
        SpriteLoader.drawBattler(this.ctx, this.battlerType, drawX, y, 100, 100, flipX);
      } else {
        const animType = this.animation.enemyAnimation;
        const sprite = SpriteLoader.getEnemySprite(this.enemyType, animType);

        if (sprite && this.spritesLoaded) {
          const frameIndex = Math.floor(this.animation.frameCounter / 6) % sprite.frameCount;
          SpriteLoader.drawFrame(this.ctx, sprite, frameIndex, drawX, y, 2, flipX);
        } else {
          this.drawPlaceholderCharacter(drawX, y, isPlayer, participant.isDefending);
        }
      }
    }

    this.ctx.restore();

    // Defending indicator
    if (participant.isDefending) {
      this.ctx.strokeStyle = '#3b82f6';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.arc(drawX, y + 20, 40, 0, Math.PI * 2);
      this.ctx.stroke();
    }
  }

  private drawPlaceholderCharacter(x: number, y: number, isPlayer: boolean, isDefending: boolean): void {
    // Simple placeholder cat shape when sprites aren't loaded
    const color = isPlayer ? '#6366f1' : '#22c55e';

    // Body
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x - 20, y - 24, 40, 32);

    // Head
    this.ctx.fillRect(x - 16, y - 44, 32, 24);

    // Ears
    this.ctx.beginPath();
    this.ctx.moveTo(x - 14, y - 44);
    this.ctx.lineTo(x - 10, y - 56);
    this.ctx.lineTo(x - 6, y - 44);
    this.ctx.fill();

    this.ctx.beginPath();
    this.ctx.moveTo(x + 14, y - 44);
    this.ctx.lineTo(x + 10, y - 56);
    this.ctx.lineTo(x + 6, y - 44);
    this.ctx.fill();

    // Eyes
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(x - 10, y - 38, 6, 6);
    this.ctx.fillRect(x + 4, y - 38, 6, 6);

    // Pupils
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(x - 8 + (isPlayer ? 2 : 0), y - 36, 3, 4);
    this.ctx.fillRect(x + 6 + (isPlayer ? 2 : 0), y - 36, 3, 4);

    // Mouth/nose
    this.ctx.fillStyle = '#ff9999';
    this.ctx.fillRect(x - 2, y - 28, 4, 3);
  }

  private drawHpBar(participant: BattleParticipant, x: number, y: number, isPlayer: boolean): void {
    const barWidth = 180;
    const barHeight = 16;
    const hpPercent = participant.hp / participant.maxHp;
    const fillWidth = Math.max(0, barWidth * hpPercent);

    // Name positioning: enemy above HP bar, player below HP bar
    this.ctx.font = 'bold 10px "Courier New", monospace';
    this.ctx.textAlign = 'center';

    if (!isPlayer) {
      // Enemy name above HP bar
      this.ctx.fillStyle = COLORS.textShadow;
      this.ctx.fillText(participant.name, x + barWidth / 2 + 1, y - 5);
      this.ctx.fillStyle = COLORS.white;
      this.ctx.fillText(participant.name, x + barWidth / 2, y - 6);
    }

    // Background
    this.ctx.fillStyle = COLORS.hpBarBg;
    this.ctx.fillRect(x, y, barWidth, barHeight);

    // HP fill
    let fillColor = isPlayer ? COLORS.hpBarPlayer : COLORS.hpBarEnemy;
    if (hpPercent <= 0.25) {
      fillColor = COLORS.hpBarLow;
    }
    this.ctx.fillStyle = fillColor;
    this.ctx.fillRect(x + 2, y + 2, Math.max(0, fillWidth - 4), barHeight - 4);

    // Border
    this.ctx.strokeStyle = '#4a4a6a';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x, y, barWidth, barHeight);

    // HP text
    this.ctx.fillStyle = COLORS.white;
    this.ctx.font = '10px "Courier New", monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(
      `${participant.hp}/${participant.maxHp}`,
      x + barWidth / 2,
      y + barHeight - 3
    );

    // Player name below HP bar
    if (isPlayer) {
      this.ctx.font = 'bold 10px "Courier New", monospace';
      this.ctx.fillStyle = COLORS.textShadow;
      this.ctx.fillText(participant.name, x + barWidth / 2 + 1, y + barHeight + 12);
      this.ctx.fillStyle = COLORS.white;
      this.ctx.fillText(participant.name, x + barWidth / 2, y + barHeight + 11);
    }
  }

  private drawTurnIndicator(): void {
    if (!this.battle) return;

    const isPlayerTurn = this.battle.currentTurn === 'player';
    const text = isPlayerTurn ? 'YOUR TURN' : 'ENEMY TURN';
    const color = isPlayerTurn ? COLORS.gold : COLORS.crit;

    this.ctx.fillStyle = color;
    this.ctx.font = 'bold 14px "Courier New", monospace';
    this.ctx.textAlign = 'center';

    // Shadow
    this.ctx.fillStyle = COLORS.textShadow;
    this.ctx.fillText(text, CANVAS_WIDTH / 2 + 2, 22);

    // Text
    this.ctx.fillStyle = color;
    this.ctx.fillText(text, CANVAS_WIDTH / 2, 20);
  }

  private drawDamageNumbers(): void {
    for (const num of this.animation.damageNumbers) {
      this.ctx.globalAlpha = num.opacity;
      this.ctx.fillStyle = num.color;
      this.ctx.font = num.isCrit ? 'bold 18px "Courier New", monospace' : 'bold 14px "Courier New", monospace';
      this.ctx.textAlign = 'center';

      let text: string;
      if (num.value === -1) {
        text = 'MISS';
      } else if (num.color === COLORS.heal) {
        text = `+${num.value}`;
      } else {
        text = `-${num.value}`;
        if (num.isCrit) text += '!';
      }

      // Shadow
      this.ctx.fillStyle = COLORS.textShadow;
      this.ctx.fillText(text, num.x + 1, num.y - num.offsetY + 1);

      // Text
      this.ctx.fillStyle = num.color;
      this.ctx.fillText(text, num.x, num.y - num.offsetY);
    }
    this.ctx.globalAlpha = 1;
  }

  private updateAnimations(): void {
    // Update frame counter for sprite animation
    this.animation.frameCounter++;

    // Update shake
    if (this.animation.playerShake > 0) this.animation.playerShake--;
    if (this.animation.enemyShake > 0) this.animation.enemyShake--;

    // Update flash
    if (this.animation.playerFlash > 0) this.animation.playerFlash--;
    if (this.animation.enemyFlash > 0) this.animation.enemyFlash--;

    // Update damage numbers
    for (const num of this.animation.damageNumbers) {
      num.offsetY += 1.5;
      num.opacity -= 0.02;
    }

    // Remove faded numbers
    this.animation.damageNumbers = this.animation.damageNumbers.filter((n) => n.opacity > 0);
  }

  private guessEnemyType(name: string): EnemyType {
    const lower = name.toLowerCase();

    if (lower.includes('slime') || lower.includes('blob') || lower.includes('rat') || lower.includes('wolf')) {
      return 'slime';
    }
    if (lower.includes('ghost') || lower.includes('spirit') || lower.includes('phantom') || lower.includes('specter')) {
      return 'ghost';
    }

    // Default to slime for now
    return 'slime';
  }

  /**
   * Guess battler type from enemy name (HD static images)
   * Returns null if should use sprite sheet instead
   */
  private guessBattlerType(name: string): BattlerType | null {
    const lower = name.toLowerCase();

    // Match specific HD battler enemies
    if (lower.includes('yarn') || lower.includes('ball') || lower.includes('string') || lower.includes('thread')) {
      return 'yarn_elemental';
    }
    if (lower.includes('roomba') || lower.includes('vacuum') || lower.includes('robot') || lower.includes('cleaner')) {
      return 'roomba';
    }
    if (lower.includes('duck') || lower.includes('rubber') || lower.includes('bath') || lower.includes('ducky')) {
      return 'rubber_ducky';
    }

    // Training enemies - use animated sprite sheet (slime), not HD battler
    // Slime battler images are sprite sheets, not single images
    if (lower.includes('target') || lower.includes('dummy') || lower.includes('training') || lower.includes('practice')) {
      return null; // Fall back to animated slime sprite
    }

    // Slime/blob enemies - use animated sprite sheet
    if (lower.includes('slime') || lower.includes('blob') || lower.includes('ooze') || lower.includes('jelly')) {
      return null; // Fall back to animated slime sprite
    }

    // No HD battler, use sprite sheet
    return null;
  }

  /**
   * Guess background type from enemy name/context
   */
  private guessBackgroundType(name: string): BackgroundType {
    const lower = name.toLowerCase();

    // Boss enemies get special backgrounds
    if (lower.includes('boss') || lower.includes('dragon') || lower.includes('final')) {
      return 'alley'; // Dark alley for boss fights
    }

    // Shop-related enemies
    if (lower.includes('merchant') || lower.includes('trader')) {
      return 'shop';
    }

    // Default to alley (it looks good for battles)
    return 'alley';
  }
}
