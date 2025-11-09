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

  /**
   * Update sessions and recalculate stats
   */
  updateSessions(sessions: Session[]): void {
    this.sessions = sessions;
    this.stats = this.calculateStats(sessions);
    logger.info('Analytics updated', { sessionCount: sessions.length });
  }

  /**
   * Calculate all statistics from sessions
   */
  private calculateStats(sessions: Session[]): StudyStats {
    // Total study time (convert seconds to minutes)
    const totalStudyTime = Math.floor(
      sessions.reduce((sum, s) => sum + s.duration, 0) / 60
    );

    // Total sessions
    const totalSessions = sessions.length;

    // Average duration
    const averageDuration = totalSessions > 0
      ? Math.floor(totalStudyTime / totalSessions)
      : 0;

    // Course breakdown
    const coursesBreakdown = new Map<string, { count: number; totalTime: number }>();
    sessions.forEach(session => {
      const course = session.courseTitle || 'Uncategorized';
      const existing = coursesBreakdown.get(course) || { count: 0, totalTime: 0 };
      coursesBreakdown.set(course, {
        count: existing.count + 1,
        totalTime: existing.totalTime + Math.floor(session.duration / 60)
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
                <div class="stat-label">Total Recording Time</div>
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
                      <span class="course-name">${this.escapeHtml(course)}</span>
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
      </div>
    `;
  }

  /**
   * Escape HTML
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Get current stats (for external access)
   */
  getStats(): StudyStats | null {
    return this.stats;
  }
}
