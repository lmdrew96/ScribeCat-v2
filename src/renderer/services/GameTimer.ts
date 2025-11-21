/**
 * GameTimer Service
 *
 * Reusable timer utility for multiplayer games.
 * Handles synchronized timing, timeout detection, and UI updates.
 */

import { TimeSync } from './TimeSync.js';

export interface GameTimerConfig {
  timeLimitSeconds: number;
  questionStartedAt?: number;
  onTick: (timeRemaining: number) => void;
  onTimeout: () => void;
}

export interface TimerState {
  timeRemaining: number;
  isRevealingAnswer: boolean;
  percentage: number; // For UI progress circle
}

export class GameTimer {
  private timeSync: TimeSync;
  private timerInterval: number | null = null;
  private revealTimeout: number | null = null;
  private questionStartTime: number | null = null;
  private timeRemaining: number = 0;
  private isRevealingAnswer: boolean = false;
  private config: GameTimerConfig | null = null;

  private static readonly REVEAL_DURATION_MS = 3000;
  private static readonly TICK_INTERVAL_MS = 100;

  constructor() {
    this.timeSync = TimeSync.getInstance();
  }

  /**
   * Start timer for a question
   */
  public start(config: GameTimerConfig): void {
    this.stop(); // Clean up any existing timer
    this.config = config;

    // Use shared questionStartedAt if available (for late joiner sync)
    if (config.questionStartedAt !== undefined) {
      this.questionStartTime = config.questionStartedAt;
      const elapsed = (this.timeSync.now() - config.questionStartedAt) / 1000;
      this.timeRemaining = Math.max(0, config.timeLimitSeconds - elapsed);
    } else {
      this.questionStartTime = this.timeSync.now();
      this.timeRemaining = config.timeLimitSeconds;
    }

    this.timerInterval = window.setInterval(() => {
      this.tick();
    }, GameTimer.TICK_INTERVAL_MS);
  }

  /**
   * Stop timer and clean up
   */
  public stop(): void {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    if (this.revealTimeout !== null) {
      clearTimeout(this.revealTimeout);
      this.revealTimeout = null;
    }

    this.isRevealingAnswer = false;
  }

  /**
   * Trigger reveal phase manually (e.g., when player answers)
   */
  public startReveal(onRevealComplete: () => void): void {
    this.stop();
    this.isRevealingAnswer = true;
    this.timeRemaining = 0;

    this.revealTimeout = window.setTimeout(() => {
      onRevealComplete();
    }, GameTimer.REVEAL_DURATION_MS);
  }

  /**
   * Get current timer state
   */
  public getState(): TimerState {
    const percentage = this.config
      ? (this.timeRemaining / this.config.timeLimitSeconds) * 100
      : 0;

    return {
      timeRemaining: this.timeRemaining,
      isRevealingAnswer: this.isRevealingAnswer,
      percentage: Math.max(0, Math.min(100, percentage)),
    };
  }

  /**
   * Get question start time (for calculating time taken)
   */
  public getStartTime(): number | null {
    return this.questionStartTime;
  }

  /**
   * Get timer dasharray for SVG circle progress
   */
  public getDasharray(): string {
    const { percentage } = this.getState();
    return `${percentage}, 100`;
  }

  /**
   * Check if timer is currently revealing
   */
  public isRevealing(): boolean {
    return this.isRevealingAnswer;
  }

  /**
   * Reset state for new question
   */
  public reset(): void {
    this.stop();
    this.questionStartTime = null;
    this.timeRemaining = 0;
    this.isRevealingAnswer = false;
    this.config = null;
  }

  /**
   * Clean up all resources
   */
  public cleanup(): void {
    this.reset();
  }

  /**
   * Internal tick handler
   */
  private tick(): void {
    if (!this.config || !this.questionStartTime) return;

    const elapsed = (this.timeSync.now() - this.questionStartTime) / 1000;
    this.timeRemaining = Math.max(0, this.config.timeLimitSeconds - elapsed);

    // Notify subscriber
    this.config.onTick(this.timeRemaining);

    // Time's up - handle timeout
    if (this.timeRemaining <= 0) {
      this.stop();
      this.isRevealingAnswer = true;

      this.revealTimeout = window.setTimeout(() => {
        if (this.config) {
          this.config.onTimeout();
        }
      }, GameTimer.REVEAL_DURATION_MS);
    }
  }
}
