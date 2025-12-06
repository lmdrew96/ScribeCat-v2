/**
 * StudyQuestIntegration
 *
 * Tracks study activity and awards StudyQuest rewards.
 * This service acts as a bridge between study-related managers
 * (RecordingManager, AIManager, StudyModeManager) and the StudyQuestManager.
 *
 * Usage:
 * - Call startSession() when a study session begins
 * - Call recordAIToolUse() when AI tools are used (summary, flashcards, etc.)
 * - Call recordAIChatMessage() when user sends a chat message
 * - Call endSession() when session ends to award accumulated rewards
 */

import { createLogger } from '../../shared/logger.js';
import type { StudyQuestManager } from './StudyQuestManager.js';

const logger = createLogger('StudyQuestIntegration');

export class StudyQuestIntegration {
  private studyQuestManager: StudyQuestManager | null = null;
  private sessionStartTime: number | null = null;
  private aiToolsUsed = 0;
  private aiChatsUsed = 0;
  private isTracking = false;

  /**
   * Set the StudyQuestManager reference
   */
  setManager(manager: StudyQuestManager): void {
    this.studyQuestManager = manager;
    logger.info('StudyQuestManager connected');
  }

  /**
   * Check if integration is ready (manager set and user has character)
   */
  isReady(): boolean {
    return this.studyQuestManager !== null && this.studyQuestManager.hasCharacter();
  }

  /**
   * Start tracking a study session
   */
  startSession(): void {
    if (!this.isReady()) {
      logger.debug('Cannot start session: not ready');
      return;
    }

    if (this.isTracking) {
      logger.debug('Session already being tracked');
      return;
    }

    this.sessionStartTime = Date.now();
    this.aiToolsUsed = 0;
    this.aiChatsUsed = 0;
    this.isTracking = true;

    logger.info('Study session tracking started');
  }

  /**
   * Record usage of an AI tool (summary, flashcards, quiz, etc.)
   */
  recordAIToolUse(): void {
    if (!this.isReady()) return;

    this.aiToolsUsed++;
    logger.debug(`AI tool used (total: ${this.aiToolsUsed})`);

    // Award immediate small reward for AI tool usage
    this.awardImmediateReward('ai_tool');
  }

  /**
   * Record an AI chat message
   */
  recordAIChatMessage(): void {
    if (!this.isReady()) return;

    this.aiChatsUsed++;
    logger.debug(`AI chat message (total: ${this.aiChatsUsed})`);

    // Award immediate small reward for chat
    this.awardImmediateReward('ai_chat');
  }

  /**
   * End the current study session and award accumulated rewards
   */
  async endSession(sessionCompleted: boolean = true): Promise<void> {
    if (!this.isReady() || !this.isTracking) {
      logger.debug('Cannot end session: not tracking');
      return;
    }

    const endTime = Date.now();
    const durationMs = this.sessionStartTime ? endTime - this.sessionStartTime : 0;
    const durationMinutes = Math.floor(durationMs / 60000);

    // Only award if at least 1 minute of study time
    if (durationMinutes >= 1 || this.aiToolsUsed > 0 || this.aiChatsUsed > 0) {
      try {
        const result = await this.studyQuestManager!.awardStudyRewards({
          studyTimeMinutes: durationMinutes,
          aiToolsUsed: this.aiToolsUsed,
          aiChatsUsed: this.aiChatsUsed,
          sessionCompleted,
        });

        if (result) {
          logger.info(
            `Session rewards: +${result.xpEarned} XP, +${result.goldEarned} Gold` +
              (result.leveledUp ? ` (Level Up to ${result.newLevel}!)` : '')
          );
        }
      } catch (error) {
        logger.error('Failed to award session rewards:', error);
      }
    }

    // Reset tracking state
    this.resetTracking();
  }

  /**
   * Cancel current tracking without awarding rewards
   */
  cancelSession(): void {
    if (this.isTracking) {
      logger.info('Study session tracking cancelled');
      this.resetTracking();
    }
  }

  /**
   * Get current session stats (for debugging/display)
   */
  getSessionStats(): {
    isTracking: boolean;
    durationMinutes: number;
    aiToolsUsed: number;
    aiChatsUsed: number;
  } {
    const durationMs = this.sessionStartTime ? Date.now() - this.sessionStartTime : 0;

    return {
      isTracking: this.isTracking,
      durationMinutes: Math.floor(durationMs / 60000),
      aiToolsUsed: this.aiToolsUsed,
      aiChatsUsed: this.aiChatsUsed,
    };
  }

  /**
   * Award small immediate rewards for individual actions
   * This provides instant feedback while the larger session rewards
   * are awarded at the end.
   */
  private async awardImmediateReward(type: 'ai_tool' | 'ai_chat'): Promise<void> {
    if (!this.studyQuestManager) return;

    // Small immediate rewards (main rewards come at session end)
    // These are intentionally small to not spam notifications
    // The full calculation happens in awardStudyRewards
    try {
      // We don't actually award here - the tracking is enough
      // Rewards are consolidated at session end to avoid notification spam
      // But we could add micro-rewards here if desired
    } catch (error) {
      logger.error('Failed to award immediate reward:', error);
    }
  }

  /**
   * Reset all tracking state
   */
  private resetTracking(): void {
    this.sessionStartTime = null;
    this.aiToolsUsed = 0;
    this.aiChatsUsed = 0;
    this.isTracking = false;
  }

  /**
   * Cleanup on logout
   */
  cleanup(): void {
    this.resetTracking();
    logger.info('StudyQuestIntegration cleaned up');
  }
}

// Export singleton instance for easy access
export const studyQuestIntegration = new StudyQuestIntegration();
