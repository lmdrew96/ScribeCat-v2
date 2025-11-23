/**
 * Nyan Cat Theme Effects
 *
 * Manages special visual effects for the Nyan Cat themes:
 * - Rainbow cursor trails
 * - Sparkle particles
 * - Interactive easter eggs (typing "nyan", click counter)
 * - Rainbow gradient animations
 */

interface Particle {
  element: HTMLElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

export class NyanEffects {
  private isActive = false;
  private cursorTrails: HTMLElement[] = [];
  private sparkles: HTMLElement[] = [];
  private particles: Particle[] = [];
  private animationFrame: number | null = null;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private nyanSequence = 'nyan';
  private nyanTyped = '';
  private nyanTimeout: number | null = null;
  private superRainbowActive = false;
  private clickCounter = 0;
  private clickTimeout: number | null = null;

  // Rainbow colors for cursor trail
  private rainbowColors = [
    '#ff0000', // Red
    '#ff7f00', // Orange
    '#ffff00', // Yellow
    '#00ff00', // Green
    '#0000ff', // Blue
    '#4b0082', // Indigo
    '#9400d3'  // Violet
  ];

  constructor() {
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.animate = this.animate.bind(this);
  }

  /**
   * Activate Nyan effects
   */
  public activate(): void {
    if (this.isActive) return;

    console.log('🌈 Activating Nyan Cat effects!');
    this.isActive = true;

    // Add rainbow background class to body
    document.body.classList.add('nyan-cat-theme');

    // Start event listeners
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('click', this.handleClick);

    // Generate initial sparkles
    this.generateSparkles(15);

    // Start animation loop
    this.startAnimation();

    // Show activation message
    this.showRainbowExplosion();
  }

  /**
   * Deactivate Nyan effects
   */
  public deactivate(): void {
    if (!this.isActive) return;

    console.log('👋 Deactivating Nyan Cat effects');
    this.isActive = false;

    // Remove rainbow background class
    document.body.classList.remove('nyan-cat-theme');

    // Remove event listeners
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('click', this.handleClick);

    // Clean up all effects
    this.cleanup();

    // Stop animation loop
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    // Reset super rainbow state
    this.superRainbowActive = false;
    this.nyanTyped = '';
    this.clickCounter = 0;
    if (this.nyanTimeout) {
      clearTimeout(this.nyanTimeout);
      this.nyanTimeout = null;
    }
  }

  /**
   * Handle mouse movement for cursor trails
   */
  private handleMouseMove(e: MouseEvent): void {
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;

    // Create cursor trail particle
    this.createCursorTrail(e.clientX, e.clientY);
  }

  /**
   * Handle keyboard input for "nyan" sequence
   */
  private handleKeyDown(e: KeyboardEvent): void {
    // Check if typing in input field
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    // Only track single character keys
    if (e.key.length !== 1) {
      return;
    }

    // Add typed character to sequence
    this.nyanTyped += e.key.toLowerCase();

    // Reset timeout - must type within 2 seconds
    if (this.nyanTimeout) {
      clearTimeout(this.nyanTimeout);
    }
    this.nyanTimeout = window.setTimeout(() => {
      this.nyanTyped = '';
    }, 2000);

    // Keep only the last 4 characters (length of "nyan")
    if (this.nyanTyped.length > this.nyanSequence.length) {
      this.nyanTyped = this.nyanTyped.slice(-this.nyanSequence.length);
    }

    // Check if sequence matches "nyan"
    if (this.nyanTyped === this.nyanSequence) {
      this.activateSuperRainbowMode();
      this.nyanTyped = '';
      if (this.nyanTimeout) {
        clearTimeout(this.nyanTimeout);
        this.nyanTimeout = null;
      }
    }
  }

  /**
   * Handle clicks for click counter easter egg
   */
  private handleClick(e: MouseEvent): void {
    // Check if clicking on rainbow emoji in theme name
    const target = e.target as HTMLElement;
    if (target.textContent?.includes('🌈')) {
      this.clickCounter++;

      // Reset timeout
      if (this.clickTimeout) {
        clearTimeout(this.clickTimeout);
      }

      // Reset counter after 2 seconds of no clicks
      this.clickTimeout = window.setTimeout(() => {
        this.clickCounter = 0;
      }, 2000);

      // Check for magic number (7 clicks)
      if (this.clickCounter === 7) {
        this.activateRainbowExplosion();
        this.clickCounter = 0;
      }
    }
  }

  /**
   * Create a cursor trail particle
   */
  private createCursorTrail(x: number, y: number): void {
    const trail = document.createElement('div');
    trail.className = 'nyan-cursor-trail';

    // Random rainbow color
    const color = this.rainbowColors[Math.floor(Math.random() * this.rainbowColors.length)];
    trail.style.background = color;
    trail.style.left = `${x}px`;
    trail.style.top = `${y}px`;

    document.body.appendChild(trail);
    this.cursorTrails.push(trail);

    // Remove after animation completes
    setTimeout(() => {
      trail.remove();
      const index = this.cursorTrails.indexOf(trail);
      if (index > -1) {
        this.cursorTrails.splice(index, 1);
      }
    }, 600);

    // Limit number of trails
    if (this.cursorTrails.length > 30) {
      const old = this.cursorTrails.shift();
      old?.remove();
    }
  }

