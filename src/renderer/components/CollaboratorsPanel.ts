/**
 * CollaboratorsPanel
 *
 * UI component for displaying active collaborators in real-time.
 * Shows user avatars, names, and online status.
 */

import { UserPresence, ConnectionState } from '../../infrastructure/services/supabase/SupabaseRealtimeService.js';
import { createLogger } from '../../shared/logger.js';
import { escapeHtml } from '../utils/formatting.js';

const logger = createLogger('CollaboratorsPanel');

export class CollaboratorsPanel {
  private container: HTMLElement;
  private collaborators: UserPresence[] = [];
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container element not found: ${containerId}`);
    }
    this.container = container;
    this.render();
  }

  /**
   * Update collaborators list
   */
  updateCollaborators(collaborators: UserPresence[]): void {
    this.collaborators = collaborators;
    this.render();
  }

  /**
   * Update connection state
   */
  updateConnectionState(state: ConnectionState): void {
    this.connectionState = state;
    this.render();
  }

  /**
   * Show the panel
   */
  show(): void {
    this.container.classList.remove('hidden');
  }

  /**
   * Hide the panel
   */
  hide(): void {
    this.container.classList.add('hidden');
  }

  /**
   * Render the collaborators panel
   */
  private render(): void {
    const connectionStatus = this.getConnectionStatusHTML();
    const collaboratorsList = this.collaborators.length > 0
      ? this.collaborators.map(user => this.getUserHTML(user)).join('')
      : '<div class="no-collaborators">No other collaborators</div>';

    this.container.innerHTML = `
      <div class="collaborators-panel">
        <div class="collaborators-header">
          <span class="collaborators-title">Active Collaborators</span>
          ${connectionStatus}
        </div>
        <div class="collaborators-list">
          ${collaboratorsList}
        </div>
      </div>
    `;
  }

  /**
   * Get connection status HTML
   */
  private getConnectionStatusHTML(): string {
    let statusClass = 'status-disconnected';
    let statusText = 'Disconnected';
    let statusIcon = '⚫';

    switch (this.connectionState) {
      case ConnectionState.CONNECTED:
        statusClass = 'status-connected';
        statusText = 'Connected';
        statusIcon = '🟢';
        break;
      case ConnectionState.CONNECTING:
        statusClass = 'status-connecting';
        statusText = 'Connecting...';
        statusIcon = '🟡';
        break;
      case ConnectionState.RECONNECTING:
        statusClass = 'status-reconnecting';
        statusText = 'Reconnecting...';
        statusIcon = '🟡';
        break;
      case ConnectionState.ERROR:
        statusClass = 'status-error';
        statusText = 'Connection Error';
        statusIcon = '🔴';
        break;
      case ConnectionState.DISCONNECTED:
      default:
        statusClass = 'status-disconnected';
        statusText = 'Disconnected';
        statusIcon = '⚫';
        break;
    }

    return `
      <div class="connection-status ${statusClass}">
        <span class="status-icon">${statusIcon}</span>
        <span class="status-text">${statusText}</span>
      </div>
    `;
  }

  /**
   * Get user HTML
   */
  private getUserHTML(user: UserPresence): string {
    const initials = this.getInitials(user.userName);
    const avatarHTML = user.avatarUrl
      ? `<img src="${user.avatarUrl}" alt="${user.userName}" class="user-avatar-img">`
      : `<div class="user-avatar-initials" style="background-color: ${user.color}">${initials}</div>`;

    const isActive = this.isRecentlyActive(user.lastActive);
    const activeClass = isActive ? 'user-active' : 'user-inactive';
    const typingIndicator = user.isTyping ? `<span class="typing-indicator">typing...</span>` : '';

    return `
      <div class="collaborator-item ${activeClass}">
        <div class="user-avatar">
          ${avatarHTML}
          <div class="user-status-indicator" style="background-color: ${isActive ? '#4CAF50' : '#999'}"></div>
        </div>
        <div class="user-info">
          <div class="user-name">${escapeHtml(user.userName)} ${typingIndicator}</div>
          <div class="user-email">${escapeHtml(user.userEmail)}</div>
        </div>
      </div>
    `;
  }

  /**
   * Get initials from name
   */
  private getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  /**
   * Check if user was recently active (within last 30 seconds)
   */
  private isRecentlyActive(lastActive: Date): boolean {
    const now = new Date();
    const diffMs = now.getTime() - new Date(lastActive).getTime();
    return diffMs < 30000; // 30 seconds
  }


  /**
   * Clean up
   */
  destroy(): void {
    this.container.innerHTML = '';
  }
}
