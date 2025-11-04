/**
 * GetSharedSessionsUseCase
 *
 * Use case for retrieving all sessions shared with the current user.
 */

import { IShareRepository } from '../../../domain/repositories/IShareRepository.js';
import { Share } from '../../../domain/entities/Share.js';

export interface SharedSession {
  sessionId: string;
  share: Share;
}

export interface GetSharedSessionsResult {
  success: boolean;
  sharedSessions?: SharedSession[];
  error?: string;
}

export class GetSharedSessionsUseCase {
  constructor(private shareRepository: IShareRepository) {}

  async execute(): Promise<GetSharedSessionsResult> {
    try {
      const sharedSessions = await this.shareRepository.getSharedWithMe();

      return {
        success: true,
        sharedSessions
      };
    } catch (error) {
      console.error('Error fetching shared sessions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch shared sessions'
      };
    }
  }
}
