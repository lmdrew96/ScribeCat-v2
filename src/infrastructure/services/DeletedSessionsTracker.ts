/**
 * DeletedSessionsTracker
 *
 * Tracks session IDs that have been deleted locally to prevent
 * them from being re-downloaded during cloud sync.
 *
 * This solves the problem where:
 * 1. User deletes a session
 * 2. Cloud deletion fails (network issue, etc.)
 * 3. Sync re-downloads the session because it's "missing" locally
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';

interface DeletedSessionsData {
  deletedSessionIds: string[];
  lastUpdated: string;
}

export class DeletedSessionsTracker {
  private deletedSessionIds: Set<string> = new Set();
  private filePath: string;
  private isInitialized: boolean = false;

  constructor() {
    // Store in app data directory alongside sessions
    const userDataPath = app.getPath('userData');
    this.filePath = path.join(userDataPath, 'deleted-sessions.json');
  }

  /**
   * Initialize by loading deleted session IDs from disk
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      const exists = await this.fileExists(this.filePath);
      if (exists) {
        const content = await fs.readFile(this.filePath, 'utf-8');
        const data: DeletedSessionsData = JSON.parse(content);
        this.deletedSessionIds = new Set(data.deletedSessionIds || []);
        console.log(`Loaded ${this.deletedSessionIds.size} deleted session IDs`);
      }
    } catch (error) {
      console.warn('Failed to load deleted sessions tracker:', error);
      // Start with empty set if file doesn't exist or is corrupted
      this.deletedSessionIds = new Set();
    }

    this.isInitialized = true;
  }

  /**
   * Mark a session as deleted
   */
  async markAsDeleted(sessionId: string): Promise<void> {
    await this.initialize();

    if (!this.deletedSessionIds.has(sessionId)) {
      this.deletedSessionIds.add(sessionId);
      await this.persist();
      console.log(`Marked session ${sessionId} as deleted (total: ${this.deletedSessionIds.size})`);
    }
  }

  /**
   * Check if a session has been deleted
   */
  async isDeleted(sessionId: string): Promise<boolean> {
    await this.initialize();
    return this.deletedSessionIds.has(sessionId);
  }

  /**
   * Remove a session from the deleted list (e.g., if user restores it or re-creates it)
   * Alias for unmarkAsDeleted for better API consistency
   */
  async remove(sessionId: string): Promise<void> {
    return this.unmarkAsDeleted(sessionId);
  }

  /**
   * Remove a session from the deleted list (e.g., if user restores it or re-creates it)
   */
  async unmarkAsDeleted(sessionId: string): Promise<void> {
    await this.initialize();

    if (this.deletedSessionIds.has(sessionId)) {
      this.deletedSessionIds.delete(sessionId);
      await this.persist();
      console.log(`Unmarked session ${sessionId} as deleted`);
    }
  }

  /**
   * Clear all deleted session IDs (useful for testing or reset)
   */
  async clear(): Promise<void> {
    this.deletedSessionIds.clear();
    await this.persist();
    console.log('Cleared all deleted session IDs');
  }

  /**
   * Get count of tracked deleted sessions
   */
  async getCount(): Promise<number> {
    await this.initialize();
    return this.deletedSessionIds.size;
  }

  /**
   * Persist deleted session IDs to disk
   */
  private async persist(): Promise<void> {
    try {
      const data: DeletedSessionsData = {
        deletedSessionIds: Array.from(this.deletedSessionIds),
        lastUpdated: new Date().toISOString()
      };

      await fs.writeFile(
        this.filePath,
        JSON.stringify(data, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('Failed to persist deleted sessions tracker:', error);
      throw error;
    }
  }

  /**
   * Check if a file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
