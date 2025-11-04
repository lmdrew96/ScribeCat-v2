/**
 * RemoveShareUseCase
 *
 * Use case for removing a share or invitation.
 */

import { IShareRepository } from '../../../domain/repositories/IShareRepository.js';

export interface RemoveShareParams {
  shareId?: string;
  invitationId?: string;
}

export interface RemoveShareResult {
  success: boolean;
  error?: string;
}

export class RemoveShareUseCase {
  constructor(private shareRepository: IShareRepository) {}

  async execute(params: RemoveShareParams): Promise<RemoveShareResult> {
    try {
      if (params.shareId) {
        await this.shareRepository.removeShare(params.shareId);
      } else if (params.invitationId) {
        await this.shareRepository.removeInvitation(params.invitationId);
      } else {
        return {
          success: false,
          error: 'Either shareId or invitationId must be provided'
        };
      }

      return { success: true };
    } catch (error) {
      console.error('Error removing share:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove share'
      };
    }
  }
}
