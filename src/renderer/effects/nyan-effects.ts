/**
 * Nyan Cat Theme Effects
 *
 * GSAP-enhanced visual effects for the Nyan Cat themes:
 * - Canvas-based rainbow band cursor trail (6 stripes like original Nyan Cat)
 * - Twinkling sparkle particles around the trail
 * - Interactive easter eggs (typing "nyan", click counter)
 * - Rainbow gradient animations
 */

import gsap from 'gsap';

interface TrailPoint {
  x: number;
  y: number;
  age: number;
}

interface Sparkle {
  x: number;
  y: number;
  size: number;
  opacity: number;
  rotation: number;
  color: string;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  type: 'star' | 'diamond' | 'circle';
}

interface ExplosionParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export class NyanEffects {
  private isActive = false;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private trailPoints: TrailPoint[] = [];
  private sparkles: Sparkle[] = [];
  private explosionParticles: ExplosionParticle[] = [];
  private animationFrame: number | null = null;

  // Cursor tracking
  private mouseX = 0;
  private mouseY = 0;
  private smoothX = 0;
  private smoothY = 0;

  // Easter egg state
  private nyanSequence = 'nyan';
  private nyanTyped = '';
  private nyanTimeout: number | null = null;
  private superRainbowActive = false;
  private clickCounter = 0;
  private clickTimeout: number | null = null;

  // Trail configuration
  private readonly maxTrailPoints = 30;
  private readonly trailDecay = 1.5; // How fast trail fades
  private readonly stripeHeight = 2; // Height of each rainbow stripe (thinner)
  private readonly smoothing = 0.15; // Cursor smoothing factor

  // Nyan Cat rainbow colors (6 stripes)
  private readonly nyanColors = [
    '#FF0000', // Red
    '#FF9900', // Orange
    '#FFFF00', // Yellow
    '#33FF00', // Green
    '#0099FF', // Blue
    '#6633FF'  // Purple/Violet
  ];

  // Sparkle colors (more vibrant)
  private readonly sparkleColors = [
    '#FFFFFF', // White
    '#FFE4E1', // Light pink
    '#E0FFFF', // Light cyan
    '#FFFACD', // Light yellow
    '#F0FFF0', // Honeydew
    '#FFF0F5'  // Lavender
  ];

  constructor() {
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.animate = this.animate.bind(this);
    this.handleResize = this.handleResize.bind(this);
  }

  /**
   * Activate Nyan effects
   */
  public activate(): void {
    if (this.isActive) return;

    console.log('🌈 Activating enhanced Nyan Cat effects!');
    this.isActive = true;

    // Create canvas overlay
    this.createCanvas();

    // Add rainbow background class to body
    document.body.classList.add('nyan-cat-theme');

    // Start event listeners
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('click', this.handleClick);
    window.addEventListener('resize', this.handleResize);

    // Initialize cursor position
    this.smoothX = window.innerWidth / 2;
    this.smoothY = window.innerHeight / 2;

    // Start animation loop
    this.startAnimation();

    // Show activation effect
    this.createExplosion(window.innerWidth / 2, window.innerHeight / 2, 25);

    // Spawn initial sparkles
    for (let i = 0; i < 10; i++) {
      this.spawnRandomSparkle();
    }
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
    document.body.classList.remove('super-rainbow-mode');

    // Remove event listeners
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('click', this.handleClick);
    window.removeEventListener('resize', this.handleResize);

    // Stop animation loop
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    // Remove canvas
    if (this.canvas) {
      this.canvas.remove();
      this.canvas = null;
      this.ctx = null;
    }

    // Reset state
    this.trailPoints = [];
    this.sparkles = [];
    this.explosionParticles = [];
    this.superRainbowActive = false;
    this.nyanTyped = '';
    this.clickCounter = 0;

    if (this.nyanTimeout) {
      clearTimeout(this.nyanTimeout);
      this.nyanTimeout = null;
    }

    // Remove any notifications
    document.querySelectorAll('.nyan-notification').forEach(n => n.remove());
  }

