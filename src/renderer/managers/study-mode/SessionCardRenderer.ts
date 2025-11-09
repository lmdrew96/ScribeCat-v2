/**
 * SessionCardRenderer
 *
 * Renders session cards for the session list view.
 * Handles HTML generation for individual session cards with metadata, actions, and indicators.
 */

import type { Session } from '../../../domain/entities/Session.js';
import { SyncStatus } from '../../../domain/entities/Session.js';
import { formatDuration, escapeHtml, formatCourseTitle } from '../../utils/formatting.js';

export class SessionCardRenderer {
  /**
   * Create HTML for a session card
   */
  static createSessionCard(session: Session, isSelected: boolean): string {
    const date = new Date(session.createdAt);
    const formattedDate = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    const formattedTime = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });

    const duration = formatDuration(session.duration);

    // Check if this is a multi-session study set
    const isStudySet = session.isMultiSessionStudySet();

    // Get preview content based on session type
    let previewContent = '';
    if (isStudySet) {
      const sessionCount = session.getChildSessionIds().length;
      previewContent = `<span class="multi-session-badge">📚 Study Set • ${sessionCount} session${sessionCount !== 1 ? 's' : ''}</span>`;
    } else {
      const summaryPreview = session.summary
        ? session.summary.substring(0, 150) + (session.summary.length > 150 ? '...' : '')
        : session.transcription
        ? session.transcription.fullText.substring(0, 150) + '...'
        : 'No summary or transcription available';
      previewContent = escapeHtml(summaryPreview);
    }

    // Get course information from dedicated fields first, fall back to tags
    const courseTag = this.getCourseTag(session);

    // Status indicators
    const hasTranscription = session.transcription ? '✓ Transcribed' : '';
    const hasNotes = session.notes ? '✓ Notes' : '';
    const syncStatus = isStudySet ? '' : this.getSyncStatusIndicator(session);

    // Generate shared badge with owner's name if available
    const sharedBadge = this.getSharedBadge(session);

    const indicators = [hasTranscription, hasNotes, syncStatus, sharedBadge].filter(Boolean).join(' • ');
    const indicatorsWithCourse = [indicators, courseTag].filter(Boolean).join(' • ');

    return `
      <div class="session-card ${isSelected ? 'selected' : ''}" data-session-id="${session.id}">
        <input type="checkbox" class="session-card-checkbox" data-session-id="${session.id}" ${isSelected ? 'checked' : ''}>
        <div class="session-card-header">
          <h3 class="session-title" data-session-id="${session.id}">${escapeHtml(session.title)}</h3>
          <button class="edit-title-btn" data-session-id="${session.id}" title="Edit title">✏️</button>
        </div>

        <div class="session-meta">
          <span class="session-date">📅 ${formattedDate} at ${formattedTime}</span>
          <span class="session-duration">⏱️ ${duration}</span>
        </div>

        <div class="session-preview">
          ${previewContent}
        </div>

        ${indicatorsWithCourse ? `<div class="session-indicators">${indicatorsWithCourse}</div>` : ''}

        <div class="session-actions">
          ${this.getActionButtons(session, isStudySet)}
        </div>
      </div>
    `;
  }

  /**
   * Get course tag HTML
   */
  private static getCourseTag(session: Session): string {
    if (session.courseTitle && session.courseTitle.trim()) {
      const fullTitle = session.courseTitle.trim();
      const displayTitle = formatCourseTitle(fullTitle);
      return `<span class="course-badge" data-tooltip="${escapeHtml(fullTitle)}"><span class="course-badge-text">${escapeHtml(displayTitle)}</span></span>`;
    }

    // Fall back to tag-based search if dedicated fields are empty
    const courseTags = session.tags?.filter(tag =>
      tag.includes('course') || tag.includes('class')
    ) || [];

    if (courseTags.length > 0) {
      const fullTitle = courseTags[0].trim();
      const displayTitle = formatCourseTitle(fullTitle);
      return `<span class="course-badge" data-tooltip="${escapeHtml(fullTitle)}"><span class="course-badge-text">${escapeHtml(displayTitle)}</span></span>`;
    }

    return '';
  }

  /**
   * Get shared badge HTML
   */
  private static getSharedBadge(session: Session): string {
    if (!(session as any).isShared) {
      return '';
    }

    const ownerName = (session as any).ownerName;
    const ownerEmail = (session as any).ownerEmail;

    if (ownerName) {
      return `<span class="shared-badge" title="Shared by ${escapeHtml(ownerName)} (${escapeHtml(ownerEmail || '')})">👥 Shared by ${escapeHtml(ownerName)}</span>`;
    }

    if (ownerEmail) {
      return `<span class="shared-badge" title="Shared by ${escapeHtml(ownerEmail)}">👥 Shared by ${escapeHtml(ownerEmail)}</span>`;
    }

    return '<span class="shared-badge" title="Shared with you">👥 Shared</span>';
  }

  /**
   * Get sync status indicator HTML
   */
  private static getSyncStatusIndicator(session: Session): string {
    if (!session.userId) {
      return '';
    }

    switch (session.syncStatus) {
      case SyncStatus.SYNCED:
        return '<span class="sync-indicator synced" title="Synced to cloud">☁️ ✓</span>';
      case SyncStatus.SYNCING:
        return '<span class="sync-indicator syncing" title="Syncing...">☁️ ↑</span>';
      case SyncStatus.FAILED:
        return '<span class="sync-indicator failed" title="Sync failed">☁️ ✗</span>';
      case SyncStatus.NOT_SYNCED:
        return '<span class="sync-indicator not-synced" title="Not synced">☁️ •</span>';
      case SyncStatus.CONFLICT:
        return '<span class="sync-indicator conflict" title="Sync conflict">☁️ ⚠</span>';
      default:
        return '';
    }
  }

  /**
   * Get action buttons HTML based on session type
   */
  private static getActionButtons(session: Session, isStudySet: boolean): string {
    if ((session as any).isShared) {
      return `
        <button class="action-btn export-session-btn" data-session-id="${session.id}">
          Export
        </button>
        <button class="action-btn leave-session-btn" data-session-id="${session.id}">
          👋 Leave
        </button>
      `;
    }

    if (isStudySet) {
      return `
        <button class="action-btn delete-session-btn" data-session-id="${session.id}">
          🗑️ Delete
        </button>
      `;
    }

    return `
      <button class="action-btn share-session-btn" data-session-id="${session.id}">
        🔗 Share
      </button>
      <button class="action-btn export-session-btn" data-session-id="${session.id}">
        Export
      </button>
      <button class="action-btn delete-session-btn" data-session-id="${session.id}">
        🗑️ Delete
      </button>
    `;
  }
}
