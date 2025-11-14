/**
 * TimelineView Component
 *
 * Calendar-style timeline showing sessions organized by date.
 * Features:
 * - Monthly calendar grid
 * - Session dots on dates with sessions
 * - Color-coded by course
 * - Click date to see sessions
 * - Navigate between months
 */

import type { Session } from '../../../domain/entities/Session.js';
import { escapeHtml } from '../../utils/formatting.js';

interface TimelineDay {
  date: Date;
  sessions: Session[];
  isCurrentMonth: boolean;
  isToday: boolean;
}

export class TimelineView {
  private sessions: Session[] = [];
  private container: HTMLElement;
  private currentMonth: Date;
  private onSessionClick: ((session: Session) => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.currentMonth = new Date();
  }

  /**
   * Render timeline view
   */
  render(sessions: Session[]): void {
    this.sessions = sessions;

    const days = this.generateCalendarDays();
    const monthYear = this.currentMonth.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });

    this.container.innerHTML = `
      <div class="timeline-view">
        <div class="timeline-header">
          <button id="timeline-prev-month" class="timeline-nav-btn" aria-label="Previous month">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd"/>
            </svg>
          </button>
          <h2 class="timeline-month-year">${monthYear}</h2>
          <button id="timeline-next-month" class="timeline-nav-btn" aria-label="Next month">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
            </svg>
          </button>
        </div>

        <div class="timeline-calendar">
          <div class="timeline-weekdays">
            <div class="timeline-weekday">Sun</div>
            <div class="timeline-weekday">Mon</div>
            <div class="timeline-weekday">Tue</div>
            <div class="timeline-weekday">Wed</div>
            <div class="timeline-weekday">Thu</div>
            <div class="timeline-weekday">Fri</div>
            <div class="timeline-weekday">Sat</div>
          </div>

          <div class="timeline-days">
            ${days.map(day => this.renderDay(day)).join('')}
          </div>
        </div>

        <div id="timeline-session-list" class="timeline-session-list"></div>
      </div>
    `;

    this.setupEventListeners();
  }

  /**
   * Generate calendar days for current month
   */
  private generateCalendarDays(): TimelineDay[] {
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();

    // First day of month
    const firstDay = new Date(year, month, 1);
    const startDay = firstDay.getDay(); // Day of week (0-6)

    // Last day of month
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Days from previous month
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const prevMonthDays = startDay;

    // Days to show from next month
    const totalDays = Math.ceil((daysInMonth + startDay) / 7) * 7;
    const nextMonthDays = totalDays - (daysInMonth + startDay);

    const days: TimelineDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Previous month days
    for (let i = prevMonthDays - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i);
      date.setHours(0, 0, 0, 0);
      days.push({
        date,
        sessions: this.getSessionsForDate(date),
        isCurrentMonth: false,
        isToday: date.getTime() === today.getTime()
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      date.setHours(0, 0, 0, 0);
      days.push({
        date,
        sessions: this.getSessionsForDate(date),
        isCurrentMonth: true,
        isToday: date.getTime() === today.getTime()
      });
    }

    // Next month days
    for (let i = 1; i <= nextMonthDays; i++) {
      const date = new Date(year, month + 1, i);
      date.setHours(0, 0, 0, 0);
      days.push({
        date,
        sessions: this.getSessionsForDate(date),
        isCurrentMonth: false,
        isToday: date.getTime() === today.getTime()
      });
    }

    return days;
  }

  /**
   * Get sessions for a specific date
   */
  private getSessionsForDate(date: Date): Session[] {
    return this.sessions.filter(session => {
      const sessionDate = new Date(session.createdAt);
      sessionDate.setHours(0, 0, 0, 0);
      return sessionDate.getTime() === date.getTime();
    });
  }

  /**
   * Render a single day
   */
  private renderDay(day: TimelineDay): string {
    const dayNumber = day.date.getDate();
    const hasSessions = day.sessions.length > 0;
    const classes = [
      'timeline-day',
      !day.isCurrentMonth ? 'timeline-day-other-month' : '',
      day.isToday ? 'timeline-day-today' : '',
      hasSessions ? 'timeline-day-has-sessions' : ''
    ].filter(Boolean).join(' ');

    const sessionDots = day.sessions.slice(0, 3).map(session => {
      const color = this.getCourseColor(session.courseId || '');
      return `<span class="timeline-session-dot" style="background: ${color}"></span>`;
    }).join('');

    const moreCount = day.sessions.length > 3 ? day.sessions.length - 3 : 0;

    return `
      <div class="${classes}" data-date="${day.date.toISOString()}">
        <div class="timeline-day-number">${dayNumber}</div>
        ${hasSessions ? `
          <div class="timeline-day-dots">
            ${sessionDots}
            ${moreCount > 0 ? `<span class="timeline-more-dots">+${moreCount}</span>` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Get color for course (simple hash-based color)
   */
  private getCourseColor(courseId: string): string {
    if (!courseId) return '#00bcd4';

    // Simple hash to color
    let hash = 0;
    for (let i = 0; i < courseId.length; i++) {
      hash = courseId.charCodeAt(i) + ((hash << 5) - hash);
    }

    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 65%, 55%)`;
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Previous month button
    const prevBtn = document.getElementById('timeline-prev-month');
    prevBtn?.addEventListener('click', () => {
      this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() - 1, 1);
      this.render(this.sessions);
    });

    // Next month button
    const nextBtn = document.getElementById('timeline-next-month');
    nextBtn?.addEventListener('click', () => {
      this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 1);
      this.render(this.sessions);
    });

    // Day click
    this.container.querySelectorAll('.timeline-day-has-sessions').forEach(dayEl => {
      dayEl.addEventListener('click', () => {
        const dateStr = dayEl.getAttribute('data-date');
        if (dateStr) {
          const date = new Date(dateStr);
          this.showSessionsForDate(date);
        }
      });
    });
  }

  /**
   * Show sessions for selected date
   */
  private showSessionsForDate(date: Date): void {
    const sessions = this.getSessionsForDate(date);
    const listContainer = document.getElementById('timeline-session-list');

    if (!listContainer || sessions.length === 0) return;

    const dateStr = date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });

    listContainer.innerHTML = `
      <div class="timeline-session-list-header">
        <h3>${dateStr}</h3>
        <span class="timeline-session-count">${sessions.length} session${sessions.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="timeline-session-items">
        ${sessions.map(session => this.renderSessionItem(session)).join('')}
      </div>
    `;

    // Add click handlers for session items
    listContainer.querySelectorAll('.timeline-session-item').forEach((item, index) => {
      item.addEventListener('click', (e) => {
        // Don't open session if checkbox was clicked
        if ((e.target as HTMLElement).classList.contains('session-checkbox')) {
          return;
        }
        if (this.onSessionClick) {
          this.onSessionClick(sessions[index]);
        }
      });
    });

    // Scroll into view
    listContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /**
   * Find parent study sets that include this session
   */
  private findParentStudySets(sessionId: string): Session[] {
    return this.sessions.filter(s =>
      s.isMultiSessionStudySet &&
      s.isMultiSessionStudySet() &&
      s.childSessionIds &&
      s.childSessionIds.includes(sessionId)
    );
  }

  /**
   * Render a session item in the timeline list
   */
  private renderSessionItem(session: Session): string {
    const duration = Math.floor(session.duration / 60);
    const time = session.createdAt.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });

    // Check if this session is part of any study sets
    const parentStudySets = this.findParentStudySets(session.id);
    const isPartOfStudySet = parentStudySets.length > 0;

    // Check if session can be selected (not a shared non-owner session)
    const canSelect = session.permissionLevel === undefined || session.permissionLevel === 'owner';

    // Check if this is a study set
    const isStudySet = session.isMultiSessionStudySet && session.isMultiSessionStudySet();

    return `
      <div class="timeline-session-item" data-session-id="${session.id}">
        <input type="checkbox" class="session-checkbox" data-session-id="${session.id}" ${!canSelect ? 'disabled' : ''}>
        <div class="timeline-session-time">${time}</div>
        <div class="timeline-session-details">
          <div class="timeline-session-title ${isStudySet ? 'study-set-title' : ''}">${isStudySet ? '📚 ' : ''}${escapeHtml(session.title)}</div>
          ${session.courseTitle ? `
            <div class="timeline-session-course">${escapeHtml(session.courseTitle)}</div>
          ` : ''}
          <div class="timeline-session-meta">
            ${duration} min
            ${session.hasTranscription() ? ' • Transcribed' : ''}
            ${session.notes ? ' • Has notes' : ''}
            ${isPartOfStudySet ? ` • <span class="study-set-member" title="Part of study set: ${escapeHtml(parentStudySets.map(s => s.title).join(', '))}">📚 In Study Set</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Set session click callback
   */
  onSessionSelect(callback: (session: Session) => void): void {
    this.onSessionClick = callback;
  }

}
