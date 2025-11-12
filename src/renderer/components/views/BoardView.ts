/**
 * BoardView Component
 *
 * Kanban-style board for organizing sessions.
 * Columns are organized by course title.
 *
 * Sessions are automatically categorized by their course,
 * with uncategorized sessions grouped separately.
 */

import type { Session } from '../../../domain/entities/Session.js';
import { escapeHtml } from '../../utils/formatting.js';

interface BoardColumnConfig {
  id: string;
  title: string;
  icon: string;
  description: string;
}

const UNCATEGORIZED_COLUMN = 'uncategorized';

export class BoardView {
  private container: HTMLElement;
  private onSessionClick: ((session: Session) => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /**
   * Render board view
   */
  render(sessions: Session[]): void {
    // Categorize sessions by course
    const { columns, categorized } = this.categorizeSessions(sessions);

    this.container.innerHTML = `
      <div class="board-view">
        ${columns.map(column => this.renderColumn(column, categorized[column.id])).join('')}
      </div>
    `;

    // Add click handlers
    this.container.querySelectorAll('.board-card').forEach(card => {
      card.addEventListener('click', (e) => {
        // Don't open session if checkbox was clicked
        if ((e.target as HTMLElement).classList.contains('session-checkbox')) {
          return;
        }
        const sessionId = card.getAttribute('data-session-id');
        const session = sessions.find(s => s.id === sessionId);
        if (session && this.onSessionClick) {
          this.onSessionClick(session);
        }
      });
    });
  }

  /**
   * Categorize sessions into board columns by course title
   */
  private categorizeSessions(sessions: Session[]): {
    columns: BoardColumnConfig[];
    categorized: Record<string, Session[]>;
  } {
    const categorized: Record<string, Session[]> = {};

    // Group sessions by course title
    sessions.forEach(session => {
      const courseKey = session.courseTitle?.trim() || UNCATEGORIZED_COLUMN;
      if (!categorized[courseKey]) {
        categorized[courseKey] = [];
      }
      categorized[courseKey].push(session);
    });

    // Create column configs sorted alphabetically (with Uncategorized last)
    const courseNames = Object.keys(categorized).sort((a, b) => {
      if (a === UNCATEGORIZED_COLUMN) return 1;
      if (b === UNCATEGORIZED_COLUMN) return -1;
      return a.localeCompare(b);
    });

    const columns: BoardColumnConfig[] = courseNames.map(courseName => {
      const isUncategorized = courseName === UNCATEGORIZED_COLUMN;
      return {
        id: courseName,
        title: isUncategorized ? 'Uncategorized' : courseName,
        icon: isUncategorized ? '📂' : '📚',
        description: isUncategorized
          ? 'Sessions without a course'
          : `${categorized[courseName].length} session${categorized[courseName].length !== 1 ? 's' : ''}`
      };
    });

    return { columns, categorized };
  }

  /**
   * Render a board column
   */
  private renderColumn(column: BoardColumnConfig, sessions: Session[]): string {
    return `
      <div class="board-column" data-column="${column.id}">
        <div class="board-column-header">
          <div class="board-column-title">
            <span class="board-column-icon">${column.icon}</span>
            <h3>${column.title}</h3>
            <span class="board-column-count">${sessions.length}</span>
          </div>
          <p class="board-column-description">${column.description}</p>
        </div>
        <div class="board-column-content">
          ${sessions.length > 0
            ? sessions.map(session => this.renderCard(session)).join('')
            : this.renderEmptyState(column)
          }
        </div>
      </div>
    `;
  }

  /**
   * Render empty state for a column
   */
  private renderEmptyState(column: BoardColumnConfig): string {
    return `
      <div class="board-column-empty">
        <p>No sessions in this course</p>
      </div>
    `;
  }

  /**
   * Render a session card
   */
  private renderCard(session: Session): string {
    const duration = Math.floor(session.duration / 60);
    const date = session.createdAt.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });

    // Check if session can be selected (not a shared non-owner session)
    const canSelect = session.permissionLevel === undefined || session.permissionLevel === 'owner';

    return `
      <div class="board-card" data-session-id="${session.id}">
        <input type="checkbox" class="session-checkbox" data-session-id="${session.id}" ${!canSelect ? 'disabled' : ''}>
        <div class="board-card-title">${escapeHtml(session.title)}</div>

        <div class="board-card-meta">
          <span>${date}</span>
          <span>${duration} min</span>
        </div>

        <div class="board-card-indicators">
          ${session.hasTranscription() ? '<span title="Transcribed">📝</span>' : ''}
          ${session.notes ? '<span title="Has notes">✍️</span>' : ''}
          ${session.summary ? '<span title="Summarized">🤖</span>' : ''}
        </div>

        ${session.tags.length > 0 ? `
          <div class="board-card-tags">
            ${session.tags.slice(0, 2).map(tag => `
              <span class="board-card-tag">${escapeHtml(tag)}</span>
            `).join('')}
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

}
