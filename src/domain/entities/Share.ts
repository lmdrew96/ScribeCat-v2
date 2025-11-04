/**
 * Share
 *
 * Represents a session share between users.
 * Defines who has access to a session and their permission level.
 */

export type PermissionLevel = 'viewer' | 'editor';

export interface ShareUser {
  id: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
}

export class Share {
  constructor(
    public readonly id: string,
    public readonly sessionId: string,
    public readonly sharedBy: ShareUser,
    public readonly sharedWith: ShareUser,
    public readonly permissionLevel: PermissionLevel,
    public readonly createdAt: Date,
    public readonly acceptedAt?: Date
  ) {}

  /**
   * Check if the share has been accepted
   */
  isAccepted(): boolean {
    return this.acceptedAt !== undefined;
  }

  /**
   * Check if user can edit
   */
  canEdit(): boolean {
    return this.permissionLevel === 'editor';
  }

  /**
   * Check if user can only view
   */
  isViewOnly(): boolean {
    return this.permissionLevel === 'viewer';
  }

  /**
   * Get permission display name
   */
  getPermissionDisplayName(): string {
    return this.permissionLevel === 'editor' ? 'Can edit' : 'Can view';
  }
}
