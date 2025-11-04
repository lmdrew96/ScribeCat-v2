/**
 * GetSessionSharesUseCase
 *
 * Use case for retrieving all shares and invitations for a session.
 */

import { IShareRepository } from '../../../domain/repositories/IShareRepository.js';
import { Share } from '../../../domain/entities/Share.js';
import { ShareInvitation } from '../../../domain/entities/ShareInvitation.js';

export interface GetSessionSharesParams {
  sessionId: string;
}

export interface GetSessionSharesResult {
  success: boolean;
  shares?: Share[];
  invitations?: ShareInvitation[];
  error?: string;
}

export class GetSessionSharesUseCase {
  constructor(private shareRepository: IShareRepository) {}

  async execute(params: GetSessionSharesParams): Promise<GetSessionSharesResult> {
    try {
      const [shares, invitations] = await Promise.all([
        this.shareRepository.getSessionShares(params.sessionId),
        this.shareRepository.getSessionInvitations(params.sessionId)
      ]);

      return {
        success: true,
        shares,
        invitations
      };
    } catch (error) {
      console.error('Error fetching session shares:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch shares'
      };
    }
  }
}
