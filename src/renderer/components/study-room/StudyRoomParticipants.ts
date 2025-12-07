/**
 * StudyRoomParticipants
 *
 * Handles participant list rendering, kick functionality, and time tracking.
 */

import type { StudyRoomsManager } from '../../managers/social/StudyRoomsManager.js';
import type { RoomParticipantData } from '../../../domain/entities/RoomParticipant.js';
import { escapeHtml } from '../../utils/formatting.js';
import { ErrorModal } from '../../utils/ErrorModal.js';

export class StudyRoomParticipants {
  private static participantTimeInterval: ReturnType<typeof setInterval> | null = null;
  private static readonly PARTICIPANT_TIME_UPDATE_MS = 30000;

  /**
   * Render participants list
   */
  static render(
    roomId: string,
    currentUserId: string,
    studyRoomsManager: StudyRoomsManager
  ): void {
    const container = document.getElementById('participants-list');
    const countBadge = document.getElementById('participants-count');
    if (!container) return;

    const participants = studyRoomsManager.getActiveParticipants(roomId);
    const room = studyRoomsManager.getRoomById(roomId);

    if (countBadge) {
      countBadge.textContent = participants.length.toString();
    }

    if (participants.length === 0) {
      container.innerHTML = '<p class="empty-state">No participants</p>';
      return;
    }

    container.innerHTML = participants.map(p =>
      StudyRoomParticipants.renderItem(p, currentUserId, room?.hostId || '')
    ).join('');
  }

  /**
   * Render a participant item
   */
  static renderItem(
    participant: RoomParticipantData,
    currentUserId: string,
    hostId: string
  ): string {
    const isCurrentUser = currentUserId === participant.userId;
    const displayName = participant.userFullName || participant.userEmail;
    const initials = StudyRoomParticipants.getInitials(displayName);
    const isHost = hostId === participant.userId;
    const joinedAtISO = new Date(participant.joinedAt).toISOString();
    const canKick = hostId === currentUserId && !isCurrentUser;

    return `
      <div class="participant-item ${isCurrentUser ? 'current-user' : ''}" data-user-id="${participant.userId}" data-joined-at="${joinedAtISO}">
        <div class="participant-avatar">${initials}</div>
        <div class="participant-info">
          <p class="participant-name">
            ${escapeHtml(displayName)}
            ${isHost ? '<span class="badge-host">Host</span>' : ''}
            ${isCurrentUser ? '<span class="badge-you">You</span>' : ''}
          </p>
          <p class="participant-status">
            <span class="status-indicator active"></span>
            Active • <span class="participant-time">${StudyRoomParticipants.getTimeInRoom(participant.joinedAt)}</span>
          </p>
        </div>
        ${canKick ? `
          <button
            class="btn-icon btn-kick"
            data-action="kick"
            data-user-id="${participant.userId}"
            title="Remove from room"
          >
            ×
          </button>
        ` : ''}
      </div>
    `;
  }

  /**
   * Attach kick action listeners
   */
  static attachKickListeners(
    roomId: string,
    studyRoomsManager: StudyRoomsManager
  ): void {
    document.querySelectorAll('[data-action="kick"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const userId = (e.target as HTMLElement).dataset.userId;
        if (!userId) return;

        const participant = studyRoomsManager
          .getRoomParticipants(roomId)
          .find(p => p.userId === userId);

        if (!participant) return;

        const displayName = participant.userFullName || participant.userEmail;
        if (confirm(`Remove ${displayName} from the room?`)) {
          try {
            await studyRoomsManager.removeParticipant(roomId, userId);
          } catch (error) {
            ErrorModal.show(
              'Failed to Remove Participant',
              'Could not remove the participant from the room. Please try again.'
            );
          }
        }
      });
    });
  }

  /**
   * Get time in room as formatted string
   */
  static getTimeInRoom(joinedAt: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - new Date(joinedAt).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffHours > 0) {
      const remainingMins = diffMins % 60;
      return `${diffHours}h ${remainingMins}m`;
    }
    return `${diffMins}m`;
  }

  /**
   * Update participant time displays without full re-render
   */
  static updateTimes(): void {
    const participantItems = document.querySelectorAll('.participant-item[data-joined-at]');
    participantItems.forEach(item => {
      const joinedAt = item.getAttribute('data-joined-at');
      if (joinedAt) {
        const timeSpan = item.querySelector('.participant-time');
        if (timeSpan) {
          timeSpan.textContent = StudyRoomParticipants.getTimeInRoom(new Date(joinedAt));
        }
      }
    });
  }

  /**
   * Start the participant time update interval
   */
  static startTimeInterval(): void {
    StudyRoomParticipants.stopTimeInterval();
    StudyRoomParticipants.participantTimeInterval = setInterval(() => {
      StudyRoomParticipants.updateTimes();
    }, StudyRoomParticipants.PARTICIPANT_TIME_UPDATE_MS);
  }

  /**
   * Stop the participant time update interval
   */
  static stopTimeInterval(): void {
    if (StudyRoomParticipants.participantTimeInterval) {
      clearInterval(StudyRoomParticipants.participantTimeInterval);
      StudyRoomParticipants.participantTimeInterval = null;
    }
  }

  /**
   * Get initials from name
   */
  static getInitials(name: string): string {
    if (!name || name.trim().length === 0) return '??';
    const trimmed = name.trim();
    const parts = trimmed.split(' ').filter(p => p.length > 0);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return trimmed.substring(0, Math.min(2, trimmed.length)).toUpperCase();
  }

  /**
   * Get user name from user ID
   */
  static async getUserName(
    userId: string,
    roomId: string,
    studyRoomsManager: StudyRoomsManager
  ): Promise<string> {
    const participants = studyRoomsManager.getRoomParticipants(roomId);
    const participant = participants.find(p => p.userId === userId);

    if (participant) {
      return participant.userFullName || participant.userEmail;
    }

    return 'Unknown User';
  }
}
