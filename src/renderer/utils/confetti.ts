/**
 * Confetti Animation
 *
 * Creates confetti celebration effects for achievements and milestones.
 * Lightweight canvas-based particle system.
 */

interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
  width: number;
  height: number;
  gravity: number;
}

export interface ConfettiOptions {
  duration?: number; // milliseconds
  particleCount?: number;
  colors?: string[];
  spread?: number; // degrees
  origin?: { x: number; y: number }; // 0-1 normalized coordinates
}

export class ConfettiManager {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private particles: ConfettiParticle[] = [];
  private animationId: number | null = null;
  private isAnimating: boolean = false;

  constructor() {
    this.createCanvas();
  }

  /**
   * Create confetti canvas
   */
  private createCanvas(): void {
    // Check if canvas already exists
    let canvas = document.getElementById('confetti-canvas') as HTMLCanvasElement;

    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'confetti-canvas';
      canvas.className = 'confetti-canvas';
      document.body.appendChild(canvas);
    }

    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resizeCanvas();

    // Handle window resize
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  /**
   * Resize canvas to fill window
   */
  private resizeCanvas(): void {
    if (!this.canvas) return;

    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  /**
   * Launch confetti!
   */
  public launch(options: ConfettiOptions = {}): void {
    const {
      duration = 3000,
      particleCount = 100,
      colors = ['#e74c3c', '#f39c12', '#27ae60', '#007acc', '#9b59b6', '#f39c12'],
      spread = 60,
      origin = { x: 0.5, y: 0.5 }
    } = options;

    if (!this.canvas || !this.ctx) return;

    // Make canvas visible
    this.canvas.style.display = 'block';

    // Create particles
    const originX = origin.x * this.canvas.width;
    const originY = origin.y * this.canvas.height;

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.random() - 0.5) * (spread * Math.PI / 180) - Math.PI / 2;
      const velocity = 10 + Math.random() * 10;

      this.particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        color: colors[Math.floor(Math.random() * colors.length)],
        width: 8 + Math.random() * 8,
        height: 6 + Math.random() * 6,
        gravity: 0.5 + Math.random() * 0.3
      });
    }

    // Start animation
    if (!this.isAnimating) {
      this.isAnimating = true;
      this.animate();
    }

    // Stop after duration
    setTimeout(() => {
      this.stop();
    }, duration);
  }

  /**
   * Animate confetti particles
   */
  private animate(): void {
    if (!this.ctx || !this.canvas) return;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Update and draw particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      // Update position
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.rotation += p.rotationSpeed;

      // Remove particles that fall off screen
      if (p.y > this.canvas.height) {
        this.particles.splice(i, 1);
        continue;
      }

      // Draw particle
      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate(p.rotation * Math.PI / 180);
      this.ctx.fillStyle = p.color;
      this.ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
      this.ctx.restore();
    }

    // Continue animation if particles remain
    if (this.particles.length > 0) {
      this.animationId = requestAnimationFrame(() => this.animate());
    } else {
      this.stop();
    }
  }

  /**
   * Stop confetti animation
   */
  public stop(): void {
    this.isAnimating = false;
    this.particles = [];

    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    // Hide canvas
    if (this.canvas) {
      this.canvas.style.display = 'none';

      // Clear canvas
      if (this.ctx) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
    }
  }

  /**
   * Show celebration banner with confetti
   */
  public celebrate(options: {
    emoji: string;
    title: string;
    subtitle?: string;
    duration?: number;
    confettiOptions?: ConfettiOptions;
  }): void {
    const {
      emoji,
      title,
      subtitle,
      duration = 3000,
      confettiOptions = {}
    } = options;

    // Launch confetti
    this.launch(confettiOptions);

    // Create banner
    const banner = document.createElement('div');
    banner.className = 'celebration-banner';
    banner.innerHTML = `
      <div class="celebration-emoji">${emoji}</div>
      <div class="celebration-text">${title}</div>
      ${subtitle ? `<div class="celebration-subtext">${subtitle}</div>` : ''}
    `;

    document.body.appendChild(banner);

    // Remove banner after duration
    setTimeout(() => {
      banner.style.animation = 'fadeOut 0.3s ease forwards';
      setTimeout(() => {
        banner.remove();
      }, 300);
    }, duration);
  }

  /**
   * Quick celebration for achievements
   */
  public achievement(achievementName: string): void {
    this.celebrate({
      emoji: '🎉',
      title: 'Achievement Unlocked!',
      subtitle: achievementName,
      duration: 2500,
      confettiOptions: {
        particleCount: 80,
        spread: 70,
        origin: { x: 0.5, y: 0.6 }
      }
    });
  }

  /**
   * Milestone celebration
   */
  public milestone(milestoneName: string): void {
    this.celebrate({
      emoji: '🏆',
      title: milestoneName,
      subtitle: 'Keep up the great work!',
      duration: 3000,
      confettiOptions: {
        particleCount: 120,
        spread: 80
      }
    });
  }

  /**
   * Quiz perfect score celebration
   */
  public perfectScore(): void {
    this.celebrate({
      emoji: '⭐',
      title: 'Perfect Score!',
      subtitle: 'You aced it!',
      duration: 2500,
      confettiOptions: {
        particleCount: 100,
        colors: ['#f39c12', '#ff9500', '#ffcc00'],
        spread: 90
      }
    });
  }

  /**
   * Study streak celebration
   */
  public studyStreak(days: number): void {
    this.celebrate({
      emoji: '🔥',
      title: `${days} Day Streak!`,
      subtitle: "You're on fire!",
      duration: 2500,
      confettiOptions: {
        particleCount: 80,
        colors: ['#e74c3c', '#f39c12', '#ff9500'],
        spread: 70
      }
    });
  }
}
