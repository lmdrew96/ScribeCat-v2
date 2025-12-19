/**
 * AudioManager
 *
 * Handles all audio playback for StudyQuest:
 * - Background music with cross-fade transitions
 * - Sound effects triggered by game events
 * - Volume controls with persistence
 *
 * Uses Excalibur's audio system (ex.Sound) for playback.
 */

import * as ex from 'excalibur';

// Asset paths (relative from dist/renderer/)
const SFX_BASE = '../../assets/SFX';
const SOUNDTRACK_BASE = '../../assets/SOUNDTRACK';

/**
 * Sound effect identifiers
 */
export type SoundEffect =
  | 'meow1'
  | 'meow2'
  | 'meow3'
  | 'coin'
  | 'heal'
  | 'healingFountain'
  | 'hiddenObject'
  | 'levelUp'
  | 'potionUse';

/**
 * Music track identifiers
 */
export type MusicTrack =
  | 'cozyHearth'
  | 'starlitMeadow'
  | 'moonLake'
  | 'morningDew'
  | 'morningDew2'
  | 'flowerTown'
  | 'flowerTown2'
  | 'agentsOfNip'
  | 'catRyder'
  | 'sunsetStroll';

/**
 * Scene to music mapping
 */
export type SceneMusic = {
  scene: string;
  track: MusicTrack;
};

// Sound effect file mappings
const SFX_FILES: Record<SoundEffect, string> = {
  meow1: 'Cat_Meow_#1.mp3',
  meow2: 'Cat_Meow_#2.mp3',
  meow3: 'Cat_Meow_#3.mp3',
  coin: 'coin.mp3',
  heal: 'heal.mp3',
  healingFountain: 'healing_fountain.mp3',
  hiddenObject: 'hidden_object.mp3',
  levelUp: 'level_up.mp3',
  potionUse: 'potion_use.mp3',
};

// Music track file mappings
const MUSIC_FILES: Record<MusicTrack, string> = {
  cozyHearth: 'Track_1_Cozy_Hearth_Full_SoundTrack.mp3',
  starlitMeadow: 'Track_2_Starlit_Meadow_Full_SoundTrack.mp3',
  moonLake: 'Track_3_MoonLake_Full_SoundTrack.mp3',
  morningDew: 'Track_4_Morning_Dew_Full_SoundTrack.mp3',
  morningDew2: 'Track_5_Morning_Dew 2_Full_SoundTrack.mp3',
  flowerTown: 'Track_6_Flower_Town_Full_SoundTrack.mp3',
  flowerTown2: 'Track_7_Flower_Town_Full_SoundTrack.mp3',
  agentsOfNip: 'Track_8_Agents_of_NIP_Full_SoundTrack.mp3',
  catRyder: 'Track_9_Cat_Ryder_Full_SoundTrack.mp3',
  sunsetStroll: 'Track_10_Sunset_Stroll_Full_SoundTrack.mp3',
};

// Default scene to music mappings
const SCENE_MUSIC: Record<string, MusicTrack> = {
  title: 'cozyHearth',
  town: 'flowerTown',
  home: 'cozyHearth',
  shop: 'morningDew',
  inn: 'starlitMeadow',
  dungeon: 'agentsOfNip',
  battle: 'catRyder',
  inventory: 'morningDew2',
};

// Cross-fade duration in milliseconds
const CROSSFADE_DURATION = 1500;

// Storage keys for volume settings
const STORAGE_KEY_MUSIC_VOLUME = 'studyquest_music_volume';
const STORAGE_KEY_SFX_VOLUME = 'studyquest_sfx_volume';
const STORAGE_KEY_MUSIC_ENABLED = 'studyquest_music_enabled';
const STORAGE_KEY_SFX_ENABLED = 'studyquest_sfx_enabled';

/**
 * Singleton AudioManager for the game
 */
class AudioManagerClass {
  private sfxCache: Map<SoundEffect, ex.Sound> = new Map();
  private musicCache: Map<MusicTrack, ex.Sound> = new Map();

  private currentTrack: MusicTrack | null = null;
  private currentMusic: ex.Sound | null = null;
  private nextMusic: ex.Sound | null = null;
  private isCrossfading = false;

  private _musicVolume = 0.5;
  private _sfxVolume = 0.7;
  private _musicEnabled = true;
  private _sfxEnabled = true;

  private initialized = false;

  constructor() {
    this.loadSettings();
  }

  /**
   * Initialize the audio manager and preload sounds
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Preload all sound effects (they're small)
    await this.preloadSoundEffects();

    this.initialized = true;
    console.log('[AudioManager] Initialized');
  }

  /**
   * Preload all sound effects into cache
   */
  private async preloadSoundEffects(): Promise<void> {
    const loadPromises = Object.entries(SFX_FILES).map(async ([key, filename]) => {
      try {
        const sound = new ex.Sound(`${SFX_BASE}/${filename}`);
        await sound.load();
        this.sfxCache.set(key as SoundEffect, sound);
      } catch (err) {
        console.warn(`[AudioManager] Failed to load SFX: ${filename}`, err);
      }
    });

    await Promise.all(loadPromises);
    console.log(`[AudioManager] Loaded ${this.sfxCache.size} sound effects`);
  }

  /**
   * Load a music track (lazy loading)
   */
  private async loadMusicTrack(track: MusicTrack): Promise<ex.Sound | null> {
    if (this.musicCache.has(track)) {
      return this.musicCache.get(track)!;
    }

    const filename = MUSIC_FILES[track];
    try {
      const music = new ex.Sound(`${SOUNDTRACK_BASE}/${filename}`);
      music.loop = true;
      await music.load();
      this.musicCache.set(track, music);
      return music;
    } catch (err) {
      console.warn(`[AudioManager] Failed to load music: ${filename}`, err);
      return null;
    }
  }

