/**
 * UnlockCelebration
 *
 * Displays a celebration overlay when new items are unlocked.
 * Shows the unlocked item with animations and a confetti effect.
 */

import { createLogger } from '../../../shared/logger.js';
import type { Unlockable } from '../../canvas/UnlockManager.js';

const logger = createLogger('UnlockCelebration');

// Tier colors for visual distinction
const TIER_COLORS: Record<string, { primary: string; secondary: string; glow: string }> = {
  starter: { primary: '#4ade80', secondary: '#22c55e', glow: 'rgba(74, 222, 128, 0.5)' },
  breed: { primary: '#60a5fa', secondary: '#3b82f6', glow: 'rgba(96, 165, 250, 0.5)' },
  themed: { primary: '#a855f7', secondary: '#9333ea', glow: 'rgba(168, 85, 247, 0.5)' },
  seasonal: { primary: '#fb923c', secondary: '#f97316', glow: 'rgba(251, 146, 60, 0.5)' },
  secret: { primary: '#facc15', secondary: '#eab308', glow: 'rgba(250, 204, 21, 0.6)' },
  default: { primary: '#6366f1', secondary: '#4f46e5', glow: 'rgba(99, 102, 241, 0.5)' },
};

// Category icons
const CATEGORY_ICONS: Record<string, string> = {
  cat: '🐱',
  town_feature: '🏠',
  dungeon: '🗡️',
};

export class UnlockCelebration {
  private overlay: HTMLDivElement | null = null;
  private queue: Unlockable[] = [];
  private isShowing: boolean = false;

  constructor() {
    this.injectStyles();
  }

  /**
   * Show celebration for one or more unlocked items
   */
  show(unlocks: Unlockable | Unlockable[]): void {
    const items = Array.isArray(unlocks) ? unlocks : [unlocks];
    this.queue.push(...items);

    if (!this.isShowing) {
      this.showNext();
    }
  }

  /**
   * Show the next item in queue
   */
  private showNext(): void {
    if (this.queue.length === 0) {
      this.isShowing = false;
      return;
    }

    this.isShowing = true;
    const unlock = this.queue.shift()!;
    this.createOverlay(unlock);
    logger.info(`Showing unlock celebration for: ${unlock.name}`);
  }

