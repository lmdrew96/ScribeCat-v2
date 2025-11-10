/**
 * SoundManager - Phase 6.4 Personality & Delight
 *
 * Manages sound effects and audio feedback throughout the application.
 * Cat-themed sounds add personality and provide audio confirmation for actions.
 *
 * Features:
 * - Cat-themed sound effects (purr, meow, bell, etc.)
 * - Volume control with user preferences
 * - Mute/unmute functionality
 * - Respect OS sound settings
 * - Programmatic sound generation (Web Audio API)
 * - Support for external audio files
 * - Sound preloading for instant playback
 *
 * @example
 * SoundManager.play('purr'); // Play success sound
 * SoundManager.setVolume(0.5); // 50% volume
 * SoundManager.mute(); // Mute all sounds
 */

export type SoundName =
  | 'purr'        // Success, save confirmation
  | 'meow'        // Notification, alert
  | 'bell'        // Button click, UI interaction
  | 'success'     // Major achievement, quiz completion
  | 'whoosh'      // Page transition, swipe
  | 'pop'         // Modal open, tooltip appear
  | 'click'       // Generic click
  | 'error'       // Error, failure
  | 'typing'      // AI thinking, processing
  | 'confetti';   // Celebration

interface Sound {
  name: SoundName;
  type: 'file' | 'generated';
  /** Path to audio file (if type is 'file') */
  src?: string;
  /** Generator function (if type is 'generated') */
  generator?: (context: AudioContext, volume: number) => void;
  /** Cached audio buffer */
  buffer?: AudioBuffer;
}

export class SoundManager {
  private static instance: SoundManager | null = null;
  private static readonly STORAGE_KEY = 'scribecat_sound_settings';

  private audioContext: AudioContext | null = null;
  private sounds: Map<SoundName, Sound> = new Map();
  private masterVolume: number = 0.5;
  private isMuted: boolean = false;
  private isEnabled: boolean = true;

