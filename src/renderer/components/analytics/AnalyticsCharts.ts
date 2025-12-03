/**
 * AnalyticsCharts
 *
 * Handles chart rendering for the analytics dashboard:
 * - Activity heatmap
 * - Study time trends
 * - Achievements section
 * - CSV export
 */

import type { Session } from '../../../domain/entities/Session.js';
import { AchievementsManager, type Achievement } from '../../managers/AchievementsManager.js';
import type { StudyStats } from './types.js';

export interface ChartsCallbacks {
  getSessions: () => Session[];
  getStats: () => StudyStats | null;
  normalizeDate: (date: Date) => Date;
  formatTime: (minutes: number) => string;
}

export class AnalyticsCharts {
  private achievementsManager: AchievementsManager;
  private callbacks: ChartsCallbacks;

  constructor(achievementsManager: AchievementsManager, callbacks: ChartsCallbacks) {
    this.achievementsManager = achievementsManager;
    this.callbacks = callbacks;
  }

  /**
   * Render activity heatmap (GitHub-style)
   */
  renderActivityHeatmap(): string {
    const stats = this.callbacks.getStats();
    if (!stats || stats.studyDates.length === 0) {
      return '';
    }

    const sessions = this.callbacks.getSessions();

    // Get last 12 weeks of data
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - (12 * 7)); // 12 weeks back

    // Create map of study dates (using study mode time)
    const studyDateMap = new Map<string, number>();
    sessions.forEach(session => {
      const dateKey = this.callbacks.normalizeDate(session.createdAt).toISOString().split('T')[0];
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
                      title="${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}${minutes > 0 ? `: ${this.callbacks.formatTime(minutes)}` : ': No activity'}"
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
  renderStudyTimeTrends(): string {
    const stats = this.callbacks.getStats();
    const sessions = this.callbacks.getSessions();
    if (!stats || sessions.length === 0) {
      return '';
    }

    // Get last 7 days of data
    const days: { date: Date; minutes: number; label: string }[] = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const normalized = this.callbacks.normalizeDate(date);
      const dateKey = normalized.toISOString().split('T')[0];

      const minutes = sessions
        .filter(s => {
          const sessionDate = this.callbacks.normalizeDate(s.createdAt).toISOString().split('T')[0];
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
          ${days.map(day => {
            const heightPercent = (day.minutes / maxMinutes) * 100;
            return `
              <div class="chart-bar-container">
                <div
                  class="chart-bar"
                  style="height: ${heightPercent}%"
                  title="${day.label}: ${this.callbacks.formatTime(day.minutes)}"
                >
                  <span class="chart-bar-value">${day.minutes > 0 ? this.callbacks.formatTime(day.minutes) : ''}</span>
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
   * Render achievements section
   */
  renderAchievements(): string {
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
   * Export analytics to CSV
   */
  exportToCSV(): void {
    const stats = this.callbacks.getStats();
    const sessions = this.callbacks.getSessions();
    if (!stats) return;

    const { totalStudyTime, totalSessions, averageDuration, coursesBreakdown, currentStreak, longestStreak } = stats;

    // Build CSV content
    let csv = 'ScribeCat Analytics Export\n\n';
    csv += 'Overview\n';
    csv += 'Metric,Value\n';
    csv += `Total Study Time,${this.callbacks.formatTime(totalStudyTime)}\n`;
    csv += `Total Sessions,${totalSessions}\n`;
    csv += `Average Duration,${this.callbacks.formatTime(averageDuration)}\n`;
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
    sessions
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
}
