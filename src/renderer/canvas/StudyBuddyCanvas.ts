/**
 * StudyBuddyCanvas
 *
 * Small canvas renderer for the Study Buddy cat companion.
 * Shows an animated cat in the corner of the screen that reacts
 * to user activity and occasionally displays speech bubbles.
 */

import { GameCanvas, type Point } from './GameCanvas.js';
import { CatSpriteManager, type CatColor, type CatAnimationType } from './CatSpriteManager.js';
import { createLogger } from '../../shared/logger.js';

const logger = createLogger('StudyBuddyCanvas');

// Canvas dimensions (small widget)
const CANVAS_WIDTH = 100;
const CANVAS_HEIGHT = 120;

// Animation states
export type BuddyState = 'idle' | 'watching' | 'sleeping' | 'celebrating' | 'restless';

// Speech bubble messages
const MESSAGES = {
  sessionStart: ["Let's do this!", 'Ready to study!', 'Focus time!'],
  milestone15: ['Great focus!', "You're doing great!", '15 min!'],
  milestone25: ['Pomodoro complete!', 'Take a break?', 'Amazing focus!'],
  milestone45: ['Wow, marathon!', 'Incredible!', 'Study champion!'],
  returnFromIdle: ['Welcome back!', 'Missed you!', "Let's continue!"],
  foundXP: ['Found some XP!', '*happy meow*', 'Treasure!'],
  breakReminder: ['Stretch time?', 'Rest your eyes!', 'Quick break?'],
  random: ['*purr*', '*meow*', '*yawn*', '...zzz', '!'],
};

