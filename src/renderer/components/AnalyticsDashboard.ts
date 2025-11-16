/**
 * AnalyticsDashboard Component
 *
 * Displays study analytics and insights:
 * - Total study time and sessions
 * - Course breakdown
 * - Study streaks and patterns
 * - AI tool usage stats
 */

import type { Session } from '../../domain/entities/Session.js';
import { createLogger } from '../../shared/logger.js';
import { GoalsManager, type GoalProgress } from '../managers/GoalsManager.js';
import { AchievementsManager, type Achievement } from '../managers/AchievementsManager.js';
import { escapeHtml } from '../utils/formatting.js';

const logger = createLogger('AnalyticsDashboard');

export interface StudyStats {
  totalStudyTime: number; // Total minutes
  totalSessions: number;
  averageDuration: number; // Minutes
  coursesBreakdown: Map<string, { count: number; totalTime: number }>;
  currentStreak: number; // Days
  longestStreak: number; // Days
  studyDates: Date[]; // All unique study dates
}

export class AnalyticsDashboard {
  private sessions: Session[] = [];
  private stats: StudyStats | null = null;
  private goalsManager: GoalsManager;
  private achievementsManager: AchievementsManager;

  constructor() {
    this.goalsManager = new GoalsManager();
    this.achievementsManager = new AchievementsManager();
  }

  /**
   * Update sessions and recalculate stats
   */
  updateSessions(sessions: Session[]): void {
    this.sessions = sessions;
    this.stats = this.calculateStats(sessions);

    // Update achievements progress
    if (this.stats) {
      const newlyUnlocked = this.achievementsManager.updateProgress(
        sessions,
        this.stats.currentStreak,
        this.stats.longestStreak
      );

      // Show notification for newly unlocked achievements
      if (newlyUnlocked.length > 0) {
        const notificationTicker = (window as any).notificationTicker;
        if (notificationTicker) {
          newlyUnlocked.forEach(achievement => {
            notificationTicker.success(`🏆 Achievement Unlocked: ${achievement.title}`, 5000);
          });
        }
      }
    }

    logger.info('Analytics updated', { sessionCount: sessions.length });
  }

  /**
   * Calculate all statistics from sessions
   */
  private calculateStats(sessions: Session[]): StudyStats {
    // Total study time (convert seconds to minutes) - uses studyModeTime instead of recording duration
    const totalStudyTime = Math.floor(
      sessions.reduce((sum, s) => sum + (s.studyModeTime || 0), 0) / 60
    );

    // Total sessions
    const totalSessions = sessions.length;

    // Average duration
    const averageDuration = totalSessions > 0
      ? Math.floor(totalStudyTime / totalSessions)
      : 0;

    // Course breakdown (using study mode time)
    const coursesBreakdown = new Map<string, { count: number; totalTime: number }>();
    sessions.forEach(session => {
      const course = session.courseTitle || 'Uncategorized';
      const existing = coursesBreakdown.get(course) || { count: 0, totalTime: 0 };
      coursesBreakdown.set(course, {
        count: existing.count + 1,
        totalTime: existing.totalTime + Math.floor((session.studyModeTime || 0) / 60)
      });
    });

    // Study dates (unique dates when sessions were created)
    const studyDates = sessions
      .map(s => this.normalizeDate(s.createdAt))
      .sort((a, b) => a.getTime() - b.getTime());

    // Calculate streaks
    const { currentStreak, longestStreak } = this.calculateStreaks(studyDates);

    return {
      totalStudyTime,
      totalSessions,
      averageDuration,
      coursesBreakdown,
      currentStreak,
      longestStreak,
      studyDates
    };
  }

  /**
   * Normalize date to midnight for streak calculation
   */
  private normalizeDate(date: Date): Date {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  }

