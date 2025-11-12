/**
 * Easter Eggs Utilities
 * Fun interactive features for ScribeCat-v2
 */

import { SoundManager } from '../audio/SoundManager.js';

/**
 * Konami Code Detector
 * Detects: Up, Up, Down, Down, Left, Right, Left, Right, B, A
 */
export class KonamiCodeDetector {
  private readonly sequence = [
    'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
    'KeyB', 'KeyA'
  ];
  private currentIndex = 0;
  private callback: () => void;

  constructor(callback: () => void) {
    this.callback = callback;
    this.listen();
  }

  private listen(): void {
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      const expectedKey = this.sequence[this.currentIndex];

      if (e.code === expectedKey) {
        this.currentIndex++;

        if (this.currentIndex === this.sequence.length) {
          this.callback();
          this.currentIndex = 0; // Reset for next time
        }
      } else {
        this.currentIndex = 0; // Reset on wrong key
      }
    });
  }
}

/**
 * Triple Click Detector
 * Detects three rapid clicks on an element
 */
export class TripleClickDetector {
  private clickCount = 0;
  private clickTimer: NodeJS.Timeout | null = null;
  private readonly resetDelay = 500; // ms between clicks

  constructor(
    private element: HTMLElement,
    private callback: (isActive: boolean) => void
  ) {
    this.listen();
  }

  private listen(): void {
    let isActive = false;

    this.element.addEventListener('click', (e) => {
      this.clickCount++;

      if (this.clickTimer) {
        clearTimeout(this.clickTimer);
      }

      if (this.clickCount === 3) {
        isActive = !isActive;
        this.callback(isActive);
        this.clickCount = 0;
      } else {
        this.clickTimer = setTimeout(() => {
          this.clickCount = 0;
        }, this.resetDelay);
      }
    });
  }
}

/**
 * Keyboard Sequence Detector
 * Detects a specific typed phrase (case-insensitive)
 */
export class KeyboardSequenceDetector {
  private currentSequence = '';
  private sequenceTimer: NodeJS.Timeout | null = null;
  private readonly resetDelay = 2000; // ms between keypresses

  constructor(
    private targetSequence: string,
    private callback: () => void,
    private targetElement?: HTMLElement
  ) {
    this.listen();
  }

  private listen(): void {
    const element = this.targetElement || document;

    element.addEventListener('keypress', (e: Event) => {
      const keyEvent = e as KeyboardEvent;

      // Ignore if typing in input/textarea (unless that's our target)
      const target = keyEvent.target as HTMLElement;
      if (!this.targetElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      this.currentSequence += keyEvent.key.toLowerCase();

      if (this.sequenceTimer) {
        clearTimeout(this.sequenceTimer);
      }

      // Check if we've matched the sequence
      if (this.currentSequence.includes(this.targetSequence.toLowerCase())) {
        this.callback();
        this.currentSequence = '';
      } else {
        // Reset after delay
        this.sequenceTimer = setTimeout(() => {
          this.currentSequence = '';
        }, this.resetDelay);
      }
    });
  }
}

/**
 * Cat Party Animation
 * Creates falling cat emojis across the screen
 */
export function triggerCatParty(): void {
  // Play purr sound when cat party starts
  SoundManager.play('purr');

  const cats = ['🐱', '😸', '😺', '😻', '🐈', '😹', '😼', '😽', '🙀', '😿', '😾', '🐈‍⬛'];
  const numCats = 200; // MOAR CATS!!!

  for (let i = 0; i < numCats; i++) {
    setTimeout(() => {
      createFallingCat(cats[Math.floor(Math.random() * cats.length)]);
    }, i * 50); // Spawn cats faster!
  }
}

function createFallingCat(emoji: string): void {
  const cat = document.createElement('div');
  cat.className = 'falling-cat';
  cat.textContent = emoji;

  // Random horizontal position
  cat.style.left = `${Math.random() * 100}%`;

  // Random animation duration between 3-5 seconds
  const duration = 3 + Math.random() * 2;
  cat.style.animationDuration = `${duration}s`;

  // Random rotation
  const rotation = Math.random() * 360;
  cat.style.setProperty('--rotation', `${rotation}deg`);

  document.body.appendChild(cat);

  // Remove after animation completes
  setTimeout(() => {
    cat.remove();
  }, duration * 1000);
}

/**
 * Study Buddy - Cursor Following Cat
 * Uses Meow Knight animated sprite sheets
 */
export class StudyBuddy {
  private cat: HTMLDivElement | null = null;
  private catSprite: HTMLDivElement | null = null;
  private isActive = false;
  private catX = window.innerWidth / 2;
  private catY = window.innerHeight / 2;
  private targetX = this.catX;
  private targetY = this.catY;
  private idleTimer: NodeJS.Timeout | null = null;
  private isIdle = true;
  private animationFrameId: number | null = null;
  private lastMoveTime = 0;
  private movementThreshold = 0.5; // pixels per frame to trigger run animation

