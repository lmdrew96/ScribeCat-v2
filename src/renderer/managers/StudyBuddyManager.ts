/**
 * StudyBuddyManager
 *
 * Manages the Study Buddy feature - a cat companion that appears in the
 * main ScribeCat interface while studying. Tracks activity, awards passive
 * XP/gold, and controls buddy behavior.
 */

import { createLogger } from '../../shared/logger.js';
import { PlayerStatsService } from '../canvas/PlayerStatsService.js';
import type { CatColor } from '../canvas/CatSpriteManager.js';
import type { BuddyState, StudyBuddyCanvas } from '../canvas/StudyBuddyCanvas.js';

const logger = createLogger('StudyBuddyManager');

// Activity tracking constants
const ACTIVITY_TIMEOUT_MS = 120000; // 2 minutes of no activity = idle
const FOCUS_CHECK_INTERVAL_MS = 60000; // Check every minute
const XP_PER_5_MINUTES = 5; // Base XP every 5 minutes
const GOLD_CHANCE_PER_5_MINUTES = 0.3; // 30% chance for gold
const MAX_GOLD_PER_REWARD = 3;

// Milestone thresholds (in minutes)
const MILESTONES = {
  pomodoro: 25,
  extended: 45,
  marathon: 60,
};

export interface StudyBuddyState {
  isActive: boolean;
  sessionStartTime: number;
  focusMinutes: number;
  lastActivityTime: number;
  pendingXP: number;
  pendingGold: number;
  currentState: BuddyState;
  equippedCat: CatColor;
}

export interface PendingRewards {
  xp: number;
  gold: number;
}

type StateChangeCallback = (state: BuddyState) => void;
type RewardCallback = (xp: number, gold: number) => void;
type MilestoneCallback = (minutes: number, milestone: string) => void;

class StudyBuddyManagerClass {
  private state: StudyBuddyState = {
    isActive: false,
    sessionStartTime: 0,
    focusMinutes: 0,
    lastActivityTime: 0,
    pendingXP: 0,
    pendingGold: 0,
    currentState: 'idle',
    equippedCat: 'brown',
  };

  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private canvas: StudyBuddyCanvas | null = null;

  // Callbacks
  private onStateChange: StateChangeCallback | null = null;
  private onReward: RewardCallback | null = null;
  private onMilestone: MilestoneCallback | null = null;

  /**
   * Initialize with a canvas and callbacks
   */
  initialize(
    canvas: StudyBuddyCanvas,
    callbacks?: {
      onStateChange?: StateChangeCallback;
      onReward?: RewardCallback;
      onMilestone?: MilestoneCallback;
    }
  ): void {
    this.canvas = canvas;

    if (callbacks) {
      this.onStateChange = callbacks.onStateChange ?? null;
      this.onReward = callbacks.onReward ?? null;
      this.onMilestone = callbacks.onMilestone ?? null;
    }

    // Load equipped cat from storage
    const savedCat = localStorage.getItem('studyquest-cat-color') as CatColor | null;
    if (savedCat) {
      this.state.equippedCat = savedCat;
      canvas.setCatColor(savedCat);
    }

    logger.info('StudyBuddyManager initialized');
  }

  /**
   * Start tracking activity
   */
  start(): void {
    if (this.state.isActive) return;

    this.state.isActive = true;
    this.state.sessionStartTime = Date.now();
    this.state.lastActivityTime = Date.now();
    this.state.focusMinutes = 0;

    // Start activity check interval
    this.checkInterval = setInterval(() => {
      this.tick();
    }, FOCUS_CHECK_INTERVAL_MS);

    // Update canvas state
    this.setCatState('watching');

    // Show session start message
    this.canvas?.showRandomMessage('sessionStart');

    // Record daily usage for unlock tracking
    PlayerStatsService.recordStudyBuddyUsage();

    logger.info('Study Buddy session started');
  }

  /**
   * Stop tracking activity
   */
  stop(): void {
    if (!this.state.isActive) return;

    this.state.isActive = false;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    logger.info('Study Buddy session stopped');
  }

  /**
   * Record user activity (typing, mouse movement, etc.)
   */
  recordActivity(): void {
    if (!this.state.isActive) return;

    const wasIdle = Date.now() - this.state.lastActivityTime > ACTIVITY_TIMEOUT_MS;
    this.state.lastActivityTime = Date.now();

    // If returning from idle, show message and change state
    if (wasIdle && this.state.currentState === 'sleeping') {
      this.setCatState('watching');
      this.canvas?.showRandomMessage('returnFromIdle');
    } else if (this.state.currentState !== 'celebrating') {
      this.setCatState('watching');
    }
  }

  /**
   * Set the equipped cat color
   */
  setCatColor(color: CatColor): void {
    this.state.equippedCat = color;
    this.canvas?.setCatColor(color);
    localStorage.setItem('studyquest-cat-color', color);
  }

