/**
 * UI Exports
 *
 * Barrel file for UI components and effects.
 */

export { drawHUD, drawEntityHealthBar, type HUDConfig } from './hud.js';
export {
  flashEntity,
  showFloatingNumber,
  pulseEntity,
  spawnParticles,
  impactEffect,
} from './effects.js';
export {
  createSpeechBubble,
  createSpeechBubbleManager,
  getRandomMessage,
  SPEECH_MESSAGES,
  type SpeechBubbleConfig,
  type SpeechBubble,
  type MessageCategory,
} from './speechBubble.js';