  /**
   * Generate sparkle particles
   */
  private generateSparkles(count: number): void {
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        this.createSparkle();
      }, i * 100);
    }
  }

  /**
   * Create a single sparkle
   */
  private createSparkle(): void {
    if (!this.isActive) return;

    const sparkle = document.createElement('div');
    sparkle.className = 'nyan-sparkle';

    // Random position
    const x = Math.random() * window.innerWidth;
    const y = Math.random() * window.innerHeight;
    sparkle.style.left = `${x}px`;
    sparkle.style.top = `${y}px`;

    // Random size
    const size = 2 + Math.random() * 4;
    sparkle.style.width = `${size}px`;
    sparkle.style.height = `${size}px`;

    // Random animation delay
    sparkle.style.animationDelay = `${Math.random() * 2}s`;

    // Random color
    const color = this.rainbowColors[Math.floor(Math.random() * this.rainbowColors.length)];
    sparkle.style.background = color;
    sparkle.style.boxShadow = `0 0 ${size * 2}px ${color}`;

    document.body.appendChild(sparkle);
    this.sparkles.push(sparkle);

    // Remove and recreate after animation
    setTimeout(() => {
      sparkle.remove();
      const index = this.sparkles.indexOf(sparkle);
      if (index > -1) {
        this.sparkles.splice(index, 1);
      }

      // Create a new sparkle to maintain count
      if (this.isActive) {
        setTimeout(() => this.createSparkle(), Math.random() * 3000);
      }
    }, 3000 + Math.random() * 2000);
  }

  /**
   * Start animation loop
   */
  private startAnimation(): void {
    this.animate();
  }

  /**
   * Animation loop
   */
  private animate(): void {
    if (!this.isActive) return;

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      // Update position
      p.x += p.vx;
      p.y += p.vy;
      p.life--;

      // Update element
      p.element.style.left = `${p.x}px`;
      p.element.style.top = `${p.y}px`;
      p.element.style.opacity = `${p.life / p.maxLife}`;

      // Remove dead particles
      if (p.life <= 0) {
        p.element.remove();
        this.particles.splice(i, 1);
      }
    }

    this.animationFrame = requestAnimationFrame(this.animate);
  }

  /**
   * Activate super rainbow mode (by typing "nyan")
   */
  private activateSuperRainbowMode(): void {
    if (this.superRainbowActive) return;

    console.log('🌈 NYAN! SUPER RAINBOW MODE ACTIVATED!');
    this.superRainbowActive = true;

    // Add extra effects
    document.body.classList.add('super-rainbow-mode');

    // Generate more sparkles
    this.generateSparkles(30);

    // Show notification
    const notification = document.createElement('div');
    notification.className = 'nyan-notification';
    notification.textContent = '✨ NYAN! SUPER RAINBOW MODE! ✨';
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);

    // Create explosion effect
    this.createParticleExplosion(window.innerWidth / 2, window.innerHeight / 2, 50);
  }

  /**
   * Activate rainbow explosion (from click counter)
   */
  private activateRainbowExplosion(): void {
    console.log('💥 RAINBOW EXPLOSION!');

    // Create explosion at mouse position
    this.createParticleExplosion(this.lastMouseX, this.lastMouseY, 30);

    // Show notification
    const notification = document.createElement('div');
    notification.className = 'nyan-notification';
    notification.textContent = '💥 RAINBOW EXPLOSION! 🌈';
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 2000);
  }

  /**
   * Show rainbow explosion on activation
   */
  private showRainbowExplosion(): void {
    this.createParticleExplosion(window.innerWidth / 2, window.innerHeight / 2, 20);
  }

  /**
   * Create a particle explosion
   */
  private createParticleExplosion(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = 5 + Math.random() * 5;

      const particle = document.createElement('div');
      particle.className = 'nyan-particle';

      const color = this.rainbowColors[i % this.rainbowColors.length];
      particle.style.background = color;
      particle.style.boxShadow = `0 0 10px ${color}`;

      const size = 5 + Math.random() * 5;
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;

      document.body.appendChild(particle);

      this.particles.push({
        element: particle,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 60,
        maxLife: 60
      });
    }
  }

  /**
   * Clean up all effects
   */
  private cleanup(): void {
    // Remove all cursor trails
    this.cursorTrails.forEach(trail => trail.remove());
    this.cursorTrails = [];

    // Remove all sparkles
    this.sparkles.forEach(sparkle => sparkle.remove());
    this.sparkles = [];

    // Remove all particles
    this.particles.forEach(p => p.element.remove());
    this.particles = [];

    // Remove super rainbow mode class
    document.body.classList.remove('super-rainbow-mode');

    // Remove any notifications
    document.querySelectorAll('.nyan-notification').forEach(n => n.remove());
  }

  /**
   * Check if effects are active
   */
  public isEffectsActive(): boolean {
    return this.isActive;
  }
}

// Singleton instance
let nyanEffectsInstance: NyanEffects | null = null;

/**
 * Get or create the NyanEffects instance
 */
export function getNyanEffects(): NyanEffects {
  if (!nyanEffectsInstance) {
    nyanEffectsInstance = new NyanEffects();
  }
  return nyanEffectsInstance;
}
