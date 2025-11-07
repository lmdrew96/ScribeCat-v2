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
import { DeletedSessionsTracker } from '../DeletedSessionsTracker.js';
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
    private currentUserId: string | null = null,
    private deletedTracker?: DeletedSessionsTracker
  ) {
    // Monitor online/offline status
    this.setupConnectivityMonitoring();
  }

  /**
   * Set the current user ID for uploads
   */
  setCurrentUserId(userId: string | null): void {
    this.currentUserId = userId;
    // Also update the remote repository so it can save sessions
    if ('setUserId' in this.remoteRepository) {
      (this.remoteRepository as any).setUserId(userId);
    }
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

      // CRITICAL: Check if sync is already in progress for this session
      if (this.syncInProgress.has(session.id)) {
        console.log(`⏭️ Sync already in progress for session ${session.id}, skipping duplicate request`);
        return {
          success: false,
          error: 'Sync already in progress'
        };
      }

      // Mark as syncing
      this.updateSyncStatus(session.id, SyncStatus.SYNCING);
      this.syncInProgress.add(session.id);

      try {
        // IMPORTANT: Reload session from local repository to ensure we have the latest version
        // This is critical because transcription may have been added after the session was initially loaded
        console.log('🔄 SyncManager.uploadSession - Reloading session to get latest data...');
        const latestSession = await this.localRepository.findById(session.id);
        if (!latestSession) {
          throw new Error(`Session ${session.id} not found in local repository`);
        }

        console.log('📤 SyncManager.uploadSession - Uploading session:', {
          sessionId: latestSession.id,
          hasTranscription: !!latestSession.transcription,
          transcriptionSegmentCount: latestSession.transcription?.segments.length
        });

        // Store the current state to verify nothing changes locally if remote fails
        const transcriptionSnapshot = latestSession.transcription;

        // Upload session (including transcription via dual storage)
        // Note: repository.save() now handles uploading transcription to BOTH Storage and database
        console.log('📡 SyncManager - Attempting remote save...');
        try {
          await this.remoteRepository.save(latestSession);
          console.log('✅ SyncManager - Remote save succeeded');
        } catch (remoteError) {
          console.error('❌ SyncManager - Remote save failed:', remoteError);
          // CRITICAL: Do NOT touch local data if remote save fails
          // Just mark as failed and throw
          throw remoteError;
        }

        // 3. Upload audio file to storage
        console.log('📡 SyncManager - Attempting audio upload...');
        const audioData = await this.readAudioFile(latestSession.recordingPath);
        const fileName = this.getFileNameFromPath(latestSession.recordingPath);

        const uploadResult = await this.storageService.uploadAudioFile({
          sessionId: latestSession.id,
          userId: this.currentUserId,
          audioData,
          fileName,
          mimeType: 'audio/webm'
        });

        if (!uploadResult.success) {
          console.error('❌ SyncManager - Audio upload failed:', uploadResult.error);
          throw new Error(uploadResult.error || 'Failed to upload audio');
        }
        console.log('✅ SyncManager - Audio upload succeeded');

        // SUCCESS! Both remote save and audio upload completed successfully
        // NOW it's safe to update the local file with sync status
        console.log('✅ SyncManager - Both remote operations succeeded, updating local sync status...');

        // Verify transcription is still intact before updating
        if (transcriptionSnapshot && !latestSession.transcription) {
          console.error('⚠️ CRITICAL: Transcription was lost during sync! Restoring...');
          latestSession.addTranscription(transcriptionSnapshot);
        }

        latestSession.markAsSynced(latestSession.id); // Use session ID as cloudId
        latestSession.userId = this.currentUserId;
        await this.localRepository.update(latestSession);

        console.log('✅ SyncManager.uploadSession - Session synced successfully with transcription intact');

        this.updateSyncStatus(latestSession.id, SyncStatus.SYNCED);
        this.removeFromQueue(latestSession.id);

        return { success: true };
      } catch (syncError) {
        // If ANY error occurred during sync, DO NOT touch the local file
        // Just mark as failed and return error
        console.error('❌ SyncManager.uploadSession - Sync failed, local data preserved:', syncError);
        throw syncError; // Re-throw to outer catch
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
      // Fetch session metadata from database
      // Note: repository.findById() automatically loads transcription via dual storage (Storage + database fallback)
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

      // Download sessions that don't exist locally AND haven't been deleted
      for (const remoteSession of remoteSessions) {
        if (!localSessionIds.has(remoteSession.id)) {
          // Check if this session was intentionally deleted locally
          const wasDeleted = this.deletedTracker ? await this.deletedTracker.isDeleted(remoteSession.id) : false;

          if (wasDeleted) {
            console.log(`Skipping download of session ${remoteSession.id} - it was deleted locally`);
            continue;
          }

          // Session doesn't exist locally and wasn't deleted - download it
          // Note: remoteSession already has transcription loaded via dual storage by repository.findAll()
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
