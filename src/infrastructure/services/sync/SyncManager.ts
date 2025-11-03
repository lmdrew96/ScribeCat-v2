/**
 * SyncManager
 *
 * Coordinates synchronization between local and cloud storage.
 * Handles session uploads, downloads, and conflict resolution.
 *
 * Features:
 * - Automatic upload after recording
 * - Offline queue for pending syncs
 * - Conflict resolution (last-write-wins)
 * - Sync status tracking
 */

import { Session } from '../../../domain/entities/Session.js';
import { ISessionRepository } from '../../../domain/repositories/ISessionRepository.js';
import { SupabaseStorageService } from '../supabase/SupabaseStorageService.js';
import * as fs from 'fs/promises';

export enum SyncStatus {
  NOT_SYNCED = 'not_synced',
  SYNCING = 'syncing',
  SYNCED = 'synced',
  FAILED = 'failed',
  QUEUED = 'queued'
}

export interface SyncQueueItem {
  sessionId: string;
  audioFilePath: string;
  timestamp: Date;
  retryCount: number;
}

export class SyncManager {
  private syncQueue: Map<string, SyncQueueItem> = new Map();
  private syncStatus: Map<string, SyncStatus> = new Map();
  private isOnline: boolean = true;
  private syncInProgress: Set<string> = new Set();

  constructor(
    private localRepository: ISessionRepository,
    private remoteRepository: ISessionRepository,
    private storageService: SupabaseStorageService,
    private currentUserId: string | null = null
  ) {
    // Monitor online/offline status
    this.setupConnectivityMonitoring();
  }

  /**
   * Set the current user ID for uploads
   */
  setCurrentUserId(userId: string | null): void {
    this.currentUserId = userId;
  }

