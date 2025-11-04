/**
 * ShareSessionUseCase
 *
 * Use case for sharing a session with another user by email.
 * Creates either a direct share (if user exists) or an invitation (if user doesn't exist yet).
 */

import { IShareRepository } from '../../../domain/repositories/IShareRepository.js';
import { PermissionLevel } from '../../../domain/entities/Share.js';

export interface ShareSessionParams {
  sessionId: string;
  email: string;
  permissionLevel: PermissionLevel;
}

export interface ShareSessionResult {
  success: boolean;
  type?: 'share' | 'invitation';
  shareId?: string;
  invitationId?: string;
  error?: string;
}

export class ShareSessionUseCase {
  constructor(private shareRepository: IShareRepository) {}

  async execute(params: ShareSessionParams): Promise<ShareSessionResult> {
    try {
      // Validate email
      if (!this.isValidEmail(params.email)) {
        return {
          success: false,
          error: 'Invalid email address'
        };
      }

      // Check if user with this email exists
      const existingUser = await this.shareRepository.findUserByEmail(params.email);

      if (existingUser) {
        // User exists - create a direct share
        const share = await this.shareRepository.createShare({
          sessionId: params.sessionId,
          sharedWithUserId: existingUser.id,
          permissionLevel: params.permissionLevel
        });

        return {
          success: true,
          type: 'share',
          shareId: share.id
        };
      } else {
        // User doesn't exist - create an invitation
        const invitation = await this.shareRepository.createInvitation({
          sessionId: params.sessionId,
          email: params.email,
          permissionLevel: params.permissionLevel
        });

        return {
          success: true,
          type: 'invitation',
          invitationId: invitation.id
        };
      }
    } catch (error) {
      console.error('Error sharing session:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to share session'
      };
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
