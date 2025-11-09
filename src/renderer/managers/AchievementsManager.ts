/**
 * AchievementsManager
 *
 * Manages achievement badges and milestones for study activity.
 * Tracks and unlocks badges based on recording time, sessions, streaks, and more.
 */

import { createLogger } from '../../shared/logger.js';
import type { Session } from '../components/StudySessionList.js';

const logger = createLogger('AchievementsManager');

export type AchievementCategory = 'time' | 'sessions' | 'streaks' | 'goals' | 'marathon' | 'special';

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface Achievement {
  id: string;
  category: AchievementCategory;
  tier: AchievementTier;
  title: string;
  description: string;
  icon: string;
  requirement: number; // The threshold value
  unlocked: boolean;
  unlockedAt?: Date;
  progress: number; // Current progress toward requirement
}

export class AchievementsManager {
  private static readonly STORAGE_KEY = 'scribecat-achievements';
  private achievements: Achievement[] = [];

  constructor() {
    this.initializeAchievements();
    this.loadProgress();
    logger.info('AchievementsManager initialized');
  }

  /**
   * Initialize all achievement definitions
   */
  private initializeAchievements(): void {
    this.achievements = [
      // Recording Time Milestones
      { id: 'time-1h', category: 'time', tier: 'bronze', title: 'First Hour', description: 'Record for 1 hour total', icon: '⏱️', requirement: 60, unlocked: false, progress: 0 },
      { id: 'time-10h', category: 'time', tier: 'silver', title: 'Time Tracker', description: 'Record for 10 hours total', icon: '⏰', requirement: 600, unlocked: false, progress: 0 },
      { id: 'time-50h', category: 'time', tier: 'gold', title: 'Dedicated Learner', description: 'Record for 50 hours total', icon: '🕐', requirement: 3000, unlocked: false, progress: 0 },
      { id: 'time-100h', category: 'time', tier: 'platinum', title: 'Century Club', description: 'Record for 100 hours total', icon: '💯', requirement: 6000, unlocked: false, progress: 0 },
      { id: 'time-500h', category: 'time', tier: 'diamond', title: 'Master of Time', description: 'Record for 500 hours total', icon: '💎', requirement: 30000, unlocked: false, progress: 0 },

      // Session Count Milestones
      { id: 'sessions-10', category: 'sessions', tier: 'bronze', title: 'Getting Started', description: 'Complete 10 recording sessions', icon: '📚', requirement: 10, unlocked: false, progress: 0 },
      { id: 'sessions-50', category: 'sessions', tier: 'silver', title: 'Regular Recorder', description: 'Complete 50 recording sessions', icon: '📖', requirement: 50, unlocked: false, progress: 0 },
      { id: 'sessions-100', category: 'sessions', tier: 'gold', title: 'Centurion', description: 'Complete 100 recording sessions', icon: '🏆', requirement: 100, unlocked: false, progress: 0 },
      { id: 'sessions-500', category: 'sessions', tier: 'platinum', title: 'Session Master', description: 'Complete 500 recording sessions', icon: '⭐', requirement: 500, unlocked: false, progress: 0 },
      { id: 'sessions-1000', category: 'sessions', tier: 'diamond', title: 'Legendary', description: 'Complete 1000 recording sessions', icon: '🌟', requirement: 1000, unlocked: false, progress: 0 },

      // Streak Achievements
      { id: 'streak-3', category: 'streaks', tier: 'bronze', title: 'On a Roll', description: 'Maintain a 3-day recording streak', icon: '🔥', requirement: 3, unlocked: false, progress: 0 },
      { id: 'streak-7', category: 'streaks', tier: 'silver', title: 'Week Warrior', description: 'Maintain a 7-day recording streak', icon: '📅', requirement: 7, unlocked: false, progress: 0 },
      { id: 'streak-14', category: 'streaks', tier: 'gold', title: 'Fortnight Force', description: 'Maintain a 14-day recording streak', icon: '🌙', requirement: 14, unlocked: false, progress: 0 },
      { id: 'streak-30', category: 'streaks', tier: 'platinum', title: 'Monthly Master', description: 'Maintain a 30-day recording streak', icon: '🎯', requirement: 30, unlocked: false, progress: 0 },
      { id: 'streak-100', category: 'streaks', tier: 'diamond', title: 'Unstoppable', description: 'Maintain a 100-day recording streak', icon: '⚡', requirement: 100, unlocked: false, progress: 0 },

      // Marathon Sessions
      { id: 'marathon-30m', category: 'marathon', tier: 'bronze', title: 'Sprint Session', description: 'Record for 30 minutes in one session', icon: '🏃', requirement: 30, unlocked: false, progress: 0 },
      { id: 'marathon-1h', category: 'marathon', tier: 'silver', title: 'Hour Power', description: 'Record for 1 hour in one session', icon: '💪', requirement: 60, unlocked: false, progress: 0 },
      { id: 'marathon-2h', category: 'marathon', tier: 'gold', title: 'Double Down', description: 'Record for 2 hours in one session', icon: '🚀', requirement: 120, unlocked: false, progress: 0 },
      { id: 'marathon-4h', category: 'marathon', tier: 'platinum', title: 'Marathon Runner', description: 'Record for 4 hours in one session', icon: '🏅', requirement: 240, unlocked: false, progress: 0 },
      { id: 'marathon-6h', category: 'marathon', tier: 'diamond', title: 'Ultra Endurance', description: 'Record for 6 hours in one session', icon: '🦸', requirement: 360, unlocked: false, progress: 0 },

      // Special Achievements
      { id: 'first-session', category: 'special', tier: 'bronze', title: 'First Steps', description: 'Complete your first recording session', icon: '🌱', requirement: 1, unlocked: false, progress: 0 },
      { id: 'early-bird', category: 'special', tier: 'silver', title: 'Early Bird', description: 'Record before 6 AM', icon: '🌅', requirement: 1, unlocked: false, progress: 0 },
      { id: 'night-owl', category: 'special', tier: 'silver', title: 'Night Owl', description: 'Record after 10 PM', icon: '🦉', requirement: 1, unlocked: false, progress: 0 },
      { id: 'weekend-warrior', category: 'special', tier: 'gold', title: 'Weekend Warrior', description: 'Record on 10 different weekends', icon: '🌄', requirement: 10, unlocked: false, progress: 0 },
      { id: 'course-dedication', category: 'special', tier: 'gold', title: 'Course Dedication', description: 'Complete 20 sessions in one course', icon: '🎓', requirement: 20, unlocked: false, progress: 0 },
    ];
  }

