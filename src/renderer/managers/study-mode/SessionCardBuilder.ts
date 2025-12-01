/**
 * SessionCardBuilder
 *
 * Builds HTML for session cards in the session list.
 */

import type { Session } from '../../../domain/entities/Session.js';
import { SyncStatus } from '../../../domain/entities/Session.js';
import { formatDuration, escapeHtml, formatCourseTitle } from '../../utils/formatting.js';
import { getIconHTML } from '../../utils/iconMap.js';

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
              ${session.isMultiSessionStudySet && session.isMultiSessionStudySet() ? ` ${getIconHTML('library', { size: 14 })}` : ''}
            </h3>
            ${isShared ? `<span class="shared-badge" title="Shared ${session.permissionLevel === 'owner' ? 'by you' : 'with you'}">${session.permissionLevel === 'owner' ? `${getIconHTML('users', { size: 12 })} Shared` : session.permissionLevel === 'editor' ? `${getIconHTML('pencil', { size: 12 })} Editor` : `${getIconHTML('eye', { size: 12 })} Viewer`}</span>` : ''}
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
                ${getIconHTML('pencil', { size: 14 })} Edit Title
              </div>`
            : ''}
          <div class="option-item open-session-option" data-session-id="${session.id}">
            ${getIconHTML('eye', { size: 14 })} Open
          </div>
          <div class="option-item export-session-option" data-session-id="${session.id}">
            ${getIconHTML('share', { size: 14 })} Export
          </div>
          ${isEditable
            ? `<div class="option-item share-session-option" data-session-id="${session.id}">
                ${getIconHTML('users', { size: 14 })} Share
              </div>`
            : ''}
          ${!isShared || session.permissionLevel === 'owner'
            ? `<div class="option-item delete-session-option" data-session-id="${session.id}">
                ${getIconHTML('trash', { size: 14 })} Delete
              </div>`
            : ''}
          ${isShared && session.permissionLevel !== 'owner'
            ? `<div class="option-item leave-session-option" data-session-id="${session.id}">
                ${getIconHTML('arrowRight', { size: 14 })} Leave Session
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
        return `<span class="sync-status synced" title="Synced to cloud">${getIconHTML('cloud', { size: 14 })}</span>`;
      case SyncStatus.PENDING:
        return `<span class="sync-status pending" title="Pending sync">${getIconHTML('cloudUpload', { size: 14 })}</span>`;
      case SyncStatus.ERROR:
        return `<span class="sync-status error" title="Sync error">${getIconHTML('error', { size: 14 })}</span>`;
      case SyncStatus.LOCAL_ONLY:
        return `<span class="sync-status local" title="Local only">${getIconHTML('save', { size: 14 })}</span>`;
      default:
        return '';
    }
  }
}
