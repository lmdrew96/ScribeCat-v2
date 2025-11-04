/**
 * AcceptShareInvitationUseCase
 *
 * Use case for accepting a share invitation.
 */

import { IShareRepository } from '../../../domain/repositories/IShareRepository.js';
import { Share } from '../../../domain/entities/Share.js';

export interface AcceptShareInvitationParams {
  token: string;
}

export interface AcceptShareInvitationResult {
  success: boolean;
  share?: Share;
  error?: string;
}

export class AcceptShareInvitationUseCase {
  constructor(private shareRepository: IShareRepository) {}

  async execute(params: AcceptShareInvitationParams): Promise<AcceptShareInvitationResult> {
    try {
      const share = await this.shareRepository.acceptInvitation(params.token);

      return {
        success: true,
        share
      };
    } catch (error) {
      console.error('Error accepting invitation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to accept invitation'
      };
    }
  }
}