  /**
   * Load achievement progress from localStorage
   */
  private loadProgress(): void {
    try {
      const stored = localStorage.getItem(AchievementsManager.STORAGE_KEY);
      if (stored) {
        const savedAchievements = JSON.parse(stored);

        // Merge saved progress with current definitions
        savedAchievements.forEach((saved: any) => {
          const achievement = this.achievements.find(a => a.id === saved.id);
          if (achievement) {
            achievement.unlocked = saved.unlocked;
            achievement.unlockedAt = saved.unlockedAt ? new Date(saved.unlockedAt) : undefined;
            achievement.progress = saved.progress || 0;
          }
        });

        logger.info(`Loaded progress for ${this.achievements.length} achievements`);
      }
    } catch (error) {
      logger.error('Failed to load achievement progress:', error);
    }
  }

  /**
   * Save achievement progress to localStorage
   */
  private saveProgress(): void {
    try {
      localStorage.setItem(AchievementsManager.STORAGE_KEY, JSON.stringify(this.achievements));
      logger.info('Achievement progress saved');
    } catch (error) {
      logger.error('Failed to save achievement progress:', error);
    }
  }

  /**
   * Update achievement progress based on sessions
   */
  updateProgress(sessions: Session[], currentStreak: number, longestStreak: number): Achievement[] {
    const newlyUnlocked: Achievement[] = [];

    // Calculate stats
    const totalMinutes = sessions.reduce((sum, s) => sum + Math.floor(s.duration / 60), 0);
    const totalSessions = sessions.length;
    const longestSessionMinutes = sessions.length > 0
      ? Math.max(...sessions.map(s => Math.floor(s.duration / 60)))
      : 0;

    // Time achievements
    this.updateAchievement('time-1h', totalMinutes, newlyUnlocked);
    this.updateAchievement('time-10h', totalMinutes, newlyUnlocked);
    this.updateAchievement('time-50h', totalMinutes, newlyUnlocked);
    this.updateAchievement('time-100h', totalMinutes, newlyUnlocked);
    this.updateAchievement('time-500h', totalMinutes, newlyUnlocked);

    // Session count achievements
    this.updateAchievement('sessions-10', totalSessions, newlyUnlocked);
    this.updateAchievement('sessions-50', totalSessions, newlyUnlocked);
    this.updateAchievement('sessions-100', totalSessions, newlyUnlocked);
    this.updateAchievement('sessions-500', totalSessions, newlyUnlocked);
    this.updateAchievement('sessions-1000', totalSessions, newlyUnlocked);

    // Streak achievements (use longest streak ever achieved)
    this.updateAchievement('streak-3', longestStreak, newlyUnlocked);
    this.updateAchievement('streak-7', longestStreak, newlyUnlocked);
    this.updateAchievement('streak-14', longestStreak, newlyUnlocked);
    this.updateAchievement('streak-30', longestStreak, newlyUnlocked);
    this.updateAchievement('streak-100', longestStreak, newlyUnlocked);

    // Marathon achievements
    this.updateAchievement('marathon-30m', longestSessionMinutes, newlyUnlocked);
    this.updateAchievement('marathon-1h', longestSessionMinutes, newlyUnlocked);
    this.updateAchievement('marathon-2h', longestSessionMinutes, newlyUnlocked);
    this.updateAchievement('marathon-4h', longestSessionMinutes, newlyUnlocked);
    this.updateAchievement('marathon-6h', longestSessionMinutes, newlyUnlocked);

    // Special achievements
    this.updateAchievement('first-session', totalSessions, newlyUnlocked);

    // Early bird (before 6 AM)
    const earlyBirdCount = sessions.filter(s => {
      const hour = new Date(s.createdAt).getHours();
      return hour >= 0 && hour < 6;
    }).length;
    this.updateAchievement('early-bird', earlyBirdCount, newlyUnlocked);

    // Night owl (after 10 PM)
    const nightOwlCount = sessions.filter(s => {
      const hour = new Date(s.createdAt).getHours();
      return hour >= 22 || hour < 2;
    }).length;
    this.updateAchievement('night-owl', nightOwlCount, newlyUnlocked);

    // Weekend warrior (unique weekends)
    const weekends = new Set<string>();
    sessions.forEach(s => {
      const date = new Date(s.createdAt);
      const day = date.getDay();
      if (day === 0 || day === 6) { // Sunday or Saturday
        const weekKey = `${date.getFullYear()}-W${Math.floor(date.getDate() / 7)}`;
        weekends.add(weekKey);
      }
    });
    this.updateAchievement('weekend-warrior', weekends.size, newlyUnlocked);

    // Course dedication (most sessions in one course)
    const courseCounts = new Map<string, number>();
    sessions.forEach(s => {
      const course = s.courseTitle || 'Uncategorized';
      courseCounts.set(course, (courseCounts.get(course) || 0) + 1);
    });
    const maxCourseSessions = courseCounts.size > 0 ? Math.max(...courseCounts.values()) : 0;
    this.updateAchievement('course-dedication', maxCourseSessions, newlyUnlocked);

    // Save progress
    this.saveProgress();

    return newlyUnlocked;
  }