  toggle(): void {
    if (this.isActive) {
      this.deactivate();
    } else {
      this.activate();
    }
  }

  private activate(): void {
    this.isActive = true;

    // Create cat element with Meow Knight sprite
    this.cat = document.createElement('div');
    this.cat.className = 'study-buddy';
    this.cat.style.left = `${this.catX}px`;
    this.cat.style.top = `${this.catY}px`;

    // Create sprite container
    this.catSprite = document.createElement('div');
    this.catSprite.className = 'study-buddy-sprite idle';
    this.cat.appendChild(this.catSprite);

    document.body.appendChild(this.cat);

    // Start following cursor
    document.addEventListener('mousemove', this.handleMouseMove);
    this.startAnimation();
  }

  private deactivate(): void {
    this.isActive = false;

    if (this.cat) {
      this.cat.remove();
      this.cat = null;
    }

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    document.removeEventListener('mousemove', this.handleMouseMove);

    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
  }

  private handleMouseMove = (e: MouseEvent): void => {
    this.targetX = e.clientX;
    this.targetY = e.clientY;

    // Reset idle timer
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }

    // Set to running state
    if (this.isIdle && this.catSprite) {
      this.isIdle = false;
      this.catSprite.classList.remove('idle');
      this.catSprite.classList.add('running');
    }

    // After 800ms of no mouse movement, go back to idle
    this.idleTimer = setTimeout(() => {
      if (this.catSprite) {
        this.isIdle = true;
        this.catSprite.classList.remove('running');
        this.catSprite.classList.add('idle');
      }
    }, 800);
  };

  private startAnimation(): void {
    const animate = (): void => {
      if (!this.isActive || !this.cat) return;

      // Calculate distance to target
      const dx = this.targetX - this.catX;
      const dy = this.targetY - this.catY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Smooth easing - faster follow, stops sooner
      const easing = 0.18;
      const oldX = this.catX;
      const oldY = this.catY;

      this.catX += dx * easing;
      this.catY += dy * easing;

      // Calculate movement speed
      const moveX = this.catX - oldX;
      const moveY = this.catY - oldY;
      const speed = Math.sqrt(moveX * moveX + moveY * moveY);

      // Flip sprite based on movement direction (face cursor)
      if (this.catSprite && Math.abs(dx) > 5) {
        if (dx < 0) {
          // Moving left - flip sprite
          this.catSprite.style.transform = 'scaleX(-1)';
        } else {
          // Moving right - normal
          this.catSprite.style.transform = 'scaleX(1)';
        }
      }

      // Keep within viewport boundaries
      const padding = 32;
      this.catX = Math.max(padding, Math.min(window.innerWidth - padding, this.catX));
      this.catY = Math.max(padding, Math.min(window.innerHeight - padding, this.catY));

      // Update position
      this.cat.style.left = `${this.catX}px`;
      this.cat.style.top = `${this.catY}px`;

      this.animationFrameId = requestAnimationFrame(animate);
    };

    animate();
  }
}
