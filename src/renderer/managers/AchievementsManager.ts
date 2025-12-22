/**
 * AchievementsManager
 *
 * Manages achievement badges and milestones for study activity.
 * Tracks and unlocks badges based on study time, sessions, streaks, and more.
 */

import { createLogger } from '../../shared/logger.js';
import type { Session } from '../components/StudySessionList.js';
import { getIconHTML, type IconKey } from '../utils/iconMap.js';

const logger = createLogger('AchievementsManager');

export type AchievementCategory = 'time' | 'sessions' | 'streaks' | 'goals' | 'marathon' | 'special' | 'studyquest';

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface Achievement {
  id: string;
  category: AchievementCategory;
  tier: AchievementTier;
  title: string;
  description: string;
  icon: IconKey; // Lucide icon key from iconMap
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
      // Study Time Milestones
      { id: 'time-1h', category: 'time', tier: 'bronze', title: 'First Hour', description: 'Study for 1 hour total', icon: 'timer', requirement: 60, unlocked: false, progress: 0 },
      { id: 'time-10h', category: 'time', tier: 'silver', title: 'Time Tracker', description: 'Study for 10 hours total', icon: 'clock', requirement: 600, unlocked: false, progress: 0 },
      { id: 'time-50h', category: 'time', tier: 'gold', title: 'Dedicated Learner', description: 'Study for 50 hours total', icon: 'clockHour', requirement: 3000, unlocked: false, progress: 0 },
      { id: 'time-100h', category: 'time', tier: 'platinum', title: 'Century Club', description: 'Study for 100 hours total', icon: 'award', requirement: 6000, unlocked: false, progress: 0 },
      { id: 'time-500h', category: 'time', tier: 'diamond', title: 'Master of Time', description: 'Study for 500 hours total', icon: 'gem', requirement: 30000, unlocked: false, progress: 0 },

      // Session Count Milestones
      { id: 'sessions-10', category: 'sessions', tier: 'bronze', title: 'Getting Started', description: 'Complete 10 recording sessions', icon: 'book', requirement: 10, unlocked: false, progress: 0 },
      { id: 'sessions-50', category: 'sessions', tier: 'silver', title: 'Regular Recorder', description: 'Complete 50 recording sessions', icon: 'bookMarked', requirement: 50, unlocked: false, progress: 0 },
      { id: 'sessions-100', category: 'sessions', tier: 'gold', title: 'Centurion', description: 'Complete 100 recording sessions', icon: 'trophy', requirement: 100, unlocked: false, progress: 0 },
      { id: 'sessions-500', category: 'sessions', tier: 'platinum', title: 'Session Master', description: 'Complete 500 recording sessions', icon: 'star', requirement: 500, unlocked: false, progress: 0 },
      { id: 'sessions-1000', category: 'sessions', tier: 'diamond', title: 'Legendary', description: 'Complete 1000 recording sessions', icon: 'sparkles', requirement: 1000, unlocked: false, progress: 0 },

      // Streak Achievements
      { id: 'streak-3', category: 'streaks', tier: 'bronze', title: 'On a Roll', description: 'Maintain a 3-day recording streak', icon: 'flame', requirement: 3, unlocked: false, progress: 0 },
      { id: 'streak-7', category: 'streaks', tier: 'silver', title: 'Week Warrior', description: 'Maintain a 7-day recording streak', icon: 'calendar', requirement: 7, unlocked: false, progress: 0 },
      { id: 'streak-14', category: 'streaks', tier: 'gold', title: 'Fortnight Force', description: 'Maintain a 14-day recording streak', icon: 'moon', requirement: 14, unlocked: false, progress: 0 },
      { id: 'streak-30', category: 'streaks', tier: 'platinum', title: 'Monthly Master', description: 'Maintain a 30-day recording streak', icon: 'target', requirement: 30, unlocked: false, progress: 0 },
      { id: 'streak-100', category: 'streaks', tier: 'diamond', title: 'Unstoppable', description: 'Maintain a 100-day recording streak', icon: 'zap', requirement: 100, unlocked: false, progress: 0 },

      // Marathon Sessions (based on study mode time: playback + AI tools + chat)
      { id: 'marathon-15m', category: 'marathon', tier: 'bronze', title: 'Quick Study', description: 'Study for 15 minutes in one session', icon: 'timer', requirement: 15, unlocked: false, progress: 0 },
      { id: 'marathon-30m', category: 'marathon', tier: 'silver', title: 'Half Hour Hero', description: 'Study for 30 minutes in one session', icon: 'dumbbell', requirement: 30, unlocked: false, progress: 0 },
      { id: 'marathon-1h', category: 'marathon', tier: 'gold', title: 'Hour Power', description: 'Study for 1 hour in one session', icon: 'rocket', requirement: 60, unlocked: false, progress: 0 },
      { id: 'marathon-2h', category: 'marathon', tier: 'platinum', title: 'Double Down', description: 'Study for 2 hours in one session', icon: 'medal', requirement: 120, unlocked: false, progress: 0 },
      { id: 'marathon-3h', category: 'marathon', tier: 'diamond', title: 'Marathon Master', description: 'Study for 3 hours in one session', icon: 'crown', requirement: 180, unlocked: false, progress: 0 },

      // Special Achievements
      { id: 'first-session', category: 'special', tier: 'bronze', title: 'First Steps', description: 'Complete your first recording session', icon: 'sprout', requirement: 1, unlocked: false, progress: 0 },
      { id: 'early-bird', category: 'special', tier: 'silver', title: 'Early Bird', description: 'Record before 6 AM', icon: 'sunrise', requirement: 1, unlocked: false, progress: 0 },
      { id: 'night-owl', category: 'special', tier: 'silver', title: 'Night Owl', description: 'Record after 10 PM', icon: 'moon', requirement: 1, unlocked: false, progress: 0 },
      { id: 'weekend-warrior', category: 'special', tier: 'gold', title: 'Weekend Warrior', description: 'Use study mode on 10 different weekends', icon: 'mountain', requirement: 10, unlocked: false, progress: 0 },
      { id: 'course-dedication', category: 'special', tier: 'gold', title: 'Course Dedication', description: 'Complete 20 sessions in one course', icon: 'graduation', requirement: 20, unlocked: false, progress: 0 },

      // StudyQuest Achievements
      { id: 'sq-first-steps', category: 'studyquest', tier: 'bronze', title: 'Adventurer', description: 'Create your first StudyQuest character', icon: 'swords', requirement: 1, unlocked: false, progress: 0 },
      { id: 'sq-level-10', category: 'studyquest', tier: 'bronze', title: 'Apprentice', description: 'Reach level 10 in StudyQuest', icon: 'arrowUp', requirement: 10, unlocked: false, progress: 0 },
      { id: 'sq-level-25', category: 'studyquest', tier: 'silver', title: 'Journeyman', description: 'Reach level 25 in StudyQuest', icon: 'swords', requirement: 25, unlocked: false, progress: 0 },
      { id: 'sq-level-50', category: 'studyquest', tier: 'gold', title: 'Champion', description: 'Reach level 50 in StudyQuest', icon: 'trophy', requirement: 50, unlocked: false, progress: 0 },
      { id: 'sq-battles-10', category: 'studyquest', tier: 'bronze', title: 'Battle Ready', description: 'Win 10 battles in StudyQuest', icon: 'swords', requirement: 10, unlocked: false, progress: 0 },
      { id: 'sq-battles-50', category: 'studyquest', tier: 'silver', title: 'Warrior', description: 'Win 50 battles in StudyQuest', icon: 'shield', requirement: 50, unlocked: false, progress: 0 },
      { id: 'sq-battles-100', category: 'studyquest', tier: 'gold', title: 'Battle Master', description: 'Win 100 battles in StudyQuest', icon: 'dumbbell', requirement: 100, unlocked: false, progress: 0 },
      { id: 'sq-dungeons-5', category: 'studyquest', tier: 'bronze', title: 'Dungeon Crawler', description: 'Complete 5 dungeon runs in StudyQuest', icon: 'castle', requirement: 5, unlocked: false, progress: 0 },
      { id: 'sq-dungeons-25', category: 'studyquest', tier: 'silver', title: 'Dungeon Delver', description: 'Complete 25 dungeon runs in StudyQuest', icon: 'flame', requirement: 25, unlocked: false, progress: 0 },
      { id: 'sq-quests-10', category: 'studyquest', tier: 'bronze', title: 'Quest Seeker', description: 'Complete 10 quests in StudyQuest', icon: 'scroll', requirement: 10, unlocked: false, progress: 0 },
      { id: 'sq-quests-50', category: 'studyquest', tier: 'silver', title: 'Quest Champion', description: 'Complete 50 quests in StudyQuest', icon: 'sparkles', requirement: 50, unlocked: false, progress: 0 },
      { id: 'sq-gold-1000', category: 'studyquest', tier: 'silver', title: 'Treasure Hunter', description: 'Accumulate 1000 gold in StudyQuest', icon: 'coins', requirement: 1000, unlocked: false, progress: 0 },
      { id: 'sq-gold-10000', category: 'studyquest', tier: 'gold', title: 'Rich Cat', description: 'Accumulate 10000 gold in StudyQuest', icon: 'gem', requirement: 10000, unlocked: false, progress: 0 },
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
    // Time achievements now use study mode time instead of recording duration
    const totalMinutes = sessions.reduce((sum, s) => sum + Math.floor((s.studyModeTime || 0) / 60), 0);
    const totalSessions = sessions.length;
    // Marathon achievements also use study mode time
    const longestStudyMinutes = sessions.length > 0
      ? Math.max(...sessions.map(s => Math.floor((s.studyModeTime || 0) / 60)))
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

    // Marathon achievements (based on study mode time)
    this.updateAchievement('marathon-15m', longestStudyMinutes, newlyUnlocked);
    this.updateAchievement('marathon-30m', longestStudyMinutes, newlyUnlocked);
    this.updateAchievement('marathon-1h', longestStudyMinutes, newlyUnlocked);
    this.updateAchievement('marathon-2h', longestStudyMinutes, newlyUnlocked);
    this.updateAchievement('marathon-3h', longestStudyMinutes, newlyUnlocked);

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

    // Weekend warrior (unique weekends with study mode activity)
    const weekends = new Set<string>();
    sessions.forEach(s => {
      // Check if session has any study mode activity
      const hasStudyActivity = (s.studyModeTime || 0) > 0 ||
                                (s.aiToolUsageCount || 0) > 0 ||
                                (s.aiChatMessageCount || 0) > 0;

      if (!hasStudyActivity) return;

      // Use last study mode activity date if available, otherwise use creation date
      const date = s.lastStudyModeActivity ? new Date(s.lastStudyModeActivity) : new Date(s.createdAt);
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
      case 'studyquest': return 'StudyQuest';
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

  /**
   * Update StudyQuest-specific achievements
   * Called from StudyQuestManager when relevant events occur
   */
  updateStudyQuestProgress(stats: {
    hasCharacter?: boolean;
    level?: number;
    battlesWon?: number;
    dungeonsCompleted?: number;
    questsCompleted?: number;
    totalGold?: number;
  }): Achievement[] {
    const newlyUnlocked: Achievement[] = [];

    // Character creation
    if (stats.hasCharacter) {
      this.updateAchievement('sq-first-steps', 1, newlyUnlocked);
    }

    // Level milestones
    if (stats.level !== undefined) {
      this.updateAchievement('sq-level-10', stats.level, newlyUnlocked);
      this.updateAchievement('sq-level-25', stats.level, newlyUnlocked);
      this.updateAchievement('sq-level-50', stats.level, newlyUnlocked);
    }

    // Battle achievements
    if (stats.battlesWon !== undefined) {
      this.updateAchievement('sq-battles-10', stats.battlesWon, newlyUnlocked);
      this.updateAchievement('sq-battles-50', stats.battlesWon, newlyUnlocked);
      this.updateAchievement('sq-battles-100', stats.battlesWon, newlyUnlocked);
    }

    // Dungeon achievements
    if (stats.dungeonsCompleted !== undefined) {
      this.updateAchievement('sq-dungeons-5', stats.dungeonsCompleted, newlyUnlocked);
      this.updateAchievement('sq-dungeons-25', stats.dungeonsCompleted, newlyUnlocked);
    }

    // Quest achievements
    if (stats.questsCompleted !== undefined) {
      this.updateAchievement('sq-quests-10', stats.questsCompleted, newlyUnlocked);
      this.updateAchievement('sq-quests-50', stats.questsCompleted, newlyUnlocked);
    }

    // Gold achievements
    if (stats.totalGold !== undefined) {
      this.updateAchievement('sq-gold-1000', stats.totalGold, newlyUnlocked);
      this.updateAchievement('sq-gold-10000', stats.totalGold, newlyUnlocked);
    }

    // Save progress
    if (newlyUnlocked.length > 0) {
      this.saveProgress();
    }

    return newlyUnlocked;
  }
}