  /**
   * Update individual achievement
   */
  private updateAchievement(id: string, progress: number, newlyUnlocked: Achievement[]): void {
    const achievement = this.achievements.find(a => a.id === id);
    if (!achievement) return;

    achievement.progress = progress;

    if (!achievement.unlocked && progress >= achievement.requirement) {
      achievement.unlocked = true;
      achievement.unlockedAt = new Date();
      newlyUnlocked.push(achievement);
      logger.info(`Achievement unlocked: ${achievement.title}`);
    }
  }

  /**
   * Get all achievements
   */
  getAllAchievements(): Achievement[] {
    return this.achievements;
  }

  /**
   * Get unlocked achievements
   */
  getUnlockedAchievements(): Achievement[] {
    return this.achievements.filter(a => a.unlocked);
  }

  /**
   * Get locked achievements
   */
  getLockedAchievements(): Achievement[] {
    return this.achievements.filter(a => !a.unlocked);
  }

  /**
   * Get achievements by category
   */
  getAchievementsByCategory(category: AchievementCategory): Achievement[] {
    return this.achievements.filter(a => a.category === category);
  }

  /**
   * Get achievement completion percentage
   */
  getCompletionPercentage(): number {
    const unlocked = this.getUnlockedAchievements().length;
    const total = this.achievements.length;
    return total > 0 ? Math.round((unlocked / total) * 100) : 0;
  }

  /**
   * Get next achievements to unlock (closest to completion)
   */
  getNextAchievements(limit: number = 3): Achievement[] {
    return this.getLockedAchievements()
      .filter(a => a.progress > 0) // Has some progress
      .sort((a, b) => {
        const aPercent = (a.progress / a.requirement) * 100;
        const bPercent = (b.progress / b.requirement) * 100;
        return bPercent - aPercent; // Highest progress first
      })
      .slice(0, limit);
  }

  /**
   * Get tier color for styling
   */
  getTierColor(tier: AchievementTier): string {
    switch (tier) {
      case 'bronze': return '#cd7f32';
      case 'silver': return '#c0c0c0';
      case 'gold': return '#ffd700';
      case 'platinum': return '#e5e4e2';
      case 'diamond': return '#b9f2ff';
      default: return '#888';
    }
  }

  /**
   * Get tier display name
   */
  getTierName(tier: AchievementTier): string {
    return tier.charAt(0).toUpperCase() + tier.slice(1);
  }

  /**
   * Get category display name
   */
  getCategoryName(category: AchievementCategory): string {
    switch (category) {
      case 'time': return 'Recording Time';
      case 'sessions': return 'Session Count';
      case 'streaks': return 'Consistency';
      case 'goals': return 'Goal Completion';
      case 'marathon': return 'Marathon Sessions';
      case 'special': return 'Special';
      default: return 'Achievement';
    }
  }

  /**
   * Format progress display
   */
  formatProgress(achievement: Achievement): string {
    if (achievement.unlocked) {
      return 'Unlocked!';
    }

    const percent = Math.min((achievement.progress / achievement.requirement) * 100, 100);
    return `${Math.round(percent)}% (${achievement.progress}/${achievement.requirement})`;
  }
}
