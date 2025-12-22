/**
 * SessionSharingManager
 *
 * Manages session sharing and permission checking in the renderer process.
 * Handles creating shares, checking access, and updating permissions.
 */

import { createLogger } from '../../shared/logger.js';

const logger = createLogger('SessionSharingManager');

export interface SessionShare {
  id: string;
  sessionId: string;
  sharedByUserId: string;
  sharedWithUserId: string;
  sharedWithEmail: string;
  permissionLevel: 'viewer' | 'editor';
  createdAt: Date;
}

export interface SessionAccessInfo {
  hasAccess: boolean;
  permission: 'owner' | 'editor' | 'viewer' | null;
  isShared: boolean;
  isOwner: boolean;
}

export interface ShareSessionParams {
  sessionId: string;
  email: string;
  permissionLevel: 'viewer' | 'editor';
}

export class SessionSharingManager {
  constructor() {
    // Session sharing manager ready
  }

  /**
   * Check if current user has access to a session
   */
  async checkSessionAccess(sessionId: string): Promise<SessionAccessInfo> {
    try {
      const result = await window.scribeCat.share.checkAccess(sessionId);

      if (!result.success) {
        return {
          hasAccess: false,
          permission: null,
          isShared: false,
          isOwner: false
        };
      }

      return {
        hasAccess: result.hasAccess,
        permission: result.permission,
        isShared: result.isShared,
        isOwner: result.isOwner
      };
    } catch (error) {
      logger.error('Error checking session access:', error);
      return {
        hasAccess: false,
        permission: null,
        isShared: false,
        isOwner: false
      };
    }
  }

  /**
   * Share a session with another user
   */
  async shareSession(params: ShareSessionParams): Promise<{ success: boolean; error?: string; share?: SessionShare }> {
    try {
      const result = await window.scribeCat.share.create(params);

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to share session'
        };
      }

      return {
        success: true,
        share: result.share
      };
    } catch (error) {
      logger.error('Error sharing session:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get all shares for a session (owner only)
   */
  async getSessionShares(sessionId: string): Promise<{ success: boolean; shares?: SessionShare[]; error?: string }> {
    try {
      const result = await window.scribeCat.share.getSessionShares(sessionId);

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to get shares'
        };
      }

      return {
        success: true,
        shares: result.shares || []
      };
    } catch (error) {
      logger.error('Error getting session shares:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get all sessions shared with current user
   */
  async getSharedWithMe(): Promise<{ success: boolean; sessions?: any[]; error?: string }> {
    try {
      const result = await window.scribeCat.share.getSharedWithMe();

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to get shared sessions'
        };
      }

      return {
        success: true,
        sessions: result.sessions || []
      };
    } catch (error) {
      logger.error('Error getting shared sessions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update share permission
   */
  async updateSharePermission(shareId: string, permissionLevel: 'viewer' | 'editor'): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await window.scribeCat.share.updatePermission({ shareId, permissionLevel });

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to update permission'
        };
      }

      return { success: true };
    } catch (error) {
      logger.error('Error updating permission:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Revoke access (remove share)
   */
  async revokeAccess(shareId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await window.scribeCat.share.remove({ shareId });

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to revoke access'
        };
      }

      return { success: true };
    } catch (error) {
      logger.error('Error revoking access:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check if session is owned by current user
   */
  async isSessionOwner(sessionId: string): Promise<boolean> {
    const accessInfo = await this.checkSessionAccess(sessionId);
    return accessInfo.isOwner;
  }

  /**
   * Check if user can edit session
   */
  async canEdit(sessionId: string): Promise<boolean> {
    const accessInfo = await this.checkSessionAccess(sessionId);
    return accessInfo.hasAccess && (accessInfo.permission === 'owner' || accessInfo.permission === 'editor');
  }

  /**
   * Check if user can view session
   */
  async canView(sessionId: string): Promise<boolean> {
    const accessInfo = await this.checkSessionAccess(sessionId);
    return accessInfo.hasAccess;
  }
}
