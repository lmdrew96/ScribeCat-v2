/**
 * SessionCardBuilder
 *
 * Builds HTML for session cards in the session list.
 */

import type { Session } from '../../../domain/entities/Session.js';
import { SyncStatus } from '../../../domain/entities/Session.js';
import { formatDuration, escapeHtml, formatCourseTitle } from '../../utils/formatting.js';

export class SessionCardBuilder {
  /**
   * Create HTML for a session card
   */
  static createSessionCard(session: Session): string {
    const isShared = session.permissionLevel !== undefined;
    const isEditable = session.permissionLevel === 'editor' || !isShared;

    const syncStatusIndicator = this.getSyncStatusIndicator(session);

    return `
      <div class="session-card" data-session-id="${session.id}">
        <div class="session-card-header">
          <div class="session-header-left">
            <input
              type="checkbox"
              class="session-checkbox"
              data-session-id="${session.id}"
              ${isShared && session.permissionLevel !== 'owner' ? 'disabled' : ''}
            />
            <h3 class="session-title" data-session-id="${session.id}">
              ${escapeHtml(session.title)}
              ${session.isMultiSessionStudySet && session.isMultiSessionStudySet() ? ' 📚' : ''}
            </h3>
            ${isShared ? `<span class="shared-badge" title="Shared ${session.permissionLevel === 'owner' ? 'by you' : 'with you'}">${session.permissionLevel === 'owner' ? '👥 Shared' : session.permissionLevel === 'editor' ? '✏️ Editor' : '👁️ Viewer'}</span>` : ''}
            ${syncStatusIndicator}
          </div>
          <button class="session-options-btn" data-session-id="${session.id}" title="Options">⋮</button>
        </div>

        <div class="session-card-body">
          <div class="session-metadata">
            <div class="metadata-item">
              <strong>Date:</strong> ${session.createdAt.toLocaleDateString()}
            </div>

            <div class="metadata-item">
              <strong>Duration:</strong> ${formatDuration(session.duration)}
            </div>

            ${session.courseId || session.courseNumber || session.courseTitle
              ? `<div class="metadata-item">
                  <strong>Course:</strong> ${formatCourseTitle(session)}
                </div>`
              : ''}

            ${session.tags.length > 0
              ? `<div class="metadata-item">
                  <strong>Tags:</strong> ${session.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
                </div>`
              : ''}

            ${session.hasNotes()
              ? `<div class="metadata-item">
                  <strong>Notes:</strong> ✓
                </div>`
              : ''}

            ${session.hasTranscription()
              ? `<div class="metadata-item">
                  <strong>Transcription:</strong> ✓
                </div>`
              : ''}
          </div>
        </div>

        <div class="session-card-actions">
          <button class="action-btn open-session-btn" data-session-id="${session.id}" title="Open Session">
            Open
          </button>
          <button class="action-btn export-session-btn" data-session-id="${session.id}" title="Export Session">
            Export
          </button>
          ${isEditable
            ? `<button class="action-btn share-session-btn" data-session-id="${session.id}" title="Share Session">
                Share
              </button>`
            : ''}
          ${!isShared || session.permissionLevel === 'owner'
            ? `<button class="action-btn delete-session-btn" data-session-id="${session.id}" title="Delete Session">
                Delete
              </button>`
            : ''}
          ${isShared && session.permissionLevel !== 'owner'
            ? `<button class="action-btn leave-session-btn" data-session-id="${session.id}" title="Leave Session">
                Leave
              </button>`
            : ''}
        </div>

        <div class="session-options-menu hidden" data-session-id="${session.id}">
          ${isEditable
            ? `<div class="option-item edit-title-option" data-session-id="${session.id}">
                ✏️ Edit Title
              </div>`
            : ''}
          <div class="option-item open-session-option" data-session-id="${session.id}">
            👁️ Open
          </div>
          <div class="option-item export-session-option" data-session-id="${session.id}">
            📤 Export
          </div>
          ${isEditable
            ? `<div class="option-item share-session-option" data-session-id="${session.id}">
                👥 Share
              </div>`
            : ''}
          ${!isShared || session.permissionLevel === 'owner'
            ? `<div class="option-item delete-session-option" data-session-id="${session.id}">
                🗑️ Delete
              </div>`
            : ''}
          ${isShared && session.permissionLevel !== 'owner'
            ? `<div class="option-item leave-session-option" data-session-id="${session.id}">
                🚪 Leave Session
              </div>`
            : ''}
        </div>
      </div>
    `;
  }

  /**
   * Get sync status indicator HTML
   */
  private static getSyncStatusIndicator(session: Session): string {
    const syncStatus = session.getSyncStatus();

    switch (syncStatus) {
      case SyncStatus.SYNCED:
        return '<span class="sync-status synced" title="Synced to cloud">☁️</span>';
      case SyncStatus.PENDING:
        return '<span class="sync-status pending" title="Pending sync">⏳</span>';
      case SyncStatus.ERROR:
        return '<span class="sync-status error" title="Sync error">❌</span>';
      case SyncStatus.LOCAL_ONLY:
        return '<span class="sync-status local" title="Local only">💾</span>';
      default:
        return '';
    }
  }
}