  /**
   * Play a sound effect
   */
  playSfx(effect: SoundEffect): void {
    if (!this._sfxEnabled) return;

    const sound = this.sfxCache.get(effect);
    if (sound) {
      sound.volume = this._sfxVolume;
      sound.play();
    } else {
      console.warn(`[AudioManager] SFX not loaded: ${effect}`);
    }
  }

  /**
   * Play a random meow sound
   */
  playRandomMeow(): void {
    const meows: SoundEffect[] = ['meow1', 'meow2', 'meow3'];
    const randomMeow = meows[Math.floor(Math.random() * meows.length)];
    this.playSfx(randomMeow);
  }

  /**
   * Play music for a specific scene
   */
  async playSceneMusic(sceneName: string): Promise<void> {
    const track = SCENE_MUSIC[sceneName];
    if (track) {
      await this.playMusic(track);
    }
  }

  /**
   * Play a specific music track with cross-fade
   */
  async playMusic(track: MusicTrack): Promise<void> {
    if (!this._musicEnabled) return;
    if (track === this.currentTrack && this.currentMusic?.isPlaying()) return;

    const newMusic = await this.loadMusicTrack(track);
    if (!newMusic) return;

    // If no current music, just start playing
    if (!this.currentMusic || !this.currentMusic.isPlaying()) {
      newMusic.volume = this._musicVolume;
      newMusic.play();
      this.currentMusic = newMusic;
      this.currentTrack = track;
      return;
    }

    // Cross-fade from current to new
    await this.crossFade(this.currentMusic, newMusic);
    this.currentMusic = newMusic;
    this.currentTrack = track;
  }

  /**
   * Cross-fade between two music tracks
   */
  private async crossFade(from: ex.Sound, to: ex.Sound): Promise<void> {
    if (this.isCrossfading) return;
    this.isCrossfading = true;

    const steps = 30;
    const stepDuration = CROSSFADE_DURATION / steps;
    const volumeStep = this._musicVolume / steps;

    // Start new track at zero volume
    to.volume = 0;
    to.play();

    for (let i = 0; i <= steps; i++) {
      from.volume = Math.max(0, this._musicVolume - volumeStep * i);
      to.volume = Math.min(this._musicVolume, volumeStep * i);
      await this.sleep(stepDuration);
    }

    from.stop();
    from.volume = this._musicVolume;
    this.isCrossfading = false;
  }

  /**
   * Stop all music
   */
  stopMusic(): void {
    if (this.currentMusic) {
      this.currentMusic.stop();
      this.currentMusic = null;
      this.currentTrack = null;
    }
  }

  /**
   * Pause music
   */
  pauseMusic(): void {
    if (this.currentMusic) {
      this.currentMusic.pause();
    }
  }

  /**
   * Resume music
   */
  resumeMusic(): void {
    if (this.currentMusic && this._musicEnabled) {
      this.currentMusic.play();
    }
  }

  // === Volume Controls ===

  get musicVolume(): number {
    return this._musicVolume;
  }

  set musicVolume(value: number) {
    this._musicVolume = Math.max(0, Math.min(1, value));
    if (this.currentMusic) {
      this.currentMusic.volume = this._musicVolume;
    }
    this.saveSettings();
  }

  get sfxVolume(): number {
    return this._sfxVolume;
  }

  set sfxVolume(value: number) {
    this._sfxVolume = Math.max(0, Math.min(1, value));
    this.saveSettings();
  }

  get musicEnabled(): boolean {
    return this._musicEnabled;
  }

  set musicEnabled(value: boolean) {
    this._musicEnabled = value;
    if (!value) {
      this.stopMusic();
    }
    this.saveSettings();
  }

  get sfxEnabled(): boolean {
    return this._sfxEnabled;
  }

  set sfxEnabled(value: boolean) {
    this._sfxEnabled = value;
    this.saveSettings();
  }

  // === Persistence ===

  private loadSettings(): void {
    try {
      const musicVol = localStorage.getItem(STORAGE_KEY_MUSIC_VOLUME);
      const sfxVol = localStorage.getItem(STORAGE_KEY_SFX_VOLUME);
      const musicEnabled = localStorage.getItem(STORAGE_KEY_MUSIC_ENABLED);
      const sfxEnabled = localStorage.getItem(STORAGE_KEY_SFX_ENABLED);

      if (musicVol !== null) this._musicVolume = parseFloat(musicVol);
      if (sfxVol !== null) this._sfxVolume = parseFloat(sfxVol);
      if (musicEnabled !== null) this._musicEnabled = musicEnabled === 'true';
      if (sfxEnabled !== null) this._sfxEnabled = sfxEnabled === 'true';
    } catch {
      // Ignore localStorage errors
    }
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(STORAGE_KEY_MUSIC_VOLUME, this._musicVolume.toString());
      localStorage.setItem(STORAGE_KEY_SFX_VOLUME, this._sfxVolume.toString());
      localStorage.setItem(STORAGE_KEY_MUSIC_ENABLED, this._musicEnabled.toString());
      localStorage.setItem(STORAGE_KEY_SFX_ENABLED, this._sfxEnabled.toString());
    } catch {
      // Ignore localStorage errors
    }
  }

  // === Utilities ===

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const AudioManager = new AudioManagerClass();

// Expose globally for settings panels
(window as unknown as { __studyquest_audio__: typeof AudioManager }).__studyquest_audio__ = AudioManager;