interface SpeechBubble {
  text: string;
  opacity: number;
  lifetime: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export class StudyBuddyCanvas extends GameCanvas {
  private catColor: CatColor = 'brown';
  private buddyState: BuddyState = 'idle';
  private animationType: CatAnimationType = 'idle';
  private frameCounter: number = 0;

  // Speech bubble
  private speechBubble: SpeechBubble | null = null;

  // Particles for celebrations
  private particles: Particle[] = [];

  // State timers
  private idleTimer: number = 0;
  private blinkTimer: number = 0;
  private isBlinking: boolean = false;

  // Callbacks
  private onClickCallback?: () => void;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas, CANVAS_WIDTH, CANVAS_HEIGHT, 2);
    logger.info('StudyBuddyCanvas created');
  }

  /**
   * Set the cat color
   */
  setCatColor(color: CatColor): void {
    this.catColor = color;
    // Preload sprites for this color
    CatSpriteManager.loadCat(color).catch((err) => {
      logger.warn(`Failed to load ${color} cat sprites:`, err);
    });
  }

  /**
   * Set the buddy state (changes animation)
   */
  setState(state: BuddyState): void {
    if (this.buddyState === state) return;

    this.buddyState = state;

    switch (state) {
      case 'idle':
        this.animationType = 'idle';
        break;
      case 'watching':
        this.animationType = 'idle'; // Use idle but more attentive
        break;
      case 'sleeping':
        this.animationType = 'sleep';
        break;
      case 'celebrating':
        this.animationType = 'jump';
        this.spawnCelebrationParticles();
        break;
      case 'restless':
        this.animationType = 'run';
        break;
    }

    logger.info(`Buddy state: ${state}`);
  }

  /**
   * Show a speech bubble with a message
   */
  showSpeechBubble(text: string, duration: number = 3000): void {
    this.speechBubble = {
      text,
      opacity: 1,
      lifetime: duration,
    };
  }

  /**
   * Show a random message from a category
   */
  showRandomMessage(category: keyof typeof MESSAGES): void {
    const messages = MESSAGES[category];
    const text = messages[Math.floor(Math.random() * messages.length)];
    this.showSpeechBubble(text);
  }

  /**
   * Trigger celebration animation
   */
  celebrate(): void {
    this.setState('celebrating');
    setTimeout(() => {
      if (this.buddyState === 'celebrating') {
        this.setState('idle');
      }
    }, 2000);
  }

  /**
   * Set click callback
   */
  setOnClick(callback: () => void): void {
    this.onClickCallback = callback;
  }

  // ============================================================================
  // GameCanvas Implementation
  // ============================================================================

  protected update(deltaTime: number): void {
    this.frameCounter++;

    // Update idle timer
    this.idleTimer += deltaTime;

    // Random blinks
    this.blinkTimer += deltaTime;
    if (this.blinkTimer > 3000 + Math.random() * 2000) {
      this.blinkTimer = 0;
      this.isBlinking = true;
      setTimeout(() => {
        this.isBlinking = false;
      }, 150);
    }

    // Update speech bubble
    if (this.speechBubble) {
      this.speechBubble.lifetime -= deltaTime;
      if (this.speechBubble.lifetime < 500) {
        this.speechBubble.opacity = this.speechBubble.lifetime / 500;
      }
      if (this.speechBubble.lifetime <= 0) {
        this.speechBubble = null;
      }
    }

    // Update particles
    this.updateParticles(deltaTime);

    // Switch to idle2 animation occasionally when idle
    if (this.buddyState === 'idle' && this.idleTimer > 10000) {
      this.animationType = this.animationType === 'idle' ? 'idle2' : 'idle';
      this.idleTimer = 0;
    }

    // Sitting behavior when very idle
    if (this.buddyState === 'idle' && this.idleTimer > 30000) {
      this.animationType = 'sit';
      this.idleTimer = 0;
    }
  }

  protected render(): void {
    // Clear with transparent background
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Draw cat
    this.drawCat();

    // Draw particles
    this.drawParticles();

    // Draw speech bubble
    if (this.speechBubble) {
      this.drawSpeechBubble();
    }
  }

  protected onClick(position: Point): void {
    // Check if click is on the cat area (matches drawCat positioning)
    // Sprite is 64x64, centered at x=50, top at y=40
    const catArea = { x: 18, y: 40, width: 64, height: 64 };
    if (
      position.x >= catArea.x &&
      position.x <= catArea.x + catArea.width &&
      position.y >= catArea.y &&
      position.y <= catArea.y + catArea.height
    ) {
      // Show random message when clicked
      this.showRandomMessage('random');

      // Trigger callback
      if (this.onClickCallback) {
        this.onClickCallback();
      }
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private drawCat(): void {
    const x = this.width / 2;
    const spriteHeight = 64; // 32px * 2 scale
    const y = this.height - spriteHeight - 16; // Position sprite above bottom margin

    // Draw shadow (below the sprite feet)
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    this.ctx.beginPath();
    this.ctx.ellipse(x, y + spriteHeight + 6, 25, 8, 0, 0, Math.PI * 2);
    this.ctx.fill();

    // Draw cat sprite
    CatSpriteManager.drawAnimated(
      this.ctx,
      this.catColor,
      this.animationType,
      x,
      y,
      this.frameCounter,
      2,
      'right'
    );

    // Draw blink overlay (eyes are roughly in upper third of sprite)
    if (this.isBlinking && this.animationType !== 'sleep') {
      this.ctx.fillStyle = this.catColor === 'white' ? '#e0e0e0' : '#ffffff';
      this.ctx.fillRect(x - 10, y + 20, 4, 2);
      this.ctx.fillRect(x + 6, y + 20, 4, 2);
    }
  }

  private drawSpeechBubble(): void {
    if (!this.speechBubble) return;

    const bubbleX = 10;
    const bubbleY = 5;
    const bubbleWidth = 80;
    const bubbleHeight = 30;
    const tailSize = 8;

    this.ctx.save();
    this.ctx.globalAlpha = this.speechBubble.opacity;

    // Bubble background
    this.ctx.fillStyle = '#ffffff';
    this.ctx.strokeStyle = '#333333';
    this.ctx.lineWidth = 2;

    // Rounded rectangle
    this.ctx.beginPath();
    this.ctx.roundRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight, 8);
    this.ctx.fill();
    this.ctx.stroke();

    // Tail
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.moveTo(bubbleX + 20, bubbleY + bubbleHeight);
    this.ctx.lineTo(bubbleX + 25, bubbleY + bubbleHeight + tailSize);
    this.ctx.lineTo(bubbleX + 35, bubbleY + bubbleHeight);
    this.ctx.fill();

    // Tail border
    this.ctx.beginPath();
    this.ctx.moveTo(bubbleX + 20, bubbleY + bubbleHeight);
    this.ctx.lineTo(bubbleX + 25, bubbleY + bubbleHeight + tailSize);
    this.ctx.lineTo(bubbleX + 35, bubbleY + bubbleHeight);
    this.ctx.stroke();

    // Cover the tail top with white to merge with bubble
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(bubbleX + 21, bubbleY + bubbleHeight - 2, 13, 4);

    // Text
    this.ctx.fillStyle = '#333333';
    this.ctx.font = 'bold 9px "Courier New", monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(
      this.speechBubble.text,
      bubbleX + bubbleWidth / 2,
      bubbleY + bubbleHeight / 2 + 3
    );

    this.ctx.restore();
  }

  private spawnCelebrationParticles(): void {
    const centerX = this.width / 2;
    const centerY = this.height - 50;
    const colors = ['#ffd700', '#ff6b6b', '#4ade80', '#60a5fa', '#f472b6'];

    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 * i) / 20;
      const speed = 1 + Math.random() * 2;

      this.particles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 2 + Math.random() * 3,
      });
    }
  }

  private updateParticles(deltaTime: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1; // Gravity
      p.life -= deltaTime / 1000;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  private drawParticles(): void {
    for (const p of this.particles) {
      this.ctx.save();
      this.ctx.globalAlpha = p.life;
      this.ctx.fillStyle = p.color;
      this.ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      this.ctx.restore();
    }
  }
}
