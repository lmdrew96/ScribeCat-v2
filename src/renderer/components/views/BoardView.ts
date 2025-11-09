/**
 * BoardView Component
 *
 * Kanban-style board for organizing sessions.
 * Columns: To Review | Studying | Mastered
 *
 * Sessions are automatically categorized based on metadata,
 * but users can drag-and-drop to reorganize (future enhancement).
 */

import type { Session } from '../../../domain/entities/Session.js';

type BoardColumn = 'to-review' | 'studying' | 'mastered';

interface BoardColumnConfig {
  id: BoardColumn;
  title: string;
  icon: string;
  description: string;
}

const COLUMNS: BoardColumnConfig[] = [
  {
    id: 'to-review',
    title: 'To Review',
    icon: '📋',
    description: 'Sessions you haven\'t opened yet'
  },
  {
    id: 'studying',
    title: 'Studying',
    icon: '📚',
    description: 'Sessions you\'re actively working on'
  },
  {
    id: 'mastered',
    title: 'Mastered',
    icon: '✅',
    description: 'Sessions you\'ve fully reviewed'
  }
];

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
    // Categorize sessions
    const categorized = this.categorizeSessions(sessions);

    this.container.innerHTML = `
      <div class="board-view">
        ${COLUMNS.map(column => this.renderColumn(column, categorized[column.id])).join('')}
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
   * Categorize sessions into board columns
   */
  private categorizeSessions(sessions: Session[]): Record<BoardColumn, Session[]> {
    const categorized: Record<BoardColumn, Session[]> = {
      'to-review': [],
      'studying': [],
      'mastered': []
    };

    sessions.forEach(session => {
      const category = this.categorizeSession(session);
      categorized[category].push(session);
    });

    return categorized;
  }

  /**
   * Categorize a single session
   *
   * Logic:
   * - "To Review": No notes, no summary, recently created
   * - "Mastered": Has notes, has summary, has AI tools used
   * - "Studying": Everything else
   */
  private categorizeSession(session: Session): BoardColumn {
    const hasNotes = session.notes && session.notes.trim().length > 0;
    const hasSummary = session.summary && session.summary.trim().length > 0;
    const hasTranscription = session.hasTranscription();

    // Recently created (within 7 days) and no engagement
    const daysSinceCreation = (Date.now() - session.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const isRecent = daysSinceCreation < 7;

    // Mastered: Has notes AND summary
    if (hasNotes && hasSummary) {
      return 'mastered';
    }

    // To Review: Recent, has transcription but no notes/summary
    if (isRecent && hasTranscription && !hasNotes && !hasSummary) {
      return 'to-review';
    }

    // Studying: Everything else (partial engagement)
    return 'studying';
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
    const messages: Record<BoardColumn, string> = {
      'to-review': 'All caught up! 🎉',
      'studying': 'Start reviewing sessions',
      'mastered': 'No sessions mastered yet'
    };

    return `
      <div class="board-column-empty">
        <p>${messages[column.id]}</p>
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
        <div class="board-card-title">${this.escapeHtml(session.title)}</div>

        ${session.courseTitle ? `
          <div class="board-card-course">${this.escapeHtml(session.courseTitle)}</div>
        ` : ''}

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
              <span class="board-card-tag">${this.escapeHtml(tag)}</span>
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

  /**
   * Escape HTML
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