  /**
   * Create canvas overlay for effects
   */
  private createCanvas(): void {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'nyan-effects-canvas';
    this.canvas.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 9998;
    `;

    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
  }

  /**
   * Handle window resize
   */
  private handleResize(): void {
    if (this.canvas) {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }
  }

  /**
   * Handle mouse movement
   */
  private handleMouseMove(e: MouseEvent): void {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
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
        this.createExplosion(e.clientX, e.clientY, 40);
        this.showNotification('💥 RAINBOW EXPLOSION! 🌈');
        this.clickCounter = 0;
      }
    }
  }

  /**
   * Start animation loop
   */
  private startAnimation(): void {
    this.animate();
  }

  /**
   * Main animation loop
   */
  private animate(): void {
    if (!this.isActive || !this.ctx || !this.canvas) return;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Smooth cursor movement
    this.smoothX += (this.mouseX - this.smoothX) * this.smoothing;
    this.smoothY += (this.mouseY - this.smoothY) * this.smoothing;

    // Add new trail point
    this.trailPoints.push({
      x: this.smoothX,
      y: this.smoothY,
      age: 0
    });

    // Update trail points
    for (let i = this.trailPoints.length - 1; i >= 0; i--) {
      this.trailPoints[i].age += this.trailDecay;

      // Remove old points
      if (this.trailPoints[i].age > 60) {
        this.trailPoints.splice(i, 1);
      }
    }

    // Limit trail length
    while (this.trailPoints.length > this.maxTrailPoints) {
      this.trailPoints.shift();
    }

    // Draw rainbow trail
    this.drawRainbowTrail();

    // Spawn sparkles along trail
    if (this.trailPoints.length > 2 && Math.random() < 0.3) {
      this.spawnTrailSparkle();
    }

    // Randomly spawn ambient sparkles
    if (Math.random() < 0.05) {
      this.spawnRandomSparkle();
    }

    // Update and draw sparkles
    this.updateSparkles();
    this.drawSparkles();

    // Update and draw explosion particles
    this.updateExplosionParticles();
    this.drawExplosionParticles();

    this.animationFrame = requestAnimationFrame(this.animate);
  }

  /**
   * Draw the rainbow band trail with tapered effect
   */
  private drawRainbowTrail(): void {
    if (!this.ctx || this.trailPoints.length < 3) return;

    const totalStripes = this.nyanColors.length;

    // Draw segments with varying width for taper effect
    // Start from the oldest point and work towards cursor
    for (let i = 1; i < this.trailPoints.length; i++) {
      const point = this.trailPoints[i];
      const prevPoint = this.trailPoints[i - 1];

      // Progress from 0 (tail) to 1 (head/cursor)
      const progress = i / (this.trailPoints.length - 1);

      // Taper: thin at tail, full width near cursor
      // Use easing for smoother taper (ease-in curve)
      const taperFactor = Math.pow(progress, 0.6);

      // Calculate opacity: fade more at the tail
      const ageOpacity = Math.max(0, 1 - point.age / 60);
      const positionOpacity = Math.pow(progress, 0.8); // More aggressive fade at tail
      const opacity = ageOpacity * positionOpacity * (this.superRainbowActive ? 1 : 0.85);

      if (opacity < 0.03) continue;

      // Current segment width (tapered)
      const segmentWidth = this.stripeHeight * taperFactor;

      // Draw each color stripe for this segment
      this.nyanColors.forEach((color, stripeIndex) => {
        // Offset for this stripe (centered around cursor)
        const baseOffset = (stripeIndex - (totalStripes - 1) / 2) * this.stripeHeight;
        // Taper the offset too for rounded appearance
        const offset = baseOffset * taperFactor;

        this.ctx!.beginPath();
        this.ctx!.strokeStyle = color;
        this.ctx!.lineWidth = Math.max(0.5, segmentWidth);
        this.ctx!.lineCap = 'round';
        this.ctx!.lineJoin = 'round';
        this.ctx!.globalAlpha = opacity;

        // Draw segment
        const prevY = prevPoint.y + (baseOffset * (Math.pow((i - 1) / (this.trailPoints.length - 1), 0.6)));
        const currY = point.y + offset;

        this.ctx!.moveTo(prevPoint.x, prevY);

        // Use quadratic curve for smoothness
        const cpX = (prevPoint.x + point.x) / 2;
        const cpY = (prevY + currY) / 2;
        this.ctx!.quadraticCurveTo(cpX, cpY, point.x, currY);

        this.ctx!.stroke();
      });
    }

    // Draw a rounded cap at the cursor end (head of trail)
    if (this.trailPoints.length > 0) {
      const head = this.trailPoints[this.trailPoints.length - 1];
      const ageOpacity = Math.max(0, 1 - head.age / 60);

      this.nyanColors.forEach((color, stripeIndex) => {
        const offset = (stripeIndex - (totalStripes - 1) / 2) * this.stripeHeight;

        this.ctx!.beginPath();
        this.ctx!.fillStyle = color;
        this.ctx!.globalAlpha = ageOpacity * (this.superRainbowActive ? 1 : 0.9);

        // Small circle at the head for rounded appearance
        this.ctx!.arc(head.x, head.y + offset, this.stripeHeight * 0.6, 0, Math.PI * 2);
        this.ctx!.fill();
      });
    }

    this.ctx!.globalAlpha = 1;
  }

  /**
   * Spawn a sparkle along the trail
   */
  private spawnTrailSparkle(): void {
    if (this.trailPoints.length < 3) return;

    // Pick a random point along the trail
    const pointIndex = Math.floor(Math.random() * (this.trailPoints.length - 1));
    const point = this.trailPoints[pointIndex];

    const bandHeight = this.nyanColors.length * this.stripeHeight;

    this.sparkles.push({
      x: point.x + (Math.random() - 0.5) * bandHeight * 2,
      y: point.y + (Math.random() - 0.5) * bandHeight * 2,
      size: 1 + Math.random() * 2, // Smaller sparkles
      opacity: 0.8 + Math.random() * 0.2,
      rotation: Math.random() * Math.PI * 2,
      color: this.sparkleColors[Math.floor(Math.random() * this.sparkleColors.length)],
      vx: (Math.random() - 0.5) * 1.5,
      vy: (Math.random() - 0.5) * 1.5 - 0.3, // Slight upward bias
      life: 0,
      maxLife: 30 + Math.random() * 20, // Shorter lifespan
      type: ['star', 'diamond', 'circle'][Math.floor(Math.random() * 3)] as Sparkle['type']
    });
  }

  /**
   * Spawn a random ambient sparkle
   */
  private spawnRandomSparkle(): void {
    this.sparkles.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      size: 0.5 + Math.random() * 1.5, // Smaller ambient sparkles
      opacity: 0.4 + Math.random() * 0.4,
      rotation: Math.random() * Math.PI * 2,
      color: this.sparkleColors[Math.floor(Math.random() * this.sparkleColors.length)],
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 50 + Math.random() * 50,
      type: 'star'
    });
  }

  /**
   * Update sparkle positions and states
   */
  private updateSparkles(): void {
    for (let i = this.sparkles.length - 1; i >= 0; i--) {
      const sparkle = this.sparkles[i];

      sparkle.x += sparkle.vx;
      sparkle.y += sparkle.vy;
      sparkle.rotation += 0.05;
      sparkle.life++;

      // Twinkle effect
      const twinkle = Math.sin(sparkle.life * 0.3) * 0.3 + 0.7;
      sparkle.opacity = twinkle * (1 - sparkle.life / sparkle.maxLife);

      // Remove dead sparkles
      if (sparkle.life >= sparkle.maxLife) {
        this.sparkles.splice(i, 1);
      }
    }

    // Limit sparkle count
    while (this.sparkles.length > 100) {
      this.sparkles.shift();
    }
  }

  /**
   * Draw sparkles
   */
  private drawSparkles(): void {
    if (!this.ctx) return;

    for (const sparkle of this.sparkles) {
      this.ctx.save();
      this.ctx.translate(sparkle.x, sparkle.y);
      this.ctx.rotate(sparkle.rotation);
      this.ctx.globalAlpha = sparkle.opacity;
      this.ctx.fillStyle = sparkle.color;

      switch (sparkle.type) {
        case 'star':
          this.drawStar(sparkle.size);
          break;
        case 'diamond':
          this.drawDiamond(sparkle.size);
          break;
        case 'circle':
          this.ctx.beginPath();
          this.ctx.arc(0, 0, sparkle.size, 0, Math.PI * 2);
          this.ctx.fill();
          break;
      }

      // Add glow effect
      this.ctx.shadowColor = sparkle.color;
      this.ctx.shadowBlur = sparkle.size * 2;

      this.ctx.restore();
    }
  }

  /**
   * Draw a star shape
   */
  private drawStar(size: number): void {
    if (!this.ctx) return;

    const spikes = 4;
    const outerRadius = size;
    const innerRadius = size * 0.4;

    this.ctx.beginPath();

    for (let i = 0; i < spikes * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i * Math.PI) / spikes - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }

    this.ctx.closePath();
    this.ctx.fill();
  }

  /**
   * Draw a diamond shape
   */
  private drawDiamond(size: number): void {
    if (!this.ctx) return;

    this.ctx.beginPath();
    this.ctx.moveTo(0, -size);
    this.ctx.lineTo(size * 0.6, 0);
    this.ctx.lineTo(0, size);
    this.ctx.lineTo(-size * 0.6, 0);
    this.ctx.closePath();
    this.ctx.fill();
  }

  /**
   * Create explosion effect
   */
  private createExplosion(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = 3 + Math.random() * 5;

      this.explosionParticles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: this.nyanColors[i % this.nyanColors.length],
        size: 4 + Math.random() * 4,
        life: 0,
        maxLife: 50 + Math.random() * 30
      });
    }
  }

  /**
   * Update explosion particles
   */
  private updateExplosionParticles(): void {
    for (let i = this.explosionParticles.length - 1; i >= 0; i--) {
      const particle = this.explosionParticles[i];

      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.1; // Gravity
      particle.vx *= 0.98; // Friction
      particle.life++;

      if (particle.life >= particle.maxLife) {
        this.explosionParticles.splice(i, 1);
      }
    }
  }

  /**
   * Draw explosion particles
   */
  private drawExplosionParticles(): void {
    if (!this.ctx) return;

    for (const particle of this.explosionParticles) {
      const opacity = 1 - particle.life / particle.maxLife;

      this.ctx.save();
      this.ctx.globalAlpha = opacity;
      this.ctx.fillStyle = particle.color;
      this.ctx.shadowColor = particle.color;
      this.ctx.shadowBlur = particle.size;

      this.ctx.beginPath();
      this.ctx.arc(particle.x, particle.y, particle.size * opacity, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.restore();
    }
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

    // Create big explosion
    this.createExplosion(window.innerWidth / 2, window.innerHeight / 2, 50);

    // Spawn tons of sparkles
    for (let i = 0; i < 30; i++) {
      this.spawnRandomSparkle();
    }

    // Show notification
    this.showNotification('✨ NYAN! SUPER RAINBOW MODE! ✨');

    // Deactivate after 10 seconds
    setTimeout(() => {
      this.superRainbowActive = false;
      document.body.classList.remove('super-rainbow-mode');
    }, 10000);
  }

  /**
   * Show a notification
   */
  private showNotification(text: string): void {
    const notification = document.createElement('div');
    notification.className = 'nyan-notification';
    notification.textContent = text;
    notification.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: linear-gradient(135deg, #ff00ff, #00ffff);
      color: white;
      padding: 20px 40px;
      border-radius: 20px;
      font-size: 24px;
      font-weight: bold;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
      box-shadow: 0 0 30px rgba(255, 0, 255, 0.5);
      z-index: 10000;
      pointer-events: none;
    `;

    document.body.appendChild(notification);

    // Animate with GSAP
    gsap.fromTo(notification,
      { scale: 0, rotation: -10 },
      {
        scale: 1,
        rotation: 0,
        duration: 0.4,
        ease: 'back.out(1.7)'
      }
    );

    gsap.to(notification, {
      scale: 0,
      opacity: 0,
      rotation: 10,
      duration: 0.3,
      delay: 2,
      ease: 'power2.in',
      onComplete: () => notification.remove()
    });
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
