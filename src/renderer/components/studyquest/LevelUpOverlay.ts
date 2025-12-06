/**
 * LevelUpOverlay
 *
 * GSAP-animated level up celebration overlay for StudyQuest.
 * Shows when the player levels up with stat increases.
 */

import { gsap } from 'gsap';
import { createLogger } from '../../../shared/logger.js';
import { StudyQuestSound } from './StudyQuestSound.js';

const logger = createLogger('LevelUpOverlay');

interface StatIncrease {
  hp: number;
  attack: number;
  defense: number;
  speed: number;
}

export class LevelUpOverlay {
  private container: HTMLElement | null = null;
  private isShowing = false;

  constructor() {
    this.createOverlay();
  }

  /**
   * Create the overlay element
   */
  private createOverlay(): void {
    // Check if overlay already exists
    const existing = document.getElementById('studyquest-levelup-overlay');
    if (existing) {
      this.container = existing;
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'studyquest-levelup-overlay';
    overlay.className = 'studyquest-levelup-overlay';
    overlay.innerHTML = `
      <div class="levelup-content">
        <div class="levelup-glow"></div>
        <div class="levelup-text">LEVEL UP!</div>
        <div class="levelup-level">Lv. <span class="levelup-level-number">--</span></div>
        <div class="levelup-stats">
          <div class="levelup-stat" data-stat="hp">
            <span class="stat-icon">+</span>
            <span class="stat-value">0</span>
            <span class="stat-name">HP</span>
          </div>
          <div class="levelup-stat" data-stat="attack">
            <span class="stat-icon">+</span>
            <span class="stat-value">0</span>
            <span class="stat-name">ATK</span>
          </div>
          <div class="levelup-stat" data-stat="defense">
            <span class="stat-icon">+</span>
            <span class="stat-value">0</span>
            <span class="stat-name">DEF</span>
          </div>
          <div class="levelup-stat" data-stat="speed">
            <span class="stat-icon">+</span>
            <span class="stat-value">0</span>
            <span class="stat-name">SPD</span>
          </div>
        </div>
        <div class="levelup-continue">Click to continue</div>
      </div>
    `;

    // Add click handler to dismiss
    overlay.addEventListener('click', () => {
      this.hide();
    });

    document.body.appendChild(overlay);
    this.container = overlay;
  }

  /**
   * Show the level up overlay with animation
   */
  async show(
    oldLevel: number,
    newLevel: number,
    statIncreases: StatIncrease
  ): Promise<void> {
    if (!this.container || this.isShowing) return;

    this.isShowing = true;
    logger.info(`Showing level up overlay: ${oldLevel} -> ${newLevel}`);

    // Update content
    const levelNumber = this.container.querySelector('.levelup-level-number');
    if (levelNumber) {
      levelNumber.textContent = String(newLevel);
    }

    // Update stat values
    const statElements = {
      hp: this.container.querySelector('[data-stat="hp"] .stat-value'),
      attack: this.container.querySelector('[data-stat="attack"] .stat-value'),
      defense: this.container.querySelector('[data-stat="defense"] .stat-value'),
      speed: this.container.querySelector('[data-stat="speed"] .stat-value'),
    };

    if (statElements.hp) statElements.hp.textContent = String(statIncreases.hp);
    if (statElements.attack) statElements.attack.textContent = String(statIncreases.attack);
    if (statElements.defense) statElements.defense.textContent = String(statIncreases.defense);
    if (statElements.speed) statElements.speed.textContent = String(statIncreases.speed);

    // Show overlay
    this.container.style.display = 'flex';
    this.container.style.opacity = '0';

    // Play level up sound
    StudyQuestSound.play('level-up');

    // Run GSAP animation
    return new Promise((resolve) => {
      const tl = gsap.timeline({
        onComplete: () => {
          // Don't auto-hide - wait for click
        },
      });

      // Fade in overlay
      tl.to(this.container, {
        opacity: 1,
        duration: 0.2,
      });

      // Animate LEVEL UP text
      tl.from('.levelup-text', {
        scale: 0,
        duration: 0.4,
        ease: 'back.out(1.7)',
      });

      // Flash the glow
      tl.fromTo(
        '.levelup-glow',
        { opacity: 0, scale: 0.5 },
        { opacity: 0.8, scale: 1.5, duration: 0.3, ease: 'power2.out' },
        '-=0.2'
      );

      tl.to('.levelup-glow', {
        opacity: 0.3,
        scale: 1,
        duration: 0.5,
        ease: 'power2.inOut',
      });

      // Animate level number
      tl.from(
        '.levelup-level',
        {
          y: -30,
          opacity: 0,
          duration: 0.3,
          ease: 'power2.out',
        },
        '-=0.3'
      );

      // Animate stats with stagger
      tl.from('.levelup-stat', {
        y: 20,
        opacity: 0,
        stagger: 0.1,
        duration: 0.3,
        ease: 'power2.out',
      });

      // Fade in continue text
      tl.from('.levelup-continue', {
        opacity: 0,
        duration: 0.5,
      });

      // Resolve when animation completes
      tl.call(() => resolve());
    });
  }

  /**
   * Hide the overlay
   */
  hide(): void {
    if (!this.container || !this.isShowing) return;

    gsap.to(this.container, {
      opacity: 0,
      duration: 0.3,
      onComplete: () => {
        if (this.container) {
          this.container.style.display = 'none';
        }
        this.isShowing = false;
      },
    });
  }

  /**
   * Check if overlay is currently showing
   */
  getIsShowing(): boolean {
    return this.isShowing;
  }
}
