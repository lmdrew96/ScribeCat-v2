/**
 * Sound System for StudyQuest
 *
 * Handles loading and playing sound effects.
 */

import type { KAPLAYCtx, AudioPlay } from 'kaplay';

// Sound effect definitions
export const SOUNDS = {
  // UI Sounds
  menuSelect: 'Sound_#_1',
  menuConfirm: 'Sound_#_2',
  menuCancel: 'Sound_#_3',

  // Cat Sounds
  catMeow1: 'Cat_Meow_#1',
  catMeow2: 'Cat_Meow_#2',
  catMeow3: 'Cat_Meow_#3',

  // Combat
  attack: 'General_low_sounding_1',
  hit: 'General_low_sounding_2',
  criticalHit: 'General_low_sounding_3',
  miss: 'Little_1',
  defend: 'Sound_#_4',

  // Rewards & Actions
  goldCollect: 'Little_2',
  itemPickup: 'Little_3',
  heal: 'Sound_#_5',
  levelUp: 'General_low_sounding_4',
  victory: 'General_low_sounding_5',
  defeat: 'General_low_sounding_6',

  // Misc
  doorOpen: 'Sound_#_6',
  shopBuy: 'Sound_#_7',
  equip: 'Sound_#_8',
} as const;

export type SoundName = keyof typeof SOUNDS;

// Track loaded state
let soundsLoaded = false;
let soundVolume = 0.25; // FIXED: Reduced from 0.5 - less overwhelming

/**
 * Load all game sounds
 */
export async function loadGameSounds(k: KAPLAYCtx): Promise<void> {
  if (soundsLoaded) return;

  const basePath = '../../assets/SFX/MP3_AUDIO_SFX_FILES';

  const loadPromises: Promise<void>[] = [];

  for (const [_key, filename] of Object.entries(SOUNDS)) {
    // URL-encode special characters like # to %23
    const encodedFilename = encodeURIComponent(filename);
    loadPromises.push(
      k.loadSound(filename, `${basePath}/${encodedFilename}.mp3`).catch((err) => {
        console.warn(`Failed to load sound: ${filename}`, err);
      }) as Promise<void>
    );
  }

  await Promise.all(loadPromises);
  soundsLoaded = true;
  console.log('StudyQuest sounds loaded');
}

/**
 * Play a sound effect
 */
export function playSound(k: KAPLAYCtx, sound: SoundName, options?: {
  volume?: number;
  loop?: boolean;
  speed?: number;
}): AudioPlay | null {
  const soundKey = SOUNDS[sound];
  if (!soundKey) {
    console.warn(`Unknown sound: ${sound}`);
    return null;
  }

  try {
    return k.play(soundKey, {
      volume: (options?.volume ?? 1) * soundVolume,
      loop: options?.loop ?? false,
      speed: options?.speed ?? 1,
    });
  } catch (err) {
    // Sound may not be loaded
    console.warn(`Failed to play sound: ${sound}`, err);
    return null;
  }
}

/**
 * Play a random cat meow
 */
export function playCatMeow(k: KAPLAYCtx): AudioPlay | null {
  const meows: SoundName[] = ['catMeow1', 'catMeow2', 'catMeow3'];
  const randomMeow = meows[Math.floor(Math.random() * meows.length)];
  return playSound(k, randomMeow, { volume: 0.5 }); // Meows at half of already-reduced volume
}

/**
 * Set global sound volume (0-1)
 */
export function setSoundVolume(volume: number): void {
  soundVolume = Math.max(0, Math.min(1, volume));
}

/**
 * Get current sound volume
 */
export function getSoundVolume(): number {
  return soundVolume;
}
