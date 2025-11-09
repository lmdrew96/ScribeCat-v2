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

        <!-- Activity Heatmap -->
        ${this.renderActivityHeatmap()}

        <!-- Study Time Trends -->
        ${this.renderStudyTimeTrends()}

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

    // Create map of study dates
    const studyDateMap = new Map<string, number>();
    this.sessions.forEach(session => {
      const dateKey = this.normalizeDate(session.createdAt).toISOString().split('T')[0];
      const existing = studyDateMap.get(dateKey) || 0;
      studyDateMap.set(dateKey, existing + Math.floor(session.duration / 60)); // minutes
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
        .reduce((sum, s) => sum + Math.floor(s.duration / 60), 0);

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
    csv += `Total Recording Time,${this.formatTime(totalStudyTime)}\n`;
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
        const duration = Math.floor(session.duration / 60);
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

    const toastManager = (window as any).toastManager;
    if (toastManager) {
      toastManager.success('Analytics exported to CSV!', { duration: 3000 });
    }
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
