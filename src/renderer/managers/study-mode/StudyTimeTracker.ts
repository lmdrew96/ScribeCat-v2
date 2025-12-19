/**
 * StudyTimeTracker
 *
 * Tracks time spent studying in session detail views.
 * Accumulates time per session and periodically saves to the backend.
 *
 * This tracks ACTUAL study time (time spent viewing a session),
 * not just playback time. The tracked time is saved to session.studyModeTime
 * which is used by:
 * - Analytics dashboard (total study time)
 * - Achievements (time-based achievements)
 * - Goals (daily/weekly study time goals)
 */

import { createLogger } from '../../../shared/logger.js';

const logger = createLogger('StudyTimeTracker');

/** How often to save accumulated time (in seconds) */
const SAVE_INTERVAL_SECONDS = 30;

export class StudyTimeTracker {
  private currentSessionId: string | null = null;
  private trackingStartTime: number | null = null;
  private accumulatedSeconds: number = 0;
  private lastSaveTime: number = 0;
  private trackingInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Start tracking time for a session.
   * Call this when opening a session detail view.
   */
  startTracking(sessionId: string): void {
    // If already tracking the same session, continue
    if (this.currentSessionId === sessionId && this.trackingStartTime) {
      logger.debug(`Already tracking session ${sessionId}`);
      return;
    }

    // If tracking a different session, stop and save first
    if (this.currentSessionId && this.currentSessionId !== sessionId) {
      this.stopTracking();
    }

    this.currentSessionId = sessionId;
    this.trackingStartTime = Date.now();
    this.accumulatedSeconds = 0;
    this.lastSaveTime = 0;

    // Start interval to accumulate and save time
    this.trackingInterval = setInterval(() => {
      this.tick();
    }, 1000);

    logger.info(`Started tracking study time for session ${sessionId}`);
  }

  /**
   * Stop tracking and save any remaining time.
   * Call this when navigating away from session detail.
   */
  stopTracking(): void {
    if (!this.currentSessionId || !this.trackingStartTime) {
      return;
    }

    // Clear the interval
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }

    // Calculate final accumulated time
    const elapsed = Math.floor((Date.now() - this.trackingStartTime) / 1000);
    this.accumulatedSeconds = elapsed;

    // Save remaining unsaved time
    if (this.accumulatedSeconds > this.lastSaveTime) {
      this.saveTime();
    }

    logger.info(`Stopped tracking. Total time: ${this.accumulatedSeconds}s for session ${this.currentSessionId}`);

    // Reset state
    this.currentSessionId = null;
    this.trackingStartTime = null;
    this.accumulatedSeconds = 0;
    this.lastSaveTime = 0;
  }

  /**
   * Get the session currently being tracked (if any)
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Check if tracking is active
   */
  isTracking(): boolean {
    return this.currentSessionId !== null && this.trackingStartTime !== null;
  }

  /**
   * Get the current accumulated time in seconds
   */
  getAccumulatedSeconds(): number {
    if (!this.trackingStartTime) return 0;
    return Math.floor((Date.now() - this.trackingStartTime) / 1000);
  }

  /**
   * Called every second while tracking
   */
  private tick(): void {
    if (!this.trackingStartTime) return;

    this.accumulatedSeconds = Math.floor((Date.now() - this.trackingStartTime) / 1000);

    // Save periodically
    if (this.accumulatedSeconds - this.lastSaveTime >= SAVE_INTERVAL_SECONDS) {
      this.saveTime();
    }
  }

  /**
   * Save accumulated time to the session via IPC
   */
  private async saveTime(): Promise<void> {
    if (!this.currentSessionId || this.accumulatedSeconds <= this.lastSaveTime) {
      return;
    }

    const timeToSave = this.accumulatedSeconds - this.lastSaveTime;

    try {
      const result = await window.scribeCat.session.addStudyModeTime(
        this.currentSessionId,
        timeToSave
      );

      if (result.success) {
        this.lastSaveTime = this.accumulatedSeconds;
        logger.debug(`Saved ${timeToSave}s of study time for session ${this.currentSessionId}`);
      } else {
        logger.error(`Failed to save study time: ${result.error}`);
      }
    } catch (error) {
      logger.error('Error saving study time:', error);
    }
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.stopTracking();
  }
}

// Singleton instance for app-wide use
let studyTimeTrackerInstance: StudyTimeTracker | null = null;

export function getStudyTimeTracker(): StudyTimeTracker {
  if (!studyTimeTrackerInstance) {
    studyTimeTrackerInstance = new StudyTimeTracker();
  }
  return studyTimeTrackerInstance;
}
