/**
 * StudyQuestSound
 *
 * Sound effects for StudyQuest RPG using actual audio files.
 * Uses WAV/MP3 files from professional asset packs for high quality sounds.
 */

import { createLogger } from '../../../shared/logger.js';

const logger = createLogger('StudyQuestSound');

export type StudyQuestSoundName =
  | 'menu-select'    // Menu button click
  | 'menu-confirm'   // Confirm selection
  | 'menu-back'      // Go back / cancel
  | 'battle-start'   // Battle begins
  | 'attack-hit'     // Attack lands
  | 'attack-miss'    // Attack misses
  | 'attack-crit'    // Critical hit
  | 'defend'         // Defend action
  | 'damage-taken'   // Player takes damage
  | 'heal'           // Health restored
  | 'inn-heal'       // Rest at inn
  | 'victory'        // Battle won
  | 'defeat'         // Battle lost
  | 'level-up'       // Level up fanfare
  | 'item-pickup'    // Item/gold collected
  | 'quest-complete' // Quest completed
  | 'error'          // Invalid action
  | 'flee'           // Escape from battle
  // Exploration sounds
  | 'footstep'       // Walking/movement
  | 'door-open'      // Entering a building
  | 'dungeon-enter'  // Starting a dungeon
  | 'floor-advance'  // Going to next floor
  | 'chest-open'     // Opening a chest
  | 'trap-trigger'   // Triggering a trap
  | 'unlock'         // Unlocking something new
  | 'ambient-nature' // Ambient bird/nature sounds
  | 'rain-loop';     // Rain weather sound

// Map sound names to file paths
const SOUND_FILES: Record<StudyQuestSoundName, string> = {
  'menu-select': 'assets/sounds/studyquest/select.wav',
  'menu-confirm': 'assets/sounds/studyquest/confirm.wav',
  'menu-back': 'assets/sounds/studyquest/tap.wav',
  'battle-start': 'assets/sounds/studyquest/explosion.wav',
  'attack-hit': 'assets/sounds/studyquest/attack.wav',
  'attack-miss': 'assets/sounds/studyquest/tap.wav',
  'attack-crit': 'assets/sounds/studyquest/crit.wav',
  'defend': 'assets/sounds/studyquest/equip.wav',
  'damage-taken': 'assets/sounds/studyquest/hurt.wav',
  'heal': 'assets/sounds/studyquest/heal.wav',
  'inn-heal': 'assets/sounds/studyquest/powerup.wav',
  'victory': 'assets/sounds/studyquest/victory.wav',
  'defeat': 'assets/sounds/studyquest/error.wav',
  'level-up': 'assets/sounds/studyquest/levelup.wav',
  'item-pickup': 'assets/sounds/studyquest/coin.wav',
  'quest-complete': 'assets/sounds/studyquest/powerup.wav',
  'error': 'assets/sounds/studyquest/error.wav',
  'flee': 'assets/sounds/studyquest/flee.wav',
  // Exploration sounds (using existing files as fallbacks)
  'footstep': 'assets/sounds/studyquest/tap.wav',
  'door-open': 'assets/sounds/studyquest/equip.wav',
  'dungeon-enter': 'assets/sounds/studyquest/explosion.wav',
  'floor-advance': 'assets/sounds/studyquest/powerup.wav',
  'chest-open': 'assets/sounds/studyquest/coin.wav',
  'trap-trigger': 'assets/sounds/studyquest/hurt.wav',
  'unlock': 'assets/sounds/studyquest/levelup.wav',
  'ambient-nature': 'assets/sounds/studyquest/select.wav', // placeholder
  'rain-loop': 'assets/sounds/studyquest/select.wav', // placeholder
};

// Volume multipliers for different sound categories (quieter UI, louder effects)
const VOLUME_MULTIPLIERS: Partial<Record<StudyQuestSoundName, number>> = {
  'menu-select': 0.3,
  'menu-confirm': 0.4,
  'menu-back': 0.3,
  'attack-miss': 0.4,
  'level-up': 0.8,
  'victory': 0.7,
  'quest-complete': 0.7,
  // Exploration sounds - mostly quiet
  'footstep': 0.2,
  'door-open': 0.4,
  'dungeon-enter': 0.6,
  'floor-advance': 0.5,
  'chest-open': 0.5,
  'trap-trigger': 0.6,
  'unlock': 0.7,
  'ambient-nature': 0.1,
  'rain-loop': 0.15,
};