  /**
   * Upload a session to the cloud
   * This is called automatically after a recording completes
   */
  async uploadSession(session: Session): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.currentUserId) {
        return {
          success: false,
          error: 'User not authenticated'
        };
      }

      // Check if we're online
      if (!this.isOnline) {
        this.queueForSync(session.id, session.recordingPath);
        this.updateSyncStatus(session.id, SyncStatus.QUEUED);
        return {
          success: false,
          error: 'Offline - queued for sync'
        };
      }

      // Mark as syncing
      this.updateSyncStatus(session.id, SyncStatus.SYNCING);
      this.syncInProgress.add(session.id);

      try {
        // 1. Upload session metadata to database
        await this.remoteRepository.save(session);

        // 2. Upload audio file to storage
        const audioData = await this.readAudioFile(session.recordingPath);
        const fileName = this.getFileNameFromPath(session.recordingPath);

        const uploadResult = await this.storageService.uploadAudioFile({
          sessionId: session.id,
          userId: this.currentUserId,
          audioData,
          fileName,
          mimeType: 'audio/webm'
        });

        if (!uploadResult.success) {
          throw new Error(uploadResult.error || 'Failed to upload audio');
        }

        // Success!
        this.updateSyncStatus(session.id, SyncStatus.SYNCED);
        this.removeFromQueue(session.id);

        return { success: true };
      } finally {
        this.syncInProgress.delete(session.id);
      }
    } catch (error) {
      this.updateSyncStatus(session.id, SyncStatus.FAILED);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during upload'
      };
    }
  }

  /**
   * Download a session from the cloud
   */
  async downloadSession(sessionId: string): Promise<{
    success: boolean;
    session?: Session;
    error?: string;
  }> {
    try {
      // Fetch session metadata
      const session = await this.remoteRepository.findById(sessionId);
      if (!session) {
        return {
          success: false,
          error: 'Session not found in cloud'
        };
      }

      // Save to local storage
      await this.localRepository.save(session);

      return {
        success: true,
        session
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during download'
      };
    }
  }

  /**
   * Sync all sessions from cloud
   * Downloads sessions that don't exist locally
   */
  async syncAllFromCloud(): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      // Fetch all remote sessions
      const remoteSessions = await this.remoteRepository.findAll();
      const localSessions = await this.localRepository.findAll();

      // Create a set of local session IDs for quick lookup
      const localSessionIds = new Set(localSessions.map(s => s.id));

      let downloadedCount = 0;

      // Download sessions that don't exist locally
      for (const remoteSession of remoteSessions) {
        if (!localSessionIds.has(remoteSession.id)) {
          await this.localRepository.save(remoteSession);
          downloadedCount++;
        } else {
          // Session exists locally - check for conflicts
          const localSession = localSessions.find(s => s.id === remoteSession.id);
          if (localSession) {
            await this.resolveConflict(localSession, remoteSession);
          }
        }
      }

      return {
        success: true,
        count: downloadedCount
      };
    } catch (error) {
      return {
        success: false,
        count: 0,
        error: error instanceof Error ? error.message : 'Unknown error during sync'
      };
    }
  }

  /**
   * Resolve conflict between local and remote session
   * Uses last-write-wins strategy
   */
  private async resolveConflict(localSession: Session, remoteSession: Session): Promise<void> {
    // Last-write-wins: Use the session with the most recent updatedAt
    if (remoteSession.updatedAt > localSession.updatedAt) {
      // Remote is newer - update local
      await this.localRepository.update(remoteSession);
    } else if (localSession.updatedAt > remoteSession.updatedAt) {
      // Local is newer - update remote
      await this.remoteRepository.update(localSession);
    }
    // If equal, no action needed
  }

  /**
   * Add session to offline sync queue
   */
  private queueForSync(sessionId: string, audioFilePath: string): void {
    this.syncQueue.set(sessionId, {
      sessionId,
      audioFilePath,
      timestamp: new Date(),
      retryCount: 0
    });
  }

  /**
   * Remove session from sync queue
   */
  private removeFromQueue(sessionId: string): void {
    this.syncQueue.delete(sessionId);
  }

  /**
   * Process offline sync queue
   * Called when connection is restored
   */
  async processQueue(): Promise<void> {
    if (!this.isOnline || this.syncQueue.size === 0) {
      return;
    }

    const queuedItems = Array.from(this.syncQueue.values());

    for (const item of queuedItems) {
      // Skip if already syncing
      if (this.syncInProgress.has(item.sessionId)) {
        continue;
      }

      // Find session in local storage
      const session = await this.localRepository.findById(item.sessionId);
      if (!session) {
        this.removeFromQueue(item.sessionId);
        continue;
      }

      // Attempt upload
      const result = await this.uploadSession(session);

      if (!result.success) {
        // Increment retry count
        item.retryCount++;

        // Remove from queue after 3 failed attempts
        if (item.retryCount >= 3) {
          this.removeFromQueue(item.sessionId);
          this.updateSyncStatus(item.sessionId, SyncStatus.FAILED);
        }
      }
    }
  }

  /**
   * Get sync status for a session
   */
  getSyncStatus(sessionId: string): SyncStatus {
    return this.syncStatus.get(sessionId) || SyncStatus.NOT_SYNCED;
  }

  /**
   * Update sync status for a session
   */
  private updateSyncStatus(sessionId: string, status: SyncStatus): void {
    this.syncStatus.set(sessionId, status);
  }

  /**
   * Get count of sessions in queue
   */
  getQueueSize(): number {
    return this.syncQueue.size;
  }

  /**
   * Check if online
   */
  isConnected(): boolean {
    return this.isOnline;
  }

  /**
   * Setup connectivity monitoring
   */
  private setupConnectivityMonitoring(): void {
    // For Node.js environment (main process), we can't use navigator.onLine
    // We'll assume online by default and rely on error handling
    // In a production app, you might ping a health endpoint periodically

    // For now, just set to true
    this.isOnline = true;

    // Process queue every 30 seconds
    setInterval(() => {
      this.processQueue().catch(error => {
        console.error('Error processing sync queue:', error);
      });
    }, 30000);
  }

  /**
   * Read audio file from local filesystem
   */
  private async readAudioFile(filePath: string): Promise<ArrayBuffer> {
    try {
      const buffer = await fs.readFile(filePath);
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    } catch (error) {
      console.error('Error reading audio file:', error);
      throw new Error(`Failed to read audio file: ${filePath}`);
    }
  }

  /**
   * Extract filename from path
   */
  private getFileNameFromPath(filePath: string): string {
    const parts = filePath.split('/');
    return parts[parts.length - 1];
  }

  /**
   * Manually trigger sync for a session
   */
  async retrySync(sessionId: string): Promise<{ success: boolean; error?: string }> {
    const session = await this.localRepository.findById(sessionId);
    if (!session) {
      return {
        success: false,
        error: 'Session not found'
      };
    }

    return await this.uploadSession(session);
  }
}
