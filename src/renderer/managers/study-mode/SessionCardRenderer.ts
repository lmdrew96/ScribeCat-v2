/**
 * SessionCardRenderer
 *
 * Renders session cards for the session list view.
 * Handles HTML generation for individual session cards with metadata, actions, and indicators.
 */

import type { Session } from '../../../domain/entities/Session.js';
import { SyncStatus } from '../../../domain/entities/Session.js';
import { formatDuration, escapeHtml, formatCourseTitle } from '../../utils/formatting.js';
import { getIconHTML } from '../../utils/iconMap.js';

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
      previewContent = `<span class="multi-session-badge">${getIconHTML('library', { size: 14 })} Study Set • ${sessionCount} session${sessionCount !== 1 ? 's' : ''}</span>`;
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
    const hasTranscription = session.transcription ? `${getIconHTML('hasTranscript', { size: 14 })} Transcribed` : '';
    const hasNotes = session.notes ? `${getIconHTML('hasNotes', { size: 14 })} Notes` : '';
    const syncStatus = isStudySet ? '' : this.getSyncStatusIndicator(session);

    // Generate shared badge with owner's name if available
    const sharedBadge = this.getSharedBadge(session);

    const indicators = [hasTranscription, hasNotes, syncStatus, sharedBadge].filter(Boolean).join(' • ');
    const indicatorsWithCourse = [indicators, courseTag].filter(Boolean).join(' • ');

    return `
      <div class="session-card ${isSelected ? 'selected' : ''}" data-session-id="${session.id}">
        <input type="checkbox" class="session-card-checkbox" data-session-id="${session.id}" ${isSelected ? 'checked' : ''}>
        <div class="session-card-header">
          <h3 class="session-title ${isStudySet ? 'study-set-title' : ''}" data-session-id="${session.id}">
            ${isStudySet ? getIconHTML('library', { size: 16 }) + ' ' : ''}${escapeHtml(session.title)}
          </h3>
          <button class="edit-title-btn" data-session-id="${session.id}" title="Edit title">${getIconHTML('pencil', { size: 14 })}</button>
        </div>

        <div class="session-meta">
          <span class="session-date">${getIconHTML('calendar', { size: 14 })} ${formattedDate} at ${formattedTime}</span>
          <span class="session-duration">${getIconHTML('clock', { size: 14 })} ${duration}</span>
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
    const usersIcon = getIconHTML('users', { size: 14 });

    if (ownerName) {
      return `<span class="shared-badge" title="Shared by ${escapeHtml(ownerName)} (${escapeHtml(ownerEmail || '')})">${usersIcon} Shared by ${escapeHtml(ownerName)}</span>`;
    }

    if (ownerEmail) {
      return `<span class="shared-badge" title="Shared by ${escapeHtml(ownerEmail)}">${usersIcon} Shared by ${escapeHtml(ownerEmail)}</span>`;
    }

    return `<span class="shared-badge" title="Shared with you">${usersIcon} Shared</span>`;
  }

  /**
   * Get sync status indicator HTML
   */
  private static getSyncStatusIndicator(session: Session): string {
    if (!session.userId) {
      return '';
    }

    const cloudIcon = getIconHTML('cloud', { size: 14 });
    const checkIcon = getIconHTML('check', { size: 10 });
    const uploadIcon = getIconHTML('cloudUpload', { size: 10 });
    const xIcon = getIconHTML('close', { size: 10 });
    const alertIcon = getIconHTML('alert', { size: 10 });

    switch (session.syncStatus) {
      case SyncStatus.SYNCED:
        return `<span class="sync-indicator synced" title="Synced to cloud">${cloudIcon}${checkIcon}</span>`;
      case SyncStatus.SYNCING:
        return `<span class="sync-indicator syncing" title="Syncing...">${cloudIcon}${uploadIcon}</span>`;
      case SyncStatus.FAILED:
        return `<span class="sync-indicator failed" title="Sync failed">${cloudIcon}${xIcon}</span>`;
      case SyncStatus.NOT_SYNCED:
        return `<span class="sync-indicator not-synced" title="Not synced">${cloudIcon}</span>`;
      case SyncStatus.CONFLICT:
        return `<span class="sync-indicator conflict" title="Sync conflict">${cloudIcon}${alertIcon}</span>`;
      default:
        return '';
    }
  }

  /**
   * Get action buttons HTML based on session type
   */
  private static getActionButtons(session: Session, isStudySet: boolean): string {
    const trashIcon = getIconHTML('trash', { size: 14 });
    const linkIcon = getIconHTML('link', { size: 14 });
    const logOutIcon = getIconHTML('arrowRight', { size: 14 });

    if ((session as any).isShared) {
      return `
        <button class="action-btn export-session-btn" data-session-id="${session.id}">
          Export
        </button>
        <button class="action-btn leave-session-btn" data-session-id="${session.id}">
          ${logOutIcon} Leave
        </button>
      `;
    }

    if (isStudySet) {
      return `
        <button class="action-btn delete-session-btn" data-session-id="${session.id}">
          ${trashIcon} Delete
        </button>
      `;
    }

    return `
      <button class="action-btn share-session-btn" data-session-id="${session.id}">
        ${linkIcon} Share
      </button>
      <button class="action-btn export-session-btn" data-session-id="${session.id}">
        Export
      </button>
      <button class="action-btn delete-session-btn" data-session-id="${session.id}">
        ${trashIcon} Delete
      </button>
    `;
  }
}
