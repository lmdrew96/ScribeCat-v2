/**
 * IShareRepository
 *
 * Interface for managing session shares and invitations.
 */

import { Share, ShareUser } from '../entities/Share.js';
import { ShareInvitation } from '../entities/ShareInvitation.js';
import type { PermissionLevel } from '../entities/Share.js';

export interface CreateShareParams {
  sessionId: string;
  sharedWithUserId: string;
  permissionLevel: PermissionLevel;
}

export interface CreateInvitationParams {
  sessionId: string;
  email: string;
  permissionLevel: PermissionLevel;
}

export interface IShareRepository {
  /**
   * Create a share with an existing user
   */
  createShare(params: CreateShareParams): Promise<Share>;

  /**
   * Create an invitation for a user who doesn't have an account yet
   */
  createInvitation(params: CreateInvitationParams): Promise<ShareInvitation>;

  /**
   * Get all shares for a session
   */
  getSessionShares(sessionId: string): Promise<Share[]>;

  /**
   * Get all invitations for a session
   */
  getSessionInvitations(sessionId: string): Promise<ShareInvitation[]>;

  /**
   * Get all sessions shared with the current user
   */
  getSharedWithMe(): Promise<Array<{ sessionId: string; share: Share }>>;

  /**
   * Get all pending invitations for the current user (by email)
   */
  getPendingInvitations(): Promise<ShareInvitation[]>;

  /**
   * Remove a share
   */
  removeShare(shareId: string): Promise<void>;

  /**
   * Remove an invitation
   */
  removeInvitation(invitationId: string): Promise<void>;

  /**
   * Update share permission level
   */
  updateSharePermission(shareId: string, permissionLevel: PermissionLevel): Promise<void>;

  /**
   * Accept a share (mark as accepted)
   */
  acceptShare(shareId: string): Promise<void>;

  /**
   * Accept an invitation (convert to share)
   */
  acceptInvitation(token: string): Promise<Share>;

  /**
   * Find a user by email
   */
  findUserByEmail(email: string): Promise<ShareUser | null>;

  /**
   * Check if a user has permission to access a session
   */
  hasPermission(sessionId: string, userId: string, requiredPermission?: PermissionLevel): Promise<boolean>;
}
