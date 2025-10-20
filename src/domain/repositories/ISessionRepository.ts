/**
 * ISessionRepository
 * 
 * Interface for session metadata storage operations.
 * Implementation details are in the infrastructure layer.
 */

import { Session } from '../entities/Session.js';

export interface ISessionRepository {
  /**
   * Save a session to storage
   * @param session - The session to save
   */
  save(session: Session): Promise<void>;

  /**
   * Find a session by ID
   * @param sessionId - The session ID to find
   * @returns The session, or null if not found
   */
  findById(sessionId: string): Promise<Session | null>;

  /**
   * Find all sessions
   * @returns Array of all sessions, sorted by creation date (newest first)
   */
  findAll(): Promise<Session[]>;

  /**
   * Update a session
   * @param session - The session to update
   */
  update(session: Session): Promise<void>;

  /**
   * Delete a session
   * @param sessionId - The session ID to delete
   */
  delete(sessionId: string): Promise<void>;

  /**
   * Check if session exists
   * @param sessionId - The session ID to check
   */
  exists(sessionId: string): Promise<boolean>;
}
