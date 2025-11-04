/**
 * ShareInvitation
 *
 * Represents a pending invitation to share a session.
 * Used for email-based invitations before the recipient has an account.
 */

import { PermissionLevel, ShareUser } from './Share.js';

export class ShareInvitation {
  constructor(
    public readonly id: string,
    public readonly sessionId: string,
    public readonly sharedBy: ShareUser,
    public readonly email: string,
    public readonly permissionLevel: PermissionLevel,
    public readonly token: string,
    public readonly createdAt: Date,
    public readonly expiresAt: Date,
    public readonly acceptedAt?: Date,
    public readonly acceptedByUserId?: string
  ) {}

  /**
   * Check if the invitation has been accepted
   */
  isAccepted(): boolean {
    return this.acceptedAt !== undefined;
  }

  /**
   * Check if the invitation has expired
   */
  isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  /**
   * Check if the invitation is still valid
   */
  isValid(): boolean {
    return !this.isAccepted() && !this.isExpired();
  }

  /**
   * Get days until expiration
   */
  getDaysUntilExpiration(): number {
    const now = new Date();
    const diff = this.expiresAt.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }
}
