/**
 * Effects Module
 *
 * Exports all animation and visual effect utilities.
 */

// Core animation service
export { AnimationService, getAnimationService, Durations, Easings } from './AnimationService.js';
export type { AnimationOptions } from './AnimationService.js';

// Modal animations
export { ModalAnimator, getModalAnimator } from './ModalAnimations.js';
export type { ModalElements } from './ModalAnimations.js';

// Nyan Cat effects
export { NyanEffects, getNyanEffects } from './nyan-effects.js';
