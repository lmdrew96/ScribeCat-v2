/**
 * FileSessionRepository
 * 
 * File system implementation of ISessionRepository.
 * Handles session metadata storage as JSON files.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import electron from 'electron';
import { ISessionRepository } from '../../domain/repositories/ISessionRepository.js';
import { Session } from '../../domain/entities/Session.js';

export class FileSessionRepository implements ISessionRepository {
  private sessionsDir: string;
  private directoryInitialized: boolean = false;
  private userId: string | null = null;

  constructor() {
    const userDataPath = electron.app.getPath('userData');
    this.sessionsDir = path.join(userDataPath, 'sessions');
  }

  /**
   * Set the current user ID for filtering sessions
   * When set, only sessions belonging to this user will be returned by findAll()
   */
  setUserId(userId: string | null): void {
    console.log('FileSessionRepository.setUserId called with:', userId);
    this.userId = userId;
  }

  /**
   * Ensure sessions directory exists (lazy initialization)
   */
  private async ensureDirectory(): Promise<void> {
    if (this.directoryInitialized) {
      return;
    }
    
    try {
      await fs.access(this.sessionsDir);
      this.directoryInitialized = true;
    } catch {
      await fs.mkdir(this.sessionsDir, { recursive: true });
      this.directoryInitialized = true;
    }
  }

  /**
   * Get session file path
   */
  private getSessionPath(sessionId: string): string {
    return path.join(this.sessionsDir, `${sessionId}.json`);
  }

  /**
   * Save a session to file system
   */
  async save(session: Session): Promise<void> {
    await this.ensureDirectory();

    const sessionPath = this.getSessionPath(session.id);
    const sessionJSON = session.toJSON();

    console.log('💾 FileSessionRepository.save - Saving session:', {
      sessionId: session.id,
      path: sessionPath,
      hasTranscription: !!sessionJSON.transcription,
      transcriptionSegmentCount: sessionJSON.transcription?.segments?.length,
      transcriptionFullTextLength: sessionJSON.transcription?.fullText?.length
    });

    const jsonData = JSON.stringify(sessionJSON, null, 2);

    await fs.writeFile(sessionPath, jsonData, 'utf-8');

    console.log('✅ FileSessionRepository.save - File written successfully');
  }

  /**
   * Find a session by ID (excludes soft-deleted sessions)
   */
  async findById(sessionId: string): Promise<Session | null> {
    try {
      const sessionPath = this.getSessionPath(sessionId);
      const data = await fs.readFile(sessionPath, 'utf-8');
      const sessionData = JSON.parse(data);
      const session = Session.fromJSON(sessionData);

      // Exclude soft-deleted sessions
      if (session.deletedAt) {
        return null;
      }

      return session;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Find all sessions
   * If userId is set, only returns sessions belonging to that user
   */
  async findAll(): Promise<Session[]> {
    await this.ensureDirectory();

    try {
      const files = await fs.readdir(this.sessionsDir);
      const sessions: Session[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const sessionPath = path.join(this.sessionsDir, file);
            const data = await fs.readFile(sessionPath, 'utf-8');

            // Skip empty files
            if (!data || data.trim().length === 0) {
              console.warn(`Skipping empty session file: ${file}`);
              continue;
            }

            const sessionData = JSON.parse(data);
            const session = Session.fromJSON(sessionData);

            // Skip soft-deleted sessions
            if (session.deletedAt) {
              continue;
            }

            // Filter by userId for multi-user support
            // When logged out (userId is null), hide all sessions
            if (this.userId === null) {
              continue; // Skip all sessions when logged out
            }

            // When logged in, show:
            // 1. Sessions that belong to the current user
            // 2. Orphaned sessions (userId = undefined) that can be claimed
            // Never show sessions from other users
            if (session.userId !== undefined && session.userId !== this.userId) {
              continue; // Skip sessions from other users
            }

            sessions.push(session);
          } catch (fileError) {
            // Log individual file error but continue loading other sessions
            console.error(`Failed to load session from ${file}:`, fileError);
            // Continue to next file instead of failing completely
            continue;
          }
        }
      }

      // Sort by creation date, newest first
      return sessions.sort((a, b) =>
        b.createdAt.getTime() - a.createdAt.getTime()
      );
    } catch (error) {
      // Only throw if we can't read the directory itself
      if (error instanceof Error) {
        throw new Error(`Failed to read sessions directory: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Update a session
   */
  async update(session: Session): Promise<void> {
    // Same as save - overwrites the file
    await this.save(session);
  }

  /**
   * Delete a session (soft delete)
   */
  async delete(sessionId: string): Promise<void> {
    try {
      // Load the session
      const session = await this.findById(sessionId);
      if (!session) {
        // Session doesn't exist, consider it deleted
        return;
      }

      // Mark as deleted by setting deletedAt
      session.deletedAt = new Date();
      session.updatedAt = new Date();

      // Save the session with deletedAt set
      await this.save(session);
    } catch (error) {
      console.error('Error soft-deleting session:', error);
      throw error;
    }
  }

  /**
   * Check if session exists
   */
  async exists(sessionId: string): Promise<boolean> {
    try {
      const sessionPath = this.getSessionPath(sessionId);
      await fs.access(sessionPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Restore a soft-deleted session from trash
   */
  async restore(sessionId: string): Promise<void> {
    try {
      const sessionPath = this.getSessionPath(sessionId);
      const data = await fs.readFile(sessionPath, 'utf-8');
      const sessionData = JSON.parse(data);
      const session = Session.fromJSON(sessionData);

      // Remove deletedAt and update timestamp
      session.deletedAt = undefined;
      session.updatedAt = new Date();

      // Save the restored session
      await this.save(session);
    } catch (error) {
      console.error('Error restoring session:', error);
      throw error;
    }
  }

  /**
   * Find all soft-deleted sessions
   */
  async findDeleted(userId?: string): Promise<Session[]> {
    await this.ensureDirectory();

    try {
      const files = await fs.readdir(this.sessionsDir);
      const deletedSessions: Session[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const sessionPath = path.join(this.sessionsDir, file);
            const data = await fs.readFile(sessionPath, 'utf-8');

            // Skip empty files
            if (!data || data.trim().length === 0) {
              continue;
            }

            const sessionData = JSON.parse(data);
            const session = Session.fromJSON(sessionData);

            // Only include sessions with deletedAt set
            if (!session.deletedAt) {
              continue;
            }

            // Filter by userId for multi-user support
            if (this.userId === null) {
              continue; // Skip all sessions when logged out
            }

            // Filter by user
            if (session.userId !== undefined && session.userId !== this.userId) {
              continue; // Skip sessions from other users
            }

            deletedSessions.push(session);
          } catch (fileError) {
            console.error(`Failed to load session from ${file}:`, fileError);
            continue;
          }
        }
      }

      // Sort by deletion date, newest first
      return deletedSessions.sort((a, b) => {
        if (!a.deletedAt || !b.deletedAt) return 0;
        return b.deletedAt.getTime() - a.deletedAt.getTime();
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to read sessions directory: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Permanently delete a session (hard delete)
   * This physically removes the JSON file from the file system
   */
  async permanentlyDelete(sessionId: string): Promise<void> {
    try {
      const sessionPath = this.getSessionPath(sessionId);
      await fs.unlink(sessionPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      // File doesn't exist, consider it deleted
    }
  }
}