  /**
   * Get pending rewards (XP and gold accumulated during session)
   */
  getPendingRewards(): PendingRewards {
    return {
      xp: this.state.pendingXP,
      gold: this.state.pendingGold,
    };
  }

  /**
   * Claim pending rewards (called when opening StudyQuest modal)
   */
  claimRewards(): PendingRewards {
    const rewards = this.getPendingRewards();

    if (rewards.xp > 0 || rewards.gold > 0) {
      this.state.pendingXP = 0;
      this.state.pendingGold = 0;
      logger.info(`Rewards claimed: ${rewards.xp} XP, ${rewards.gold} gold`);
    }

    return rewards;
  }

  /**
   * Get current state
   */
  getState(): StudyBuddyState {
    return { ...this.state };
  }

  /**
   * Get session duration in minutes
   */
  getSessionMinutes(): number {
    if (!this.state.isActive) return 0;
    return Math.floor((Date.now() - this.state.sessionStartTime) / 60000);
  }

  /**
   * Get focus minutes (active time only)
   */
  getFocusMinutes(): number {
    return this.state.focusMinutes;
  }

  /**
   * Trigger celebration (e.g., when StudyQuest battle is won)
   */
  celebrate(): void {
    this.canvas?.celebrate();
    this.setCatState('celebrating');

    setTimeout(() => {
      if (this.state.currentState === 'celebrating') {
        this.setCatState('idle');
      }
    }, 2000);
  }

  /**
   * Show break reminder
   */
  showBreakReminder(): void {
    this.canvas?.showRandomMessage('breakReminder');
    this.setCatState('restless');

    setTimeout(() => {
      if (this.state.currentState === 'restless') {
        this.setCatState('idle');
      }
    }, 3000);
  }

  /**
   * Check if buddy is currently active
   */
  isActive(): boolean {
    return this.state.isActive;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Called every minute to check activity and award rewards
   */
  private tick(): void {
    const now = Date.now();
    const timeSinceActivity = now - this.state.lastActivityTime;

    // Check if user is idle
    if (timeSinceActivity > ACTIVITY_TIMEOUT_MS) {
      // User is idle - cat falls asleep
      if (this.state.currentState !== 'sleeping') {
        this.setCatState('sleeping');
      }
      return;
    }

    // User was active - count as focus time
    this.state.focusMinutes++;

    // Award rewards every 5 minutes of focus
    if (this.state.focusMinutes % 5 === 0) {
      this.awardFocusReward();
    }

    // Check milestones
    this.checkMilestones();

    logger.info(`Focus tick: ${this.state.focusMinutes} minutes`);
  }

  /**
   * Award XP and potentially gold for focused study time
   */
  private awardFocusReward(): void {
    // Base XP
    const xp = XP_PER_5_MINUTES + Math.floor(Math.random() * 5); // 5-10 XP
    this.state.pendingXP += xp;

    // Chance for gold
    let gold = 0;
    if (Math.random() < GOLD_CHANCE_PER_5_MINUTES) {
      gold = 1 + Math.floor(Math.random() * MAX_GOLD_PER_REWARD); // 1-3 gold
      this.state.pendingGold += gold;
    }

    // Show reward animation
    if (gold > 0) {
      this.canvas?.showRandomMessage('foundXP');
    }

    // Notify callback
    if (this.onReward) {
      this.onReward(xp, gold);
    }

    logger.info(`Focus reward: +${xp} XP, +${gold} gold`);
  }

  /**
   * Check and trigger milestone celebrations
   */
  private checkMilestones(): void {
    const minutes = this.state.focusMinutes;

    if (minutes === MILESTONES.pomodoro) {
      this.celebrate();
      this.canvas?.showRandomMessage('milestone25');
      if (this.onMilestone) {
        this.onMilestone(minutes, 'pomodoro');
      }
    } else if (minutes === MILESTONES.extended) {
      this.celebrate();
      this.canvas?.showRandomMessage('milestone45');
      if (this.onMilestone) {
        this.onMilestone(minutes, 'extended');
      }
    } else if (minutes === MILESTONES.marathon) {
      this.celebrate();
      this.showBreakReminder();
      if (this.onMilestone) {
        this.onMilestone(minutes, 'marathon');
      }
    } else if (minutes === 15) {
      this.canvas?.showRandomMessage('milestone15');
    }
  }

  /**
   * Update cat state and notify
   */
  private setCatState(state: BuddyState): void {
    if (this.state.currentState === state) return;

    this.state.currentState = state;
    this.canvas?.setState(state);

    if (this.onStateChange) {
      this.onStateChange(state);
    }
  }
}

// Export singleton instance
export const StudyBuddyManager = new StudyBuddyManagerClass();