  /**
   * Sound library with cat-themed effects
   */
  private static readonly SOUND_LIBRARY: Sound[] = [
    {
      name: 'purr',
      type: 'generated',
      generator: (context, volume) => {
        // Soft purring sound - low frequency rumble
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        const filterNode = context.createBiquadFilter();

        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(50, context.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(30, context.currentTime + 0.5);

        filterNode.type = 'lowpass';
        filterNode.frequency.value = 200;

        gainNode.gain.setValueAtTime(volume * 0.3, context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.5);

        oscillator.connect(filterNode);
        filterNode.connect(gainNode);
        gainNode.connect(context.destination);

        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + 0.5);
      }
    },
    {
      name: 'meow',
      type: 'generated',
      generator: (context, volume) => {
        // Quick meow - rising pitch
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();

        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(300, context.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(600, context.currentTime + 0.1);
        oscillator.frequency.exponentialRampToValueAtTime(400, context.currentTime + 0.3);

        gainNode.gain.setValueAtTime(volume * 0.2, context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.3);

        oscillator.connect(gainNode);
        gainNode.connect(context.destination);

        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + 0.3);
      }
    },
    {
      name: 'bell',
      type: 'generated',
      generator: (context, volume) => {
        // Soft bell chime for clicks
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.value = 800;

        gainNode.gain.setValueAtTime(volume * 0.15, context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.15);

        oscillator.connect(gainNode);
        gainNode.connect(context.destination);

        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + 0.15);
      }
    },
    {
      name: 'success',
      type: 'generated',
      generator: (context, volume) => {
        // Happy success chime - ascending notes
        const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 (C major chord)
        notes.forEach((freq, i) => {
          const oscillator = context.createOscillator();
          const gainNode = context.createGain();

          oscillator.type = 'sine';
          oscillator.frequency.value = freq;

          const startTime = context.currentTime + (i * 0.08);
          gainNode.gain.setValueAtTime(volume * 0.2, startTime);
          gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);

          oscillator.connect(gainNode);
          gainNode.connect(context.destination);

          oscillator.start(startTime);
          oscillator.stop(startTime + 0.5);
        });
      }
    },
    {
      name: 'whoosh',
      type: 'generated',
      generator: (context, volume) => {
        // Swoosh sound for transitions
        const bufferSize = context.sampleRate * 0.2;
        const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
        const data = buffer.getChannelData(0);

        // Generate white noise with envelope
        for (let i = 0; i < bufferSize; i++) {
          const envelope = 1 - (i / bufferSize);
          data[i] = (Math.random() * 2 - 1) * envelope;
        }

        const source = context.createBufferSource();
        const gainNode = context.createGain();
        const filterNode = context.createBiquadFilter();

        source.buffer = buffer;

        filterNode.type = 'highpass';
        filterNode.frequency.setValueAtTime(1000, context.currentTime);
        filterNode.frequency.exponentialRampToValueAtTime(200, context.currentTime + 0.2);

        gainNode.gain.value = volume * 0.3;

        source.connect(filterNode);
        filterNode.connect(gainNode);
        gainNode.connect(context.destination);

        source.start(context.currentTime);
      }
    },
    {
      name: 'pop',
      type: 'generated',
      generator: (context, volume) => {
        // Quick pop for UI elements
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(600, context.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(300, context.currentTime + 0.05);

        gainNode.gain.setValueAtTime(volume * 0.25, context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.1);

        oscillator.connect(gainNode);
        gainNode.connect(context.destination);

        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + 0.1);
      }
    },
    {
      name: 'click',
      type: 'generated',
      generator: (context, volume) => {
        // Subtle click
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();

        oscillator.type = 'square';
        oscillator.frequency.value = 400;

        gainNode.gain.setValueAtTime(volume * 0.1, context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.05);

        oscillator.connect(gainNode);
        gainNode.connect(context.destination);

        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + 0.05);
      }
    },
    {
      name: 'error',
      type: 'generated',
      generator: (context, volume) => {
        // Error buzz - descending dissonant notes
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();

        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(200, context.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(100, context.currentTime + 0.2);

        gainNode.gain.setValueAtTime(volume * 0.2, context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.2);

        oscillator.connect(gainNode);
        gainNode.connect(context.destination);

        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + 0.2);
      }
    },
    {
      name: 'typing',
      type: 'generated',
      generator: (context, volume) => {
        // Typing sound - quick click
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();

        oscillator.type = 'square';
        oscillator.frequency.value = 1200;

        gainNode.gain.setValueAtTime(volume * 0.08, context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.02);

        oscillator.connect(gainNode);
        gainNode.connect(context.destination);

        oscillator.start(context.currentTime);
        oscillator.stop(context.currentTime + 0.02);
      }
    },
    {
      name: 'confetti',
      type: 'generated',
      generator: (context, volume) => {
        // Celebratory sound - random happy notes
        const notes = [523.25, 587.33, 659.25, 783.99, 880.0]; // C, D, E, G, A
        for (let i = 0; i < 8; i++) {
          const randomNote = notes[Math.floor(Math.random() * notes.length)];
          const oscillator = context.createOscillator();
          const gainNode = context.createGain();

          oscillator.type = 'sine';
          oscillator.frequency.value = randomNote;

          const startTime = context.currentTime + (i * 0.05);
          gainNode.gain.setValueAtTime(volume * 0.15, startTime);
          gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);

          oscillator.connect(gainNode);
          gainNode.connect(context.destination);

          oscillator.start(startTime);
          oscillator.stop(startTime + 0.3);
        }
      }
    }
  ];

  private constructor() {
    this.loadSettings();
    this.initializeAudioContext();
    this.registerSounds();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): SoundManager {
    if (!this.instance) {
      this.instance = new SoundManager();
    }
    return this.instance;
  }

  /**
   * Play a sound by name
   */
  public static play(soundName: SoundName, volumeOverride?: number): void {
    this.getInstance().playSound(soundName, volumeOverride);
  }

  /**
   * Set master volume (0-1)
   */
  public static setVolume(volume: number): void {
    const instance = this.getInstance();
    instance.masterVolume = Math.max(0, Math.min(1, volume));
    instance.saveSettings();
  }

  /**
   * Get current volume
   */
  public static getVolume(): number {
    return this.getInstance().masterVolume;
  }

  /**
   * Mute all sounds
   */
  public static mute(): void {
    const instance = this.getInstance();
    instance.isMuted = true;
    instance.saveSettings();
  }

  /**
   * Unmute sounds
   */
  public static unmute(): void {
    const instance = this.getInstance();
    instance.isMuted = false;
    instance.saveSettings();
  }

  /**
   * Toggle mute
   */
  public static toggleMute(): boolean {
    const instance = this.getInstance();
    instance.isMuted = !instance.isMuted;
    instance.saveSettings();
    return instance.isMuted;
  }

  /**
   * Check if muted
   */
  public static isMuted(): boolean {
    return this.getInstance().isMuted;
  }

  /**
   * Enable sounds
   */
  public static enable(): void {
    const instance = this.getInstance();
    instance.isEnabled = true;
    instance.saveSettings();
  }

  /**
   * Disable sounds
   */
  public static disable(): void {
    const instance = this.getInstance();
    instance.isEnabled = false;
    instance.saveSettings();
  }

  /**
   * Check if sounds are enabled
   */
  public static isEnabled(): boolean {
    return this.getInstance().isEnabled;
  }

  /**
   * Toggle sounds on/off
   */
  public static toggleEnabled(): boolean {
    const instance = this.getInstance();
    instance.isEnabled = !instance.isEnabled;
    instance.saveSettings();
    return instance.isEnabled;
  }

  /**
   * Initialize audio context
   */
  private initializeAudioContext(): void {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.warn('Web Audio API not supported:', error);
      this.isEnabled = false;
    }
  }

  /**
   * Register sound library
   */
  private registerSounds(): void {
    SoundManager.SOUND_LIBRARY.forEach(sound => {
      this.sounds.set(sound.name, sound);
    });
  }

  /**
   * Play a sound
   */
  private playSound(soundName: SoundName, volumeOverride?: number): void {
    if (!this.isEnabled || this.isMuted || !this.audioContext) {
      return;
    }

    const sound = this.sounds.get(soundName);
    if (!sound) {
      console.warn(`Sound "${soundName}" not found`);
      return;
    }

    // Resume audio context if suspended (browser autoplay policy)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    const volume = volumeOverride !== undefined ? volumeOverride : this.masterVolume;

    if (sound.type === 'generated' && sound.generator) {
      // Generate sound programmatically
      sound.generator(this.audioContext, volume);
    } else if (sound.type === 'file' && sound.buffer) {
      // Play from buffer
      const source = this.audioContext.createBufferSource();
      const gainNode = this.audioContext.createGain();

      source.buffer = sound.buffer;
      gainNode.gain.value = volume;

      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      source.start(0);
    } else if (sound.type === 'file' && sound.src) {
      // Load and play file (first time)
      this.loadAudioFile(sound.src).then(buffer => {
        sound.buffer = buffer;
        this.playSound(soundName, volumeOverride);
      }).catch(error => {
        console.warn(`Failed to load sound "${soundName}":`, error);
      });
    }
  }

  /**
   * Load audio file into buffer
   */
  private async loadAudioFile(url: string): Promise<AudioBuffer> {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }

    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return await this.audioContext.decodeAudioData(arrayBuffer);
  }

  /**
   * Load settings from localStorage
   */
  private loadSettings(): void {
    const settings = localStorage.getItem(SoundManager.STORAGE_KEY);
    if (settings) {
      try {
        const parsed = JSON.parse(settings);
        this.masterVolume = parsed.volume ?? 0.5;
        this.isMuted = parsed.muted ?? false;
        this.isEnabled = parsed.enabled ?? true;
      } catch (error) {
        console.warn('Failed to load sound settings:', error);
      }
    }
  }

  /**
   * Save settings to localStorage
   */
  private saveSettings(): void {
    const settings = {
      volume: this.masterVolume,
      muted: this.isMuted,
      enabled: this.isEnabled
    };
    localStorage.setItem(SoundManager.STORAGE_KEY, JSON.stringify(settings));
  }

  /**
   * Preload all sounds (optional, for better performance)
   */
  public static async preloadAll(): Promise<void> {
    const instance = this.getInstance();
    const promises: Promise<void>[] = [];

    instance.sounds.forEach((sound) => {
      if (sound.type === 'file' && sound.src && !sound.buffer) {
        promises.push(
          instance.loadAudioFile(sound.src)
            .then(buffer => { sound.buffer = buffer; })
            .catch(error => console.warn(`Failed to preload sound:`, error))
        );
      }
    });

    await Promise.all(promises);
  }

  /**
   * Add a custom sound
   */
  public static addSound(name: string, src: string): void {
    const instance = this.getInstance();
    instance.sounds.set(name as SoundName, {
      name: name as SoundName,
      type: 'file',
      src
    });
  }
}

