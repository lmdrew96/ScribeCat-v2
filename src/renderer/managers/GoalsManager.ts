/**
 * GoalsManager
 *
 * Manages study goals and tracks progress toward recording time targets.
 * Supports daily and weekly goals with localStorage persistence.
 */

import { createLogger } from '../../shared/logger.js';
import type { Session } from '../components/StudySessionList.js';

const logger = createLogger('GoalsManager');

export type GoalType = 'daily' | 'weekly';

export interface StudyGoal {
  id: string;
  type: GoalType;
  targetMinutes: number;
  createdAt: Date;
  isActive: boolean;
}

export interface GoalProgress {
  goal: StudyGoal;
  currentMinutes: number;
  targetMinutes: number;
  percentComplete: number;
  isComplete: boolean;
  daysRemaining?: number; // For weekly goals
}

export class GoalsManager {
  private static readonly STORAGE_KEY = 'scribecat-study-goals';
  private goals: StudyGoal[] = [];

  constructor() {
    this.loadGoals();
    logger.info('GoalsManager initialized');
  }

  /**
   * Load goals from localStorage
   */
  private loadGoals(): void {
    try {
      const stored = localStorage.getItem(GoalsManager.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert date strings back to Date objects
        this.goals = parsed.map((goal: any) => ({
          ...goal,
          createdAt: new Date(goal.createdAt),
        }));
        logger.info(`Loaded ${this.goals.length} goals from storage`);
      }
    } catch (error) {
      logger.error('Failed to load goals from storage:', error);
      this.goals = [];
    }
  }

  /**
   * Save goals to localStorage
   */
  private saveGoals(): void {
    try {
      localStorage.setItem(GoalsManager.STORAGE_KEY, JSON.stringify(this.goals));
      logger.info(`Saved ${this.goals.length} goals to storage`);
    } catch (error) {
      logger.error('Failed to save goals to storage:', error);
    }
  }

  /**
   * Create a new study goal
   */
  createGoal(type: GoalType, targetMinutes: number): StudyGoal {
    // Deactivate any existing goals of the same type
    this.goals.forEach(goal => {
      if (goal.type === type && goal.isActive) {
        goal.isActive = false;
      }
    });

    const newGoal: StudyGoal = {
      id: crypto.randomUUID(),
      type,
      targetMinutes,
      createdAt: new Date(),
      isActive: true,
    };

    this.goals.push(newGoal);
    this.saveGoals();
    logger.info(`Created ${type} goal: ${targetMinutes} minutes`);

    return newGoal;
  }

  /**
   * Update an existing goal
   */
  updateGoal(id: string, targetMinutes: number): StudyGoal | null {
    const goal = this.goals.find(g => g.id === id);
    if (!goal) {
      logger.warn(`Goal not found: ${id}`);
      return null;
    }

    goal.targetMinutes = targetMinutes;
    this.saveGoals();
    logger.info(`Updated goal ${id}: ${targetMinutes} minutes`);

    return goal;
  }

  /**
   * Delete a goal
   */
  deleteGoal(id: string): boolean {
    const index = this.goals.findIndex(g => g.id === id);
    if (index === -1) {
      logger.warn(`Goal not found: ${id}`);
      return false;
    }

    this.goals.splice(index, 1);
    this.saveGoals();
    logger.info(`Deleted goal ${id}`);

    return true;
  }

  /**
   * Get active goal by type
   */
  getActiveGoal(type: GoalType): StudyGoal | null {
    return this.goals.find(g => g.type === type && g.isActive) || null;
  }

  /**
   * Get all active goals
   */
  getActiveGoals(): StudyGoal[] {
    return this.goals.filter(g => g.isActive);
  }

  /**
   * Get all goals (active and inactive)
   */
  getAllGoals(): StudyGoal[] {
    return this.goals;
  }

