/**
 * LoadSessionUseCase
 * 
 * Use case for loading session data.
 */

import { ISessionRepository } from '../../domain/repositories/ISessionRepository.js';
import { Session } from '../../domain/entities/Session.js';

export class LoadSessionUseCase {
  constructor(private sessionRepository: ISessionRepository) {}

  /**
   * Load a single session by ID
   */
  async execute(sessionId: string): Promise<Session | null> {
    return await this.sessionRepository.findById(sessionId);
  }

  /**
   * Load all sessions
   */
  async loadAll(): Promise<Session[]> {
    return await this.sessionRepository.findAll();
  }
}