class StudyQuestSoundManager {
  private isEnabled: boolean = true;
  private volume: number = 0.5;
  private readonly STORAGE_KEY = 'studyquest-sound-enabled';
  private readonly VOLUME_KEY = 'studyquest-sound-volume';
  private audioCache: Map<string, HTMLAudioElement> = new Map();
  private preloaded: boolean = false;

  constructor() {
    this.loadSettings();
    // Preload sounds after a short delay to not block initialization
    setTimeout(() => this.preloadSounds(), 1000);
  }

  private loadSettings(): void {
    try {
      const savedEnabled = localStorage.getItem(this.STORAGE_KEY);
      if (savedEnabled !== null) {
        this.isEnabled = savedEnabled === 'true';
      }
      const savedVolume = localStorage.getItem(this.VOLUME_KEY);
      if (savedVolume !== null) {
        this.volume = parseFloat(savedVolume);
      }
    } catch (error) {
      logger.warn('Failed to load sound settings:', error);
    }
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, String(this.isEnabled));
      localStorage.setItem(this.VOLUME_KEY, String(this.volume));
    } catch (error) {
      logger.warn('Failed to save sound settings:', error);
    }
  }

  /**
   * Preload all sound files into cache
   */
  private preloadSounds(): void {
    if (this.preloaded) return;

    const uniquePaths = new Set(Object.values(SOUND_FILES));

    for (const path of uniquePaths) {
      try {
        const audio = new Audio(path);
        audio.preload = 'auto';
        audio.volume = this.volume;
        this.audioCache.set(path, audio);
      } catch (error) {
        logger.warn(`Failed to preload sound: ${path}`, error);
      }
    }

    this.preloaded = true;
    logger.info(`Preloaded ${uniquePaths.size} sound effects`);
  }

  /**
   * Enable or disable sound effects
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    this.saveSettings();
    logger.info(`Sound effects ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if sound is enabled
   */
  getEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Set master volume (0-1)
   */
  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    this.saveSettings();

    // Update volume on cached audio elements
    for (const audio of this.audioCache.values()) {
      audio.volume = this.volume;
    }
  }

  /**
   * Get current volume
   */
  getVolume(): number {
    return this.volume;
  }

  /**
   * Play a sound effect
   */
  play(sound: StudyQuestSoundName): void {
    if (!this.isEnabled) return;

    const path = SOUND_FILES[sound];
    if (!path) {
      logger.warn(`Unknown sound: ${sound}`);
      return;
    }

    try {
      // Get cached audio or create new
      let audio = this.audioCache.get(path);

      if (audio) {
        // Clone the audio element for overlapping sounds
        if (!audio.paused) {
          audio = audio.cloneNode(true) as HTMLAudioElement;
        }
      } else {
        audio = new Audio(path);
        this.audioCache.set(path, audio);
      }

      // Apply volume multiplier for this sound type
      const multiplier = VOLUME_MULTIPLIERS[sound] ?? 1.0;
      audio.volume = this.volume * multiplier;
      audio.currentTime = 0;

      audio.play().catch(error => {
        // Silently ignore autoplay restrictions - sound will work after user interaction
        if (error.name !== 'NotAllowedError') {
          logger.warn(`Failed to play ${sound}:`, error);
        }
      });
    } catch (error) {
      logger.error(`Error playing sound ${sound}:`, error);
    }
  }

  /**
   * Play a sound with a slight delay (useful for UI feedback)
   */
  playDelayed(sound: StudyQuestSoundName, delayMs: number): void {
    setTimeout(() => this.play(sound), delayMs);
  }

  /**
   * Stop all currently playing sounds
   */
  stopAll(): void {
    for (const audio of this.audioCache.values()) {
      audio.pause();
      audio.currentTime = 0;
    }
  }
}

// Export singleton instance
export const StudyQuestSound = new StudyQuestSoundManager();