  /**
   * Calculate progress for a goal based on sessions
   */
  calculateProgress(goal: StudyGoal, sessions: Session[]): GoalProgress {
    const now = new Date();
    const currentMinutes = this.calculateRecordingMinutes(goal.type, sessions, now);
    const percentComplete = Math.min((currentMinutes / goal.targetMinutes) * 100, 100);
    const isComplete = currentMinutes >= goal.targetMinutes;

    const progress: GoalProgress = {
      goal,
      currentMinutes,
      targetMinutes: goal.targetMinutes,
      percentComplete,
      isComplete,
    };

    // Calculate days remaining for weekly goals
    if (goal.type === 'weekly') {
      const weekStart = this.getWeekStart(now);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const daysRemaining = Math.ceil((weekEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      progress.daysRemaining = daysRemaining;
    }

    return progress;
  }

  /**
   * Calculate recording minutes for a time period
   */
  private calculateRecordingMinutes(type: GoalType, sessions: Session[], now: Date): number {
    const filtered = this.filterSessionsByPeriod(type, sessions, now);
    return filtered.reduce((sum, session) => {
      return sum + Math.floor(session.duration / 60); // Convert seconds to minutes
    }, 0);
  }

  /**
   * Filter sessions by time period (daily or weekly)
   */
  private filterSessionsByPeriod(type: GoalType, sessions: Session[], now: Date): Session[] {
    if (type === 'daily') {
      return this.filterDailySessions(sessions, now);
    } else {
      return this.filterWeeklySessions(sessions, now);
    }
  }

  /**
   * Filter sessions from today
   */
  private filterDailySessions(sessions: Session[], now: Date): Session[] {
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    return sessions.filter(session => {
      const sessionDate = new Date(session.createdAt);
      return sessionDate >= todayStart && sessionDate < todayEnd;
    });
  }

  /**
   * Filter sessions from current week (Monday - Sunday)
   */
  private filterWeeklySessions(sessions: Session[], now: Date): Session[] {
    const weekStart = this.getWeekStart(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    return sessions.filter(session => {
      const sessionDate = new Date(session.createdAt);
      return sessionDate >= weekStart && sessionDate < weekEnd;
    });
  }

  /**
   * Get start of current week (Monday at 00:00:00)
   */
  private getWeekStart(date: Date): Date {
    const weekStart = new Date(date);
    weekStart.setHours(0, 0, 0, 0);

    const day = weekStart.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Monday is 1, Sunday is 0
    weekStart.setDate(weekStart.getDate() + diff);

    return weekStart;
  }

  /**
   * Get motivational message based on progress
   */
  getMotivationalMessage(progress: GoalProgress): string {
    const percent = progress.percentComplete;
    const type = progress.goal.type;

    if (progress.isComplete) {
      return type === 'daily'
        ? "🎉 Daily goal complete! You're crushing it today!"
        : "🏆 Weekly goal complete! Amazing work this week!";
    }

    if (percent >= 75) {
      return "🔥 Almost there! You've got this!";
    }

    if (percent >= 50) {
      return "💪 Halfway there! Keep up the great work!";
    }

    if (percent >= 25) {
      return "🚀 Good progress! Stay focused!";
    }

    if (percent > 0) {
      return "✨ Great start! Every minute counts!";
    }

    return type === 'daily'
      ? "📚 Ready to start today's recording session?"
      : "🎯 Let's make progress on this week's goal!";
  }

  /**
   * Check if user is on track for weekly goal
   */
  isOnTrackForWeeklyGoal(progress: GoalProgress): boolean {
    if (progress.goal.type !== 'weekly') {
      return false;
    }

    const now = new Date();
    const weekStart = this.getWeekStart(now);
    const dayOfWeek = Math.floor((now.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));

    // Expected progress by this day (assuming even distribution)
    const expectedPercent = ((dayOfWeek + 1) / 7) * 100;

    return progress.percentComplete >= expectedPercent;
  }

  /**
   * Get formatted time remaining for a goal
   */
  getTimeRemaining(progress: GoalProgress): string {
    const remaining = progress.targetMinutes - progress.currentMinutes;

    if (remaining <= 0) {
      return 'Goal complete!';
    }

    const hours = Math.floor(remaining / 60);
    const minutes = remaining % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }

    return `${minutes}m remaining`;
  }

  /**
   * Format minutes as human-readable time
   */
  formatMinutes(minutes: number): string {
    if (minutes < 60) {
      return `${minutes}m`;
    }

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (mins === 0) {
      return `${hours}h`;
    }

    return `${hours}h ${mins}m`;
  }
}