  /**
   * Calculate current and longest study streaks
   */
  private calculateStreaks(studyDates: Date[]): { currentStreak: number; longestStreak: number } {
    if (studyDates.length === 0) {
      return { currentStreak: 0, longestStreak: 0 };
    }

    // Get unique dates
    const uniqueDates = Array.from(new Set(studyDates.map(d => d.getTime())))
      .map(t => new Date(t))
      .sort((a, b) => a.getTime() - b.getTime());

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 1;

    const today = this.normalizeDate(new Date());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Calculate longest streak
    for (let i = 1; i < uniqueDates.length; i++) {
      const prevDate = uniqueDates[i - 1];
      const currDate = uniqueDates[i];
      const diffDays = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    // Calculate current streak (must include today or yesterday)
    const mostRecentDate = uniqueDates[uniqueDates.length - 1];
    if (mostRecentDate.getTime() === today.getTime() || mostRecentDate.getTime() === yesterday.getTime()) {
      currentStreak = 1;
      for (let i = uniqueDates.length - 2; i >= 0; i--) {
        const prevDate = uniqueDates[i];
        const nextDate = uniqueDates[i + 1];
        const diffDays = Math.floor((nextDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    return { currentStreak, longestStreak };
  }

  /**
   * Format time in hours and minutes
   */
  private formatTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  }

  /**
   * Render goals widget
   */
  private renderGoalsWidget(): string {
    const activeGoals = this.goalsManager.getActiveGoals();
    const dailyGoal = this.goalsManager.getActiveGoal('daily');
    const weeklyGoal = this.goalsManager.getActiveGoal('weekly');

    const dailyProgress = dailyGoal ? this.goalsManager.calculateProgress(dailyGoal, this.sessions) : null;
    const weeklyProgress = weeklyGoal ? this.goalsManager.calculateProgress(weeklyGoal, this.sessions) : null;

    // If no goals set, show setup prompt
    if (activeGoals.length === 0) {
      return `
        <div class="analytics-section">
          <h3 class="analytics-section-title">Study Goals</h3>
          <div class="goals-empty">
            <div class="goals-empty-icon">🎯</div>
            <div class="goals-empty-text">Set a study time goal to track your progress!</div>
            <div class="goals-actions">
              <button class="goal-setup-btn" onclick="window.analyticsDashboard?.showGoalModal('daily')">
                Set Daily Goal
              </button>
              <button class="goal-setup-btn" onclick="window.analyticsDashboard?.showGoalModal('weekly')">
                Set Weekly Goal
              </button>
            </div>
          </div>
        </div>
      `;
    }

    // Show active goals with progress
    return `
      <div class="analytics-section">
        <h3 class="analytics-section-title">Study Goals</h3>
        <div class="goals-container">
          ${dailyProgress ? this.renderGoalCard(dailyProgress, 'daily') : `
            <div class="goal-card goal-placeholder">
              <div class="goal-placeholder-content">
                <span class="goal-placeholder-icon">📅</span>
                <span class="goal-placeholder-text">No daily goal set</span>
              </div>
              <button class="goal-setup-btn-small" onclick="window.analyticsDashboard?.showGoalModal('daily')">
                Set Goal
              </button>
            </div>
          `}

          ${weeklyProgress ? this.renderGoalCard(weeklyProgress, 'weekly') : `
            <div class="goal-card goal-placeholder">
              <div class="goal-placeholder-content">
                <span class="goal-placeholder-icon">📊</span>
                <span class="goal-placeholder-text">No weekly goal set</span>
              </div>
              <button class="goal-setup-btn-small" onclick="window.analyticsDashboard?.showGoalModal('weekly')">
                Set Goal
              </button>
            </div>
          `}
        </div>
      </div>
    `;
  }

  /**
   * Render individual goal card
   */
  private renderGoalCard(progress: GoalProgress, type: 'daily' | 'weekly'): string {
    const icon = type === 'daily' ? '📅' : '📊';
    const title = type === 'daily' ? 'Daily Goal' : 'Weekly Goal';
    const motivationalMsg = this.goalsManager.getMotivationalMessage(progress);
    const timeRemaining = this.goalsManager.getTimeRemaining(progress);
    const onTrack = type === 'weekly' ? this.goalsManager.isOnTrackForWeeklyGoal(progress) : true;

    return `
      <div class="goal-card ${progress.isComplete ? 'goal-complete' : ''}">
        <div class="goal-header">
          <div class="goal-title">
            <span class="goal-icon">${icon}</span>
            <span>${title}</span>
          </div>
          <button class="goal-edit-btn" onclick="window.analyticsDashboard?.showGoalModal('${type}')" title="Edit goal">
            ✏️
          </button>
        </div>

        <div class="goal-progress">
          <div class="goal-progress-text">
            <span class="goal-current">${this.goalsManager.formatMinutes(progress.currentMinutes)}</span>
            <span class="goal-separator">/</span>
            <span class="goal-target">${this.goalsManager.formatMinutes(progress.targetMinutes)}</span>
          </div>
          <div class="goal-progress-bar">
            <div class="goal-progress-fill" style="width: ${progress.percentComplete}%"></div>
          </div>
          <div class="goal-progress-percent">${Math.round(progress.percentComplete)}%</div>
        </div>

        <div class="goal-status">
          ${progress.isComplete
            ? `<span class="goal-status-complete">✓ Complete</span>`
            : `<span class="goal-status-remaining">${timeRemaining}</span>`
          }
          ${type === 'weekly' && !progress.isComplete && progress.daysRemaining
            ? `<span class="goal-days-remaining">${progress.daysRemaining} day${progress.daysRemaining !== 1 ? 's' : ''} left</span>`
            : ''
          }
        </div>

        <div class="goal-motivation ${progress.isComplete ? 'goal-motivation-complete' : ''}">
          ${motivationalMsg}
        </div>

        ${type === 'weekly' && !progress.isComplete
          ? `<div class="goal-on-track ${onTrack ? 'on-track' : 'behind-track'}">
              ${onTrack ? '✓ On track for weekly goal' : '⚠️ Behind schedule for weekly goal'}
            </div>`
          : ''
        }
      </div>
    `;
  }

  /**
   * Show goal setting modal
   */
  showGoalModal(type: 'daily' | 'weekly'): void {
    const existingGoal = this.goalsManager.getActiveGoal(type);
    const title = type === 'daily' ? 'Daily Goal' : 'Weekly Goal';
    const subtitle = type === 'daily'
      ? 'How many minutes do you want to study each day?'
      : 'How many minutes do you want to study each week?';

    const presets = type === 'daily'
      ? [15, 30, 45, 60, 90, 120]
      : [120, 180, 300, 420, 600, 900];

    const currentValue = existingGoal?.targetMinutes || presets[2];

    // Create modal overlay
    const modalHtml = `
      <div class="goal-modal" id="goal-modal">
        <div class="goal-modal-overlay" onclick="document.getElementById('goal-modal').remove()"></div>
        <div class="goal-modal-content">
          <div class="goal-modal-header">
            <h3>Set ${title}</h3>
            <button class="close-modal-btn" onclick="document.getElementById('goal-modal').remove()">×</button>
          </div>
          <div class="goal-modal-body">
            <p class="goal-modal-subtitle">${subtitle}</p>

            <div class="goal-presets">
              ${presets.map(minutes => `
                <button
                  class="goal-preset-btn ${currentValue === minutes ? 'active' : ''}"
                  onclick="window.analyticsDashboard?.selectGoalPreset('${type}', ${minutes})"
                  data-minutes="${minutes}"
                >
                  ${this.goalsManager.formatMinutes(minutes)}
                </button>
              `).join('')}
            </div>

            <div class="goal-custom-input">
              <label for="goal-custom-minutes">Or enter custom minutes:</label>
              <input
                type="number"
                id="goal-custom-minutes"
                min="1"
                max="${type === 'daily' ? '1440' : '10080'}"
                value="${currentValue}"
                placeholder="Enter minutes"
              />
            </div>

            <div class="goal-modal-actions">
              <button class="goal-modal-btn goal-modal-cancel" onclick="document.getElementById('goal-modal').remove()">
                Cancel
              </button>
              ${existingGoal ? `
                <button class="goal-modal-btn goal-modal-delete" onclick="window.analyticsDashboard?.deleteGoal('${type}')">
                  Delete Goal
                </button>
              ` : ''}
              <button class="goal-modal-btn goal-modal-save" onclick="window.analyticsDashboard?.saveGoal('${type}')">
                ${existingGoal ? 'Update Goal' : 'Set Goal'}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Add modal to page
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer.firstElementChild!);
  }

  /**
   * Select a goal preset
   */
  selectGoalPreset(type: 'daily' | 'weekly', minutes: number): void {
    // Update active state on buttons
    document.querySelectorAll('.goal-preset-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`.goal-preset-btn[data-minutes="${minutes}"]`)?.classList.add('active');

    // Update custom input
    const input = document.getElementById('goal-custom-minutes') as HTMLInputElement;
    if (input) {
      input.value = minutes.toString();
    }
  }

  /**
   * Save goal
   */
  saveGoal(type: 'daily' | 'weekly'): void {
    const input = document.getElementById('goal-custom-minutes') as HTMLInputElement;
    if (!input) return;

    const minutes = parseInt(input.value);
    if (isNaN(minutes) || minutes < 1) {
      const notificationTicker = (window as any).notificationTicker;
      if (notificationTicker) {
        notificationTicker.error('Please enter a valid number of minutes');
      }
      return;
    }

    const existingGoal = this.goalsManager.getActiveGoal(type);
    if (existingGoal) {
      this.goalsManager.updateGoal(existingGoal.id, minutes);
    } else {
      this.goalsManager.createGoal(type, minutes);
    }

    // Close modal
    document.getElementById('goal-modal')?.remove();

    // Re-render dashboard
    const dashboardContainer = document.querySelector('.analytics-dashboard');
    if (dashboardContainer) {
      dashboardContainer.innerHTML = this.render();
    }

    const notificationTicker = (window as any).notificationTicker;
    if (notificationTicker) {
      const goalType = type === 'daily' ? 'Daily' : 'Weekly';
      notificationTicker.success(`${goalType} goal ${existingGoal ? 'updated' : 'set'}! Target: ${this.goalsManager.formatMinutes(minutes)}`, 3000);
    }

    logger.info(`Goal ${existingGoal ? 'updated' : 'created'}: ${type} - ${minutes} minutes`);
  }

  /**
   * Delete goal
   */
  deleteGoal(type: 'daily' | 'weekly'): void {
    const goal = this.goalsManager.getActiveGoal(type);
    if (!goal) return;

    this.goalsManager.deleteGoal(goal.id);

    // Close modal
    document.getElementById('goal-modal')?.remove();

    // Re-render dashboard
    const dashboardContainer = document.querySelector('.analytics-dashboard');
    if (dashboardContainer) {
      dashboardContainer.innerHTML = this.render();
    }

    const notificationTicker = (window as any).notificationTicker;
    if (notificationTicker) {
      const goalType = type === 'daily' ? 'Daily' : 'Weekly';
      notificationTicker.success(`${goalType} goal deleted`, 3000);
    }

    logger.info(`Goal deleted: ${type}`);
  }

  /**
   * Render achievements section
   */
  private renderAchievements(): string {
    const allAchievements = this.achievementsManager.getAllAchievements();
    const unlocked = this.achievementsManager.getUnlockedAchievements();
    const nextToUnlock = this.achievementsManager.getNextAchievements(3);
    const completionPercent = this.achievementsManager.getCompletionPercentage();

    // Group achievements by category
    const categories: { name: string; achievements: Achievement[] }[] = [
      { name: 'Study Time', achievements: this.achievementsManager.getAchievementsByCategory('time') },
      { name: 'Session Count', achievements: this.achievementsManager.getAchievementsByCategory('sessions') },
      { name: 'Consistency', achievements: this.achievementsManager.getAchievementsByCategory('streaks') },
      { name: 'Marathon Sessions', achievements: this.achievementsManager.getAchievementsByCategory('marathon') },
      { name: 'Special', achievements: this.achievementsManager.getAchievementsByCategory('special') },
    ];

    return `
      <div class="analytics-section">
        <h3 class="analytics-section-title">Achievements</h3>

        <!-- Completion Overview -->
        <div class="achievements-overview">
          <div class="achievements-stats">
            <div class="achievements-stat">
              <span class="achievements-stat-value">${unlocked.length}</span>
              <span class="achievements-stat-label">/ ${allAchievements.length} Unlocked</span>
            </div>
            <div class="achievements-progress-bar">
              <div class="achievements-progress-fill" style="width: ${completionPercent}%"></div>
            </div>
            <div class="achievements-percent">${completionPercent}% Complete</div>
          </div>
        </div>

        <!-- Next To Unlock -->
        ${nextToUnlock.length > 0 ? `
          <div class="achievements-next">
            <h4 class="achievements-subsection-title">🎯 Almost There</h4>
            <div class="achievements-grid">
              ${nextToUnlock.map(achievement => this.renderAchievementBadge(achievement, false)).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Categories -->
        ${categories.map(category => {
          const categoryUnlocked = category.achievements.filter(a => a.unlocked).length;
          if (category.achievements.length === 0) return '';

          return `
            <div class="achievements-category">
              <div class="achievements-category-header">
                <h4 class="achievements-subsection-title">${category.name}</h4>
                <span class="achievements-category-count">${categoryUnlocked}/${category.achievements.length}</span>
              </div>
              <div class="achievements-grid">
                ${category.achievements.map(achievement =>
                  this.renderAchievementBadge(achievement, false)
                ).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  /**
   * Render individual achievement badge
   */
  private renderAchievementBadge(achievement: Achievement, showProgress: boolean = true): string {
    const tierColor = this.achievementsManager.getTierColor(achievement.tier);
    const isLocked = !achievement.unlocked;
    const progressPercent = achievement.requirement > 0
      ? Math.min((achievement.progress / achievement.requirement) * 100, 100)
      : 0;

    return `
      <div class="achievement-badge ${isLocked ? 'achievement-locked' : 'achievement-unlocked'}"
           title="${achievement.description}${isLocked ? ' - ' + this.achievementsManager.formatProgress(achievement) : ''}">
        <div class="achievement-icon" style="border-color: ${tierColor}${isLocked ? '44' : ''}">
          ${isLocked ? '🔒' : achievement.icon}
        </div>
        <div class="achievement-content">
          <div class="achievement-tier" style="color: ${tierColor}">${this.achievementsManager.getTierName(achievement.tier)}</div>
          <div class="achievement-title">${achievement.title}</div>
          ${showProgress && isLocked ? `
            <div class="achievement-progress">
              <div class="achievement-progress-bar-small">
                <div class="achievement-progress-fill-small" style="width: ${progressPercent}%; background: ${tierColor}"></div>
              </div>
              <div class="achievement-progress-text">${this.achievementsManager.formatProgress(achievement)}</div>
            </div>
          ` : ''}
          ${!isLocked && achievement.unlockedAt ? `
            <div class="achievement-unlocked-date">
              Unlocked ${new Date(achievement.unlockedAt).toLocaleDateString()}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Render the analytics dashboard
   */
  render(): string {
    if (!this.stats) {
      return '<div class="analytics-empty">No data available</div>';
    }

    const {
      totalStudyTime,
      totalSessions,
      averageDuration,
      coursesBreakdown,
      currentStreak,
      longestStreak
    } = this.stats;

    // Sort courses by total time
    const sortedCourses = Array.from(coursesBreakdown.entries())
      .sort((a, b) => b[1].totalTime - a[1].totalTime);

    return `
      <div class="analytics-dashboard">
        <!-- Overview Stats -->
        <div class="analytics-section">
          <h3 class="analytics-section-title">Overview</h3>
          <div class="analytics-stats-grid">
            <div class="analytics-stat-card">
              <div class="stat-icon">⏱️</div>
              <div class="stat-content">
                <div class="stat-value">${this.formatTime(totalStudyTime)}</div>
                <div class="stat-label">Total Study Time</div>
              </div>
            </div>

            <div class="analytics-stat-card">
              <div class="stat-icon">📚</div>
              <div class="stat-content">
                <div class="stat-value">${totalSessions}</div>
                <div class="stat-label">Total Sessions</div>
              </div>
            </div>

            <div class="analytics-stat-card">
              <div class="stat-icon">📊</div>
              <div class="stat-content">
                <div class="stat-value">${this.formatTime(averageDuration)}</div>
                <div class="stat-label">Average Duration</div>
              </div>
            </div>

            <div class="analytics-stat-card">
              <div class="stat-icon">🔥</div>
              <div class="stat-content">
                <div class="stat-value">${currentStreak}</div>
                <div class="stat-label">Current Streak</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Study Goals -->
        ${this.renderGoalsWidget()}

        <!-- Streaks -->
        ${currentStreak > 0 || longestStreak > 0 ? `
          <div class="analytics-section">
            <h3 class="analytics-section-title">Study Streaks</h3>
            <div class="analytics-streaks">
              <div class="streak-card">
                <span class="streak-label">Current Streak:</span>
                <span class="streak-value">${currentStreak} day${currentStreak !== 1 ? 's' : ''}</span>
              </div>
              <div class="streak-card">
                <span class="streak-label">Longest Streak:</span>
                <span class="streak-value">${longestStreak} day${longestStreak !== 1 ? 's' : ''}</span>
              </div>
            </div>
            ${currentStreak > 0 ? `
              <div class="streak-encouragement">
                ${currentStreak === longestStreak && currentStreak > 1
                  ? '🎉 You\'re on your longest streak ever! Keep it up!'
                  : currentStreak >= 7
                    ? '🌟 Amazing streak! You\'re building a strong study habit!'
                    : currentStreak >= 3
                      ? '💪 Great momentum! Keep the streak going!'
                      : '🚀 You\'re on a roll! Come back tomorrow to continue your streak!'
                }
              </div>
            ` : ''}
          </div>
        ` : ''}

        <!-- Course Breakdown -->
        ${sortedCourses.length > 0 ? `
          <div class="analytics-section">
            <h3 class="analytics-section-title">Study by Course</h3>
            <div class="analytics-courses">
              ${sortedCourses.map(([course, data]) => {
                const percentage = Math.round((data.totalTime / totalStudyTime) * 100);
                return `
                  <div class="course-item">
                    <div class="course-header">
                      <span class="course-name">${escapeHtml(course)}</span>
                      <span class="course-stats">${data.count} session${data.count !== 1 ? 's' : ''} • ${this.formatTime(data.totalTime)}</span>
                    </div>
                    <div class="course-progress-bar">
                      <div class="course-progress-fill" style="width: ${percentage}%"></div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Activity Heatmap -->
        ${this.renderActivityHeatmap()}

        <!-- Study Time Trends -->
        ${this.renderStudyTimeTrends()}

        <!-- Achievements -->
        ${this.renderAchievements()}

        <!-- Export Section -->
        <div class="analytics-section">
          <button class="export-analytics-btn" onclick="window.analyticsDashboard?.exportToCSV()">
            📊 Export Analytics to CSV
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render activity heatmap (GitHub-style)
   */
  private renderActivityHeatmap(): string {
    if (!this.stats || this.stats.studyDates.length === 0) {
      return '';
    }

    // Get last 12 weeks of data
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - (12 * 7)); // 12 weeks back

    // Create map of study dates (using study mode time)
    const studyDateMap = new Map<string, number>();
    this.sessions.forEach(session => {
      const dateKey = this.normalizeDate(session.createdAt).toISOString().split('T')[0];
      const existing = studyDateMap.get(dateKey) || 0;
      studyDateMap.set(dateKey, existing + Math.floor((session.studyModeTime || 0) / 60)); // minutes
    });

    // Generate weeks array
    const weeks: Date[][] = [];
    let currentWeek: Date[] = [];

    // Start from Sunday of the start week
    const current = new Date(startDate);
    current.setDate(current.getDate() - current.getDay()); // Go to Sunday

    for (let i = 0; i < 12 * 7; i++) {
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      currentWeek.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    // Month labels
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthLabels: { month: string; offset: number }[] = [];
    let lastMonth = -1;
    weeks.forEach((week, weekIndex) => {
      const month = week[0].getMonth();
      if (month !== lastMonth) {
        monthLabels.push({ month: months[month], offset: weekIndex * 14 });
        lastMonth = month;
      }
    });

    return `
      <div class="analytics-section">
        <h3 class="analytics-section-title">Activity</h3>
        <div class="activity-heatmap">
          <div class="heatmap-months">
            ${monthLabels.map(({ month, offset }) => `
              <span class="heatmap-month-label" style="left: ${offset}px">${month}</span>
            `).join('')}
          </div>
          <div class="heatmap-grid">
            ${weeks.map(week => `
              <div class="heatmap-week">
                ${week.map(date => {
                  const dateKey = date.toISOString().split('T')[0];
                  const minutes = studyDateMap.get(dateKey) || 0;
                  const level = minutes === 0 ? 0 : minutes < 30 ? 1 : minutes < 60 ? 2 : minutes < 120 ? 3 : 4;
                  const isToday = dateKey === today.toISOString().split('T')[0];
                  const isFuture = date > today;

                  return `
                    <div
                      class="heatmap-day level-${level} ${isToday ? 'today' : ''} ${isFuture ? 'future' : ''}"
                      title="${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}${minutes > 0 ? `: ${this.formatTime(minutes)}` : ': No activity'}"
                      data-date="${dateKey}"
                    ></div>
                  `;
                }).join('')}
              </div>
            `).join('')}
          </div>
          <div class="heatmap-legend">
            <span class="heatmap-legend-label">Less</span>
            <div class="heatmap-day level-0"></div>
            <div class="heatmap-day level-1"></div>
            <div class="heatmap-day level-2"></div>
            <div class="heatmap-day level-3"></div>
            <div class="heatmap-day level-4"></div>
            <span class="heatmap-legend-label">More</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render study time trends (last 7 days)
   */
  private renderStudyTimeTrends(): string {
    if (!this.stats || this.sessions.length === 0) {
      return '';
    }

    // Get last 7 days of data
    const days: { date: Date; minutes: number; label: string }[] = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const normalized = this.normalizeDate(date);
      const dateKey = normalized.toISOString().split('T')[0];

      const minutes = this.sessions
        .filter(s => {
          const sessionDate = this.normalizeDate(s.createdAt).toISOString().split('T')[0];
          return sessionDate === dateKey;
        })
        .reduce((sum, s) => sum + Math.floor((s.studyModeTime || 0) / 60), 0);

      const label = i === 0 ? 'Today' :
                    i === 1 ? 'Yesterday' :
                    date.toLocaleDateString('en-US', { weekday: 'short' });

      days.push({ date: normalized, minutes, label });
    }

    const maxMinutes = Math.max(...days.map(d => d.minutes), 1);

    return `
      <div class="analytics-section">
        <h3 class="analytics-section-title">Last 7 Days</h3>
        <div class="study-time-chart">
          ${days.map((day, index) => {
            const heightPercent = (day.minutes / maxMinutes) * 100;
            return `
              <div class="chart-bar-container">
                <div
                  class="chart-bar"
                  style="height: ${heightPercent}%"
                  title="${day.label}: ${this.formatTime(day.minutes)}"
                >
                  <span class="chart-bar-value">${day.minutes > 0 ? this.formatTime(day.minutes) : ''}</span>
                </div>
                <span class="chart-bar-label">${day.label}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Export analytics to CSV
   */
  exportToCSV(): void {
    if (!this.stats) return;

    const { totalStudyTime, totalSessions, averageDuration, coursesBreakdown, currentStreak, longestStreak } = this.stats;

    // Build CSV content
    let csv = 'ScribeCat Analytics Export\n\n';
    csv += 'Overview\n';
    csv += 'Metric,Value\n';
    csv += `Total Study Time,${this.formatTime(totalStudyTime)}\n`;
    csv += `Total Sessions,${totalSessions}\n`;
    csv += `Average Duration,${this.formatTime(averageDuration)}\n`;
    csv += `Current Streak,${currentStreak} days\n`;
    csv += `Longest Streak,${longestStreak} days\n\n`;

    csv += 'Course Breakdown\n';
    csv += 'Course,Sessions,Time (minutes)\n';
    Array.from(coursesBreakdown.entries())
      .sort((a, b) => b[1].totalTime - a[1].totalTime)
      .forEach(([course, data]) => {
        csv += `"${course}",${data.count},${data.totalTime}\n`;
      });

    csv += '\nSession History\n';
    csv += 'Date,Title,Course,Duration (minutes)\n';
    this.sessions
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .forEach(session => {
        const date = session.createdAt.toLocaleDateString('en-US');
        const title = session.title.replace(/"/g, '""');
        const course = (session.courseTitle || 'Uncategorized').replace(/"/g, '""');
        const duration = Math.floor((session.studyModeTime || 0) / 60);
        csv += `${date},"${title}","${course}",${duration}\n`;
      });

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scribecat-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const notificationTicker = (window as any).notificationTicker;
    if (notificationTicker) {
      notificationTicker.success('Analytics exported to CSV!', 3000);
    }
  }


  /**
   * Get current stats (for external access)
   */
  getStats(): StudyStats | null {
    return this.stats;
  }
}
