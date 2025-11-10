/**
 * GridView Component
 *
 * Enhanced card-based grid layout for sessions.
 * This is an improved version of the default session card view.
 */

import type { Session } from '../../../domain/entities/Session.js';
import { escapeHtml } from '../../utils/formatting.js';

export class GridView {
  private container: HTMLElement;
  private onSessionClick: ((session: Session) => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /**
   * Render grid view
   */
  render(sessions: Session[]): void {
    if (sessions.length === 0) {
      this.container.innerHTML = `
        <div class="grid-view-empty">
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
            <path d="M40 20L50 30H30L40 20Z" fill="currentColor" opacity="0.2"/>
            <rect x="25" y="30" width="30" height="30" rx="4" fill="currentColor" opacity="0.2"/>
          </svg>
          <h3>No sessions found</h3>
          <p>Try adjusting your search or filters</p>
        </div>
      `;
      return;
    }

    this.container.innerHTML = `
      <div class="grid-view">
        ${sessions.map(session => this.renderCard(session)).join('')}
      </div>
    `;

    // Add click handlers
    this.container.querySelectorAll('.grid-card').forEach((card, index) => {
      card.addEventListener('click', (e) => {
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
   * Render a session card
   */
  private renderCard(session: Session): string {
    const duration = Math.floor(session.duration / 60);
    const date = session.createdAt.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const hasTranscription = session.hasTranscription();
    const hasNotes = session.notes && session.notes.trim().length > 0;
    const hasSummary = session.summary && session.summary.trim().length > 0;

    // Check if session can be selected (not a shared non-owner session)
    const canSelect = session.permissionLevel === undefined || session.permissionLevel === 'owner';

    return `
      <div class="grid-card" data-session-id="${session.id}">
        <input type="checkbox" class="session-checkbox" data-session-id="${session.id}" ${!canSelect ? 'disabled' : ''}>
        <div class="grid-card-header">
          <h3 class="grid-card-title">${escapeHtml(session.title)}</h3>
          ${session.courseTitle ? `
            <div class="grid-card-course">${escapeHtml(session.courseTitle)}</div>
          ` : ''}
        </div>

        <div class="grid-card-meta">
          <span class="grid-card-date">${date}</span>
          <span class="grid-card-duration">${duration} min</span>
        </div>

        ${session.summary ? `
          <div class="grid-card-summary">${escapeHtml(this.truncate(session.summary, 120))}</div>
        ` : ''}

        <div class="grid-card-indicators">
          ${hasTranscription ? '<span class="indicator" title="Has transcription">📝</span>' : ''}
          ${hasNotes ? '<span class="indicator" title="Has notes">✍️</span>' : ''}
          ${hasSummary ? '<span class="indicator" title="Has AI summary">🤖</span>' : ''}
          ${session.tags.length > 0 ? '<span class="indicator" title="Has tags">🏷️</span>' : ''}
        </div>

        ${session.tags.length > 0 ? `
          <div class="grid-card-tags">
            ${session.tags.slice(0, 3).map(tag => `
              <span class="grid-card-tag">${escapeHtml(tag)}</span>
            `).join('')}
            ${session.tags.length > 3 ? `<span class="grid-card-tag-more">+${session.tags.length - 3}</span>` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Set session click callback
   */
  onSessionSelect(callback: (session: Session) => void): void {
    this.onSessionClick = callback;
  }

  /**
   * Truncate text
   */
  private truncate(text: string, length: number): string {
    return text.length > length ? text.substring(0, length) + '...' : text;
  }

}