  /**
   * Create and show the celebration overlay
   */
  private createOverlay(unlock: Unlockable): void {
    // Remove existing overlay if any
    this.removeOverlay();

    const tier = unlock.tier || 'default';
    const colors = TIER_COLORS[tier] || TIER_COLORS.default;
    const icon = CATEGORY_ICONS[unlock.category] || '⭐';

    this.overlay = document.createElement('div');
    this.overlay.className = 'unlock-celebration-overlay';
    this.overlay.innerHTML = `
      <div class="unlock-celebration-backdrop"></div>
      <div class="unlock-celebration-content" style="--tier-primary: ${colors.primary}; --tier-secondary: ${colors.secondary}; --tier-glow: ${colors.glow}">
        <div class="unlock-confetti-container"></div>

        <div class="unlock-banner">NEW UNLOCK!</div>

        <div class="unlock-card">
          <div class="unlock-card-glow"></div>
          <div class="unlock-card-inner">
            <div class="unlock-icon">${icon}</div>
            <div class="unlock-tier-badge">${tier.toUpperCase()}</div>
            <h2 class="unlock-name">${unlock.name}</h2>
            <p class="unlock-description">${unlock.description}</p>
          </div>
        </div>

        <div class="unlock-sparkles">
          ${Array.from({ length: 12 }, (_, i) => `<div class="unlock-sparkle" style="--i: ${i}"></div>`).join('')}
        </div>

        <button class="unlock-continue-btn">Continue</button>

        <div class="unlock-remaining">
          ${this.queue.length > 0 ? `+${this.queue.length} more unlocks!` : ''}
        </div>
      </div>
    `;

    // Add event listeners
    const backdrop = this.overlay.querySelector('.unlock-celebration-backdrop');
    const continueBtn = this.overlay.querySelector('.unlock-continue-btn');

    backdrop?.addEventListener('click', () => this.handleContinue());
    continueBtn?.addEventListener('click', () => this.handleContinue());

    // Keyboard support
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
        this.handleContinue();
        document.removeEventListener('keydown', handleKeydown);
      }
    };
    document.addEventListener('keydown', handleKeydown);

    // Add to DOM
    document.body.appendChild(this.overlay);

    // Trigger animations
    requestAnimationFrame(() => {
      this.overlay?.classList.add('unlock-celebration-visible');
      this.createConfetti();
    });
  }

  /**
   * Handle continue button click
   */
  private handleContinue(): void {
    if (!this.overlay) return;

    // Fade out
    this.overlay.classList.remove('unlock-celebration-visible');
    this.overlay.classList.add('unlock-celebration-hiding');

    setTimeout(() => {
      this.removeOverlay();
      this.showNext();
    }, 300);
  }

  /**
   * Create confetti particles
   */
  private createConfetti(): void {
    const container = this.overlay?.querySelector('.unlock-confetti-container');
    if (!container) return;

    const colors = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#95e1d3', '#f38181', '#aa96da', '#fcbad3'];

    for (let i = 0; i < 50; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'unlock-confetti-piece';

      const color = colors[Math.floor(Math.random() * colors.length)];
      const startX = 50 + (Math.random() - 0.5) * 20;
      const endX = startX + (Math.random() - 0.5) * 100;
      const rotation = Math.random() * 720;
      const delay = Math.random() * 0.5;
      const duration = 1 + Math.random() * 1;

      confetti.style.cssText = `
        --confetti-color: ${color};
        --start-x: ${startX}%;
        --end-x: ${endX}%;
        --rotation: ${rotation}deg;
        animation-delay: ${delay}s;
        animation-duration: ${duration}s;
      `;

      container.appendChild(confetti);
    }
  }

  /**
   * Remove the overlay from DOM
   */
  private removeOverlay(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  /**
   * Inject required styles
   */
  private injectStyles(): void {
    if (document.getElementById('unlock-celebration-styles')) return;

    const style = document.createElement('style');
    style.id = 'unlock-celebration-styles';
    style.textContent = `
      .unlock-celebration-overlay {
        position: fixed;
        inset: 0;
        z-index: 100000;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.3s ease;
        pointer-events: none;
      }

      .unlock-celebration-overlay.unlock-celebration-visible {
        opacity: 1;
        pointer-events: auto;
      }

      .unlock-celebration-overlay.unlock-celebration-hiding {
        opacity: 0;
      }

      .unlock-celebration-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(4px);
      }

      .unlock-celebration-content {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
        padding: 40px;
        max-width: 400px;
        text-align: center;
      }

      .unlock-confetti-container {
        position: absolute;
        inset: 0;
        overflow: hidden;
        pointer-events: none;
      }

      .unlock-confetti-piece {
        position: absolute;
        width: 10px;
        height: 10px;
        background: var(--confetti-color);
        left: var(--start-x);
        top: -20px;
        animation: confettiFall 2s ease-out forwards;
        transform-origin: center;
      }

      @keyframes confettiFall {
        0% {
          transform: translateY(0) rotate(0deg);
          opacity: 1;
        }
        100% {
          transform: translateY(400px) rotate(var(--rotation));
          left: var(--end-x);
          opacity: 0;
        }
      }

      .unlock-banner {
        font-size: 24px;
        font-weight: bold;
        color: #ffffff;
        text-shadow: 0 0 20px var(--tier-glow), 0 2px 4px rgba(0, 0, 0, 0.5);
        letter-spacing: 4px;
        animation: bannerPulse 1s ease-in-out infinite;
      }

      @keyframes bannerPulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }

      .unlock-card {
        position: relative;
        width: 280px;
        padding: 4px;
        border-radius: 16px;
        background: linear-gradient(135deg, var(--tier-primary), var(--tier-secondary));
        animation: cardReveal 0.6s ease-out;
      }

      @keyframes cardReveal {
        0% {
          transform: scale(0.5) rotateY(180deg);
          opacity: 0;
        }
        50% {
          transform: scale(1.1) rotateY(0);
        }
        100% {
          transform: scale(1) rotateY(0);
          opacity: 1;
        }
      }

      .unlock-card-glow {
        position: absolute;
        inset: -10px;
        background: radial-gradient(circle, var(--tier-glow) 0%, transparent 70%);
        filter: blur(20px);
        animation: glowPulse 2s ease-in-out infinite;
      }

      @keyframes glowPulse {
        0%, 100% { opacity: 0.6; }
        50% { opacity: 1; }
      }

      .unlock-card-inner {
        position: relative;
        background: linear-gradient(180deg, #2a2a4e 0%, #1a1a2e 100%);
        border-radius: 12px;
        padding: 24px;
      }

      .unlock-icon {
        font-size: 48px;
        margin-bottom: 8px;
        animation: iconBounce 0.6s ease-out 0.3s;
      }

      @keyframes iconBounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
      }

      .unlock-tier-badge {
        display: inline-block;
        padding: 4px 12px;
        background: linear-gradient(135deg, var(--tier-primary), var(--tier-secondary));
        border-radius: 12px;
        font-size: 10px;
        font-weight: bold;
        color: #ffffff;
        letter-spacing: 1px;
        margin-bottom: 12px;
      }

      .unlock-name {
        margin: 0 0 8px 0;
        font-size: 22px;
        font-weight: bold;
        color: #ffffff;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      }

      .unlock-description {
        margin: 0;
        font-size: 14px;
        color: #9ca3af;
        line-height: 1.4;
      }

      .unlock-sparkles {
        position: absolute;
        width: 300px;
        height: 300px;
        pointer-events: none;
      }

      .unlock-sparkle {
        position: absolute;
        width: 8px;
        height: 8px;
        background: #ffffff;
        border-radius: 50%;
        left: 50%;
        top: 50%;
        animation: sparkleBurst 1s ease-out calc(var(--i) * 0.05s) forwards;
        opacity: 0;
      }

      @keyframes sparkleBurst {
        0% {
          transform: translate(-50%, -50%) scale(0);
          opacity: 1;
        }
        50% {
          opacity: 1;
        }
        100% {
          transform:
            translate(
              calc(-50% + cos(calc(var(--i) * 30deg)) * 150px),
              calc(-50% + sin(calc(var(--i) * 30deg)) * 150px)
            )
            scale(0);
          opacity: 0;
        }
      }

      .unlock-continue-btn {
        padding: 12px 32px;
        font-size: 16px;
        font-weight: bold;
        color: #ffffff;
        background: linear-gradient(135deg, var(--tier-primary), var(--tier-secondary));
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
        box-shadow: 0 4px 12px var(--tier-glow);
      }

      .unlock-continue-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px var(--tier-glow);
      }

      .unlock-continue-btn:active {
        transform: translateY(0);
      }

      .unlock-remaining {
        font-size: 12px;
        color: var(--tier-primary);
        min-height: 18px;
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.removeOverlay();
    this.queue = [];
    this.isShowing = false;
  }
}

// Export singleton for easy access
export const unlockCelebration = new UnlockCelebration();
