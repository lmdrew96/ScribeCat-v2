/**
 * ListView Component
 *
 * Compact table-style view for sessions.
 * Perfect for power users who want to see many sessions at once.
 */

import type { Session } from '../../../domain/entities/Session.js';
import { escapeHtml } from '../../utils/formatting.js';

export class ListView {
  private container: HTMLElement;
  private onSessionClick: ((session: Session) => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /**
   * Render list view
   */
  render(sessions: Session[]): void {
    if (sessions.length === 0) {
      this.container.innerHTML = `
        <div class="list-view-empty">
          <p>No sessions found</p>
        </div>
      `;
      return;
    }

    this.container.innerHTML = `
      <div class="list-view">
        <table class="list-table">
          <thead>
            <tr>
              <th class="list-col-checkbox"></th>
              <th class="list-col-title">Title</th>
              <th class="list-col-course">Course</th>
              <th class="list-col-date">Date</th>
              <th class="list-col-duration">Duration</th>
              <th class="list-col-indicators">Content</th>
            </tr>
          </thead>
          <tbody>
            ${sessions.map(session => this.renderRow(session)).join('')}
          </tbody>
        </table>
      </div>
    `;

    // Add click handlers
    this.container.querySelectorAll('.list-row').forEach((row, index) => {
      row.addEventListener('click', (e) => {
        // Don't open session if checkbox was clicked
        if ((e.target as HTMLElement).classList.contains('session-checkbox')) {
          return;
        }
        if (this.onSessionClick) {
          this.onSessionClick(sessions[index]);
        }
      });
    });
  }

  /**
   * Render a table row
   */
  private renderRow(session: Session): string {
    const duration = this.formatDuration(session.duration);
    const date = session.createdAt.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    const time = session.createdAt.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });

    const hasTranscription = session.hasTranscription();
    const hasNotes = session.notes && session.notes.trim().length > 0;
    const hasSummary = session.summary && session.summary.trim().length > 0;

    // Check if session can be selected (not a shared non-owner session)
    const canSelect = session.permissionLevel === undefined || session.permissionLevel === 'owner';

    return `
      <tr class="list-row" data-session-id="${session.id}">
        <td class="list-col-checkbox">
          <input type="checkbox" class="session-checkbox" data-session-id="${session.id}" ${!canSelect ? 'disabled' : ''}>
        </td>
        <td class="list-col-title">
          <div class="list-title">${escapeHtml(session.title)}</div>
          ${session.tags.length > 0 ? `
            <div class="list-tags">
              ${session.tags.slice(0, 2).map(tag => `
                <span class="list-tag">${escapeHtml(tag)}</span>
              `).join('')}
              ${session.tags.length > 2 ? `<span class="list-tag-more">+${session.tags.length - 2}</span>` : ''}
            </div>
          ` : ''}
        </td>
        <td class="list-col-course">
          ${session.courseTitle ? escapeHtml(session.courseTitle) : '—'}
        </td>
        <td class="list-col-date">
          <div class="list-date">${date}</div>
          <div class="list-time">${time}</div>
        </td>
        <td class="list-col-duration">
          ${duration}
        </td>
        <td class="list-col-indicators">
          <div class="list-indicators">
            ${hasTranscription ? '<span class="list-indicator" title="Transcribed">T</span>' : ''}
            ${hasNotes ? '<span class="list-indicator" title="Has notes">N</span>' : ''}
            ${hasSummary ? '<span class="list-indicator" title="Summarized">S</span>' : ''}
          </div>
        </td>
      </tr>
    `;
  }

  /**
   * Format duration
   */
  private formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes}m`;
  }

  /**
   * Set session click callback
   */
  onSessionSelect(callback: (session: Session) => void): void {
    this.onSessionClick = callback;
  }

}
