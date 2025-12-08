/**
 * StudyBuddyGame
 *
 * Wrapper class for the Study Buddy KAPLAY game.
 * Provides a simple API for integrating with the rest of the application.
 */

import type { KAPLAYCtx } from 'kaplay';
import { initGame, destroyGame } from './index.js';
import { registerStudyBuddyScene, type StudyBuddyState, type MessageCategory } from './scenes/StudyBuddyScene.js';
import { STUDY_BUDDY_WIDTH, STUDY_BUDDY_HEIGHT } from './config.js';
import type { CatColor } from './sprites/catSprites.js';

export class StudyBuddyGame {
  private k: KAPLAYCtx;
  private canvasId: string;
  private state: StudyBuddyState;
  private onCatClick?: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvasId = canvas.id || `study-buddy-${Date.now()}`;
    canvas.id = this.canvasId;

    // Initialize KAPLAY with small widget dimensions
    this.k = initGame({
      canvas,
      width: STUDY_BUDDY_WIDTH,
      height: STUDY_BUDDY_HEIGHT,
      scale: 1,
      background: [0, 0, 0], // Transparent-ish
      debug: false,
    });

    // Default state
    this.state = {
      catColor: 'brown',
      isActive: true,
      isSleeping: false,
    };

    // Register the scene
    registerStudyBuddyScene(this.k);
  }

  /**
   * Set the cat color
   */
  setCatColor(color: CatColor): void {
    this.state.catColor = color;
    this.refresh();
  }

  /**
   * Set whether the user is actively studying
   */
  setActive(isActive: boolean): void {
    this.state.isActive = isActive;
    this.refresh();
  }

  /**
   * Set sleeping state
   */
  setSleeping(isSleeping: boolean): void {
    this.state.isSleeping = isSleeping;
    this.refresh();
  }

  /**
   * Set click callback
   */
  setOnClick(callback: () => void): void {
    this.onCatClick = callback;
    this.refresh();
  }

  /**
   * Start the game with initial state
   */
  start(catColor?: CatColor, isActive?: boolean, isSleeping?: boolean): void {
    if (catColor !== undefined) this.state.catColor = catColor;
    if (isActive !== undefined) this.state.isActive = isActive;
    if (isSleeping !== undefined) this.state.isSleeping = isSleeping;

    this.k.go('studyBuddy', {
      state: this.state,
      onCatClick: this.onCatClick,
    });
  }

  /**
   * Update state and re-enter scene
   */
  updateState(updates: Partial<StudyBuddyState>): void {
    this.state = { ...this.state, ...updates };
    this.refresh();
  }

  /**
   * Refresh the scene with current state
   */
  private refresh(): void {
    // Re-enter scene to update
    this.k.go('studyBuddy', {
      state: this.state,
      onCatClick: this.onCatClick,
    });
  }

  /**
   * Trigger celebration animation
   */
  celebrate(): void {
    // Celebration is handled within the scene
    // We can re-enter with a celebration flag if needed
  }

  /**
   * Show a speech bubble message
   */
  showMessage(category: MessageCategory): void {
    // Messages are handled within the scene
    // For now, clicking triggers random messages
  }

  /**
   * Get current state
   */
  getState(): StudyBuddyState {
    return { ...this.state };
  }

  /**
   * Destroy the game instance
   */
  destroy(): void {
    destroyGame(this.canvasId);
  }
}