/**
 * Initialize sound system
 * Call this once during app initialization
 */
export function initializeSoundSystem(): void {
  // Initialize singleton
  SoundManager.getInstance();

  // Resume audio context on first user interaction (browser requirement)
  const resumeAudio = () => {
    const instance = SoundManager.getInstance();
    if (instance['audioContext'] && instance['audioContext'].state === 'suspended') {
      instance['audioContext'].resume();
    }
    // Only need to do this once
    document.removeEventListener('click', resumeAudio);
    document.removeEventListener('keydown', resumeAudio);
  };

  document.addEventListener('click', resumeAudio);
  document.addEventListener('keydown', resumeAudio);
}

/**
 * Example: Add sound effects to common UI actions
 * Call this after app initialization to enable sounds throughout the app
 */
export function enableGlobalSoundEffects(): void {
  // Button clicks
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    if (target.matches('button:not(:disabled)')) {
      if (target.classList.contains('primary-btn')) {
        SoundManager.play('click');
      } else {
        SoundManager.play('bell');
      }
    }
  });

  // Success toasts
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node instanceof HTMLElement && node.classList.contains('toast')) {
          if (node.classList.contains('success')) {
            SoundManager.play('purr');
          } else if (node.classList.contains('error')) {
            SoundManager.play('error');
          } else {
            SoundManager.play('pop');
          }
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
}
