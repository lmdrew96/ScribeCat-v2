/**
 * SupabaseSessionRepository
 *
 * Implementation of ISessionRepository using Supabase with RLS policies.
 * Audio files are handled separately by SupabaseStorageService.
 */

import { Session, SyncStatus, SessionType } from '../../domain/entities/Session.js';
import { Transcription } from '../../domain/entities/Transcription.js';
import { ISessionRepository } from '../../domain/repositories/ISessionRepository.js';
import { SupabaseClient } from '../services/supabase/SupabaseClient.js';
import { SupabaseStorageService } from '../services/supabase/SupabaseStorageService.js';
import { compressJSON } from '../../shared/utils/compressionUtils.js';
import { createLogger } from '../../shared/logger.js';

const logger = createLogger('SupabaseSessionRepository');

interface SessionRow {
  id: string;
  user_id: string;
  title: string;
  notes: string;
  created_at: string;
  updated_at: string;
  duration: number;
  transcription_text?: string; // JSON string (backward compatibility)
  has_transcription?: boolean; // Transcription file exists in Storage
  transcription_provider?: string;
  transcription_language?: string;
  transcription_confidence?: number;
  transcription_timestamp?: string;
  tags: string[];
  course_id?: string;
  course_title?: string;
  course_number?: string;
  deleted_at?: string | null;
  type?: string; // 'single' | 'multi-session-study-set'
  child_session_ids?: string[];
  session_order?: number;
  summary?: string;
  source_session_id?: string; // For copied sessions, the original session ID
  source_user_id?: string; // For copied sessions, the original user ID (for audio path)
  is_room_only?: boolean; // True if session is created for study room and shouldn't appear in study mode
}

export class SupabaseSessionRepository implements ISessionRepository {
  private tableName = 'sessions';
  private userId: string | null = null;
  private storageService: SupabaseStorageService;

  constructor(storageService?: SupabaseStorageService) {
    this.storageService = storageService || new SupabaseStorageService();
  }

  /** Set the current user ID for this repository (required before save/update) */
  setUserId(userId: string | null): void {
    if (userId && typeof userId !== 'string') {
      throw new Error(`userId must be a string, got ${typeof userId}`);
    }
    this.userId = userId;
  }

  /** Save a session to Supabase (DUAL STORAGE: Storage + database) */
  async save(session: Session): Promise<void> {
    try {
      if (!this.userId) {
        throw new Error('User ID not set. Call setUserId() before save()');
      }

      const client = SupabaseClient.getInstance().getClient();

      // DUAL STORAGE: Compress and check size of transcription
      let storageUploadSuccess = false;
      let transcriptionJson: string | null = null;
      const MAX_DB_SIZE = 7 * 1024 * 1024; // 7MB safety margin

      if (session.transcription) {
        // Compress transcription data first to get accurate size
        const compressionResult = compressJSON(session.transcription.toJSON());
        const compressedSize = compressionResult.compressedSize;

        logger.info(
          `Session ${session.id} transcription: ${(compressionResult.originalSize / 1024 / 1024).toFixed(2)}MB → ${(compressedSize / 1024 / 1024).toFixed(2)}MB (${compressionResult.compressionRatio.toFixed(1)}% reduction)`
        );

        // If compressed transcription is still too large for database, Storage upload is MANDATORY
        const requiresStorage = compressedSize >= MAX_DB_SIZE;

        // Upload to Storage (always upload compressed version for better performance)
        const uploadResult = await this.storageService.uploadTranscriptionFile({
          sessionId: session.id,
          userId: this.userId,
          transcriptionData: session.transcription.toJSON()
        });

        if (uploadResult.success) {
          storageUploadSuccess = true;
          logger.info(`Storage upload successful for session ${session.id}`);
        } else {
          // FAIL FAST: If transcription requires Storage (too big for DB) and upload failed, throw error
          if (requiresStorage) {
            throw new Error(
              `Transcription too large for database (${(compressedSize / 1024 / 1024).toFixed(2)}MB) and Storage upload failed: ${uploadResult.error}. Cannot save session without losing transcription data.`
            );
          }

          // If small enough for DB, warn but continue (will save to DB as backup)
          logger.warn(
            `Storage upload failed for session ${session.id}, but transcription fits in database. Continuing with DB-only storage.`,
            uploadResult.error
          );
        }

        // Store in database if small enough (even if Storage succeeded - provides faster access)
        if (!requiresStorage) {
          transcriptionJson = JSON.stringify(session.transcription.toJSON());
        }
      }

      const row: Partial<SessionRow> = {
        id: session.id,
        user_id: this.userId,
        title: session.title,
        notes: session.notes,
        duration: Math.round(session.duration * 1000),
        tags: session.tags,
        course_id: session.courseId,
        course_title: session.courseTitle,
        course_number: session.courseNumber,
        updated_at: session.updatedAt.toISOString(),
        transcription_text: transcriptionJson,
        has_transcription: storageUploadSuccess,
        transcription_provider: session.transcription?.provider,
        transcription_language: session.transcription?.language,
        transcription_confidence: session.transcription?.averageConfidence,
        transcription_timestamp: session.transcription?.createdAt?.toISOString(),
        type: session.type,
        child_session_ids: session.childSessionIds,
        session_order: session.sessionOrder,
        summary: session.summary
      };

      const { error } = await client
        .from(this.tableName)
        .upsert(row, {
          onConflict: 'id',
          ignoreDuplicates: false
        });

      if (error) {
        throw new Error(`Failed to save session: ${error.message}`);
      }
    } catch (error) {
      console.error('Error saving session:', error);
      throw error;
    }
  }

  /** Find a session by ID */
  async findById(sessionId: string): Promise<Session | null> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      const { data, error } = await client
        .from(this.tableName)
        .select('*')
        .eq('id', sessionId)
        .is('deleted_at', null)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // Not found
          return null;
        }
        throw new Error(`Failed to find session: ${error.message}`);
      }

      const session = this.rowToSession(data as SessionRow);

      // DUAL STORAGE: Load transcription from Storage OR database
      if (session && (data.has_transcription || data.transcription_text) && data.user_id) {
        await this.loadTranscription(session, data as SessionRow);
      }

      return session;
    } catch (error) {
      console.error('Error finding session:', error);
      return null;
    }
  }

  /**
   * Find all sessions for the current user
   */
  async findAll(): Promise<Session[]> {
    try {
      // When logged out (userId is null), return no sessions
      if (this.userId === null) {
        return [];
      }

      const client = SupabaseClient.getInstance().getClient();

      // Query only sessions for the current user
      const { data, error } = await client
        .from(this.tableName)
        .select('*')
        .eq('user_id', this.userId)
        .is('deleted_at', null)
        .neq('is_room_only', true) // Exclude room-only sessions from study mode
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch sessions: ${error.message}`);
      }

      const sessions = (data as SessionRow[]).map(row => this.rowToSession(row));

      // DUAL STORAGE: Load transcriptions for all sessions that have them
      await Promise.all(
        sessions.map(async (session, index) => {
          const row = data[index];
          if ((row.has_transcription || row.transcription_text) && row.user_id) {
            await this.loadTranscription(session, row);
          }
        })
      );

      return sessions;
    } catch (error) {
      console.error('Error finding all sessions:', error);
      return [];
    }
  }

  /**
   * Update a session (DUAL STORAGE: Storage + database)
   */
  async update(session: Session): Promise<void> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      // DUAL STORAGE: Compress and check size of transcription
      let storageUploadSuccess = false;
      let transcriptionJson: string | null = null;
      const MAX_DB_SIZE = 7 * 1024 * 1024; // 7MB safety margin

      if (session.transcription && session.userId) {
        // Compress transcription data first to get accurate size
        const compressionResult = compressJSON(session.transcription.toJSON());
        const compressedSize = compressionResult.compressedSize;

        logger.info(
          `Session ${session.id} transcription update: ${(compressionResult.originalSize / 1024 / 1024).toFixed(2)}MB → ${(compressedSize / 1024 / 1024).toFixed(2)}MB (${compressionResult.compressionRatio.toFixed(1)}% reduction)`
        );

        // If compressed transcription is still too large for database, Storage upload is MANDATORY
        const requiresStorage = compressedSize >= MAX_DB_SIZE;

        // Upload to Storage (always upload compressed version for better performance)
        const uploadResult = await this.storageService.uploadTranscriptionFile({
          sessionId: session.id,
          userId: session.userId,
          transcriptionData: session.transcription.toJSON()
        });

        if (uploadResult.success) {
          storageUploadSuccess = true;
          logger.info(`Storage upload successful for session ${session.id}`);
        } else {
          // FAIL FAST: If transcription requires Storage (too big for DB) and upload failed, throw error
          if (requiresStorage) {
            throw new Error(
              `Transcription too large for database (${(compressedSize / 1024 / 1024).toFixed(2)}MB) and Storage upload failed: ${uploadResult.error}. Cannot update session without losing transcription data.`
            );
          }

          // If small enough for DB, warn but continue (will save to DB as backup)
          logger.warn(
            `Storage upload failed for session ${session.id}, but transcription fits in database. Continuing with DB-only storage.`,
            uploadResult.error
          );
        }

        // Store in database if small enough (even if Storage succeeded - provides faster access)
        if (!requiresStorage) {
          transcriptionJson = JSON.stringify(session.transcription.toJSON());
        }
      }

      const updates: Partial<SessionRow> = {
        title: session.title,
        notes: session.notes,
        tags: session.tags,
        course_id: session.courseId,
        course_title: session.courseTitle,
        course_number: session.courseNumber,
        transcription_text: transcriptionJson,
        has_transcription: storageUploadSuccess,
        transcription_provider: session.transcription?.provider,
        transcription_language: session.transcription?.language,
        transcription_confidence: session.transcription?.averageConfidence,
        transcription_timestamp: session.transcription?.createdAt?.toISOString(),
        updated_at: session.updatedAt.toISOString(),
        type: session.type,
        child_session_ids: session.childSessionIds,
        session_order: session.sessionOrder,
        summary: session.summary
      };

      const { data, error } = await client
        .from(this.tableName)
        .update(updates)
        .eq('id', session.id)
        .select();

      if (error) {
        throw new Error(`Failed to update session: ${error.message}`);
      }

      // Validate that the session was actually updated
      if (!data || data.length === 0) {
        throw new Error(`Session ${session.id} not found in database - it may have been deleted or you don't have permission to update it`);
      }
    } catch (error) {
      console.error('Exception in update():', error);
      throw error;
    }
  }

  /**
   * Delete a session (soft delete)
   */
  async delete(sessionId: string): Promise<void> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      // Soft delete - set deleted_at timestamp
      const { error } = await client
        .from(this.tableName)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', sessionId);

      if (error) {
        throw new Error(`Failed to delete session: ${error.message}`);
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      throw error;
    }
  }

  /**
   * Check if session exists
   */
  async exists(sessionId: string): Promise<boolean> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      const { data, error } = await client
        .from(this.tableName)
        .select('id')
        .eq('id', sessionId)
        .is('deleted_at', null)
        .single();

      if (error) {
        return false;
      }

      return data !== null;
    } catch (error) {
      console.error('Error checking session existence:', error);
      return false;
    }
  }

  /**
   * Convert database row to Session entity
   * NOTE: Transcription is not included here - it must be loaded separately via loadTranscription()
   */
  private rowToSession(row: SessionRow): Session {
    // Transcription is stored in Supabase Storage, not in database
    // Call loadTranscription() after creating the session to fetch it
    // We only store metadata here to track if transcription exists

    // NOTE: recordingPath is not stored in cloud - it's local only
    // For cloud synced sessions, we'll use a placeholder or download path
    const recordingPath = `cloud://${row.user_id}/${row.id}/audio.webm`;

    return new Session(
      row.id,
      row.title,
      recordingPath,
      row.notes,
      new Date(row.created_at),
      new Date(row.updated_at),
      row.duration / 1000, // Convert milliseconds to seconds
      undefined, // transcription loaded separately via loadTranscription()
      row.tags || [],
      [], // exportHistory not stored in cloud yet
      row.course_id,
      row.course_title,
      row.course_number,
      // Cloud sync fields
      row.user_id,           // userId
      row.id,                 // cloudId (use the session ID as cloudId)
      SyncStatus.SYNCED,      // syncStatus (it came from cloud, so it's synced)
      new Date(row.updated_at), // lastSyncedAt
      undefined,              // permissionLevel
      row.deleted_at ? new Date(row.deleted_at) : undefined, // deletedAt
      // Multi-session study set fields
      row.type ? (row.type as SessionType) : SessionType.SINGLE, // type
      row.child_session_ids,  // childSessionIds
      row.session_order,      // sessionOrder
      // AI-generated summary
      row.summary             // summary
    );
  }

  /**
   * Load transcription (tries Storage first, falls back to database)
   */
  private async loadTranscription(session: Session, row: SessionRow): Promise<void> {
    try {
      let transcriptionData: any = null;

      // Try to load from Storage first
      if (row.has_transcription && row.user_id) {
        const storageResult = await this.storageService.downloadTranscriptionFile(
          row.user_id,
          session.id
        );
        if (storageResult.success && storageResult.data) {
          transcriptionData = storageResult.data;
        }
      }

      // Fallback to database column
      if (!transcriptionData && row.transcription_text) {
        try {
          transcriptionData = JSON.parse(row.transcription_text);
        } catch (parseError) {
          console.error('Failed to parse transcription_text:', parseError);
        }
      }

      if (transcriptionData) {
        const transcription = Transcription.fromJSON(transcriptionData);
        session.addTranscription(transcription);
      }
    } catch (error) {
      console.error(`Error loading transcription:`, error);
    }
  }

  /**
   * Restore a soft-deleted session from trash
   */
  async restore(sessionId: string): Promise<void> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      // Restore by setting deleted_at to NULL and updating updated_at
      const { data, error } = await client
        .from(this.tableName)
        .update({
          deleted_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .select();

      if (error) {
        throw new Error(`Failed to restore session: ${error.message}`);
      }

      // Validate that the session was actually restored
      if (!data || data.length === 0) {
        throw new Error(`Session ${sessionId} not found in database - it may have been permanently deleted`);
      }
    } catch (error) {
      console.error('Error restoring session:', error);
      throw error;
    }
  }

  /**
   * Find all soft-deleted sessions for the current user
   */
  async findDeleted(userId?: string): Promise<Session[]> {
    try {
      const targetUserId = userId || this.userId;

      // When logged out (userId is null), return no sessions
      if (!targetUserId) {
        return [];
      }

      const client = SupabaseClient.getInstance().getClient();

      // Query only deleted sessions for the current user
      const { data, error } = await client
        .from(this.tableName)
        .select('*')
        .eq('user_id', targetUserId)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch deleted sessions: ${error.message}`);
      }

      const sessions = (data as SessionRow[]).map(row => this.rowToSession(row));

      // DUAL STORAGE: Load transcriptions for deleted sessions that have them
      await Promise.all(
        sessions.map(async (session, index) => {
          const row = data[index];
          if ((row.has_transcription || row.transcription_text) && row.user_id) {
            await this.loadTranscription(session, row);
          }
        })
      );

      return sessions;
    } catch (error) {
      console.error('Error finding deleted sessions:', error);
      return [];
    }
  }

  /**
   * Permanently delete a session (hard delete)
   * Removes the session completely from the database AND Supabase Storage
   * - Deletes audio file from audio-files bucket
   * - Deletes transcription file from transcription-data bucket
   * - Deletes session row from database
   */
  async permanentlyDelete(sessionId: string): Promise<void> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      // First, fetch the session to get userId (needed for storage paths)
      // Query without the deleted_at filter to include trashed sessions
      const { data: sessionData, error: fetchError } = await client
        .from(this.tableName)
        .select('id, user_id, has_transcription')
        .eq('id', sessionId)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          throw new Error(`Session ${sessionId} not found in database - it may have already been deleted`);
        }
        throw new Error(`Failed to fetch session for deletion: ${fetchError.message}`);
      }

      const userId = sessionData.user_id;
      const hasTranscription = sessionData.has_transcription;

      // Delete from Supabase Storage buckets
      // Delete audio file
      const audioPath = `${userId}/${sessionId}/audio.webm`;
      const audioDeleteResult = await this.storageService.deleteAudioFile(audioPath);
      if (!audioDeleteResult.success && audioDeleteResult.error) {
        console.warn(`Failed to delete audio file from storage: ${audioDeleteResult.error}`);
        // Continue with deletion even if audio file doesn't exist
      }

      // Delete transcription file (if it exists)
      if (hasTranscription) {
        const transcriptionDeleteResult = await this.storageService.deleteTranscriptionFile(userId, sessionId);
        if (!transcriptionDeleteResult.success && transcriptionDeleteResult.error) {
          console.warn(`Failed to delete transcription file from storage: ${transcriptionDeleteResult.error}`);
          // Continue with deletion even if transcription file doesn't exist
        }
      }

      // Hard delete - physically remove from database
      const { data, error } = await client
        .from(this.tableName)
        .delete()
        .eq('id', sessionId)
        .select();

      if (error) {
        throw new Error(`Failed to permanently delete session: ${error.message}`);
      }

      // Validate that the session was actually deleted
      if (!data || data.length === 0) {
        throw new Error(`Session ${sessionId} not found in database - it may have already been deleted`);
      }
    } catch (error) {
      console.error('Error permanently deleting session:', error);
      throw error;
    }
  }

  /**
   * Copy a session for study room sharing
   * Creates a new session with copied content but references the same audio file
   * @param originalSessionId - ID of the session to copy
   * @param newOwnerId - User ID who will own the copied session (typically room host)
   * @param titlePrefix - Optional prefix for the copied session title (e.g., "[Room] ")
   * @returns The ID of the newly created session copy
   */
  async copySessionForRoom(
    originalSessionId: string,
    newOwnerId: string,
    titlePrefix: string = '[Shared] '
  ): Promise<string> {
    try {
      if (!this.userId) {
        throw new Error('User ID not set. Call setUserId() before copySessionForRoom()');
      }

      const client = SupabaseClient.getInstance().getClient();

      // Load the original session
      const originalSession = await this.findById(originalSessionId);
      if (!originalSession) {
        throw new Error(`Original session ${originalSessionId} not found`);
      }

      // Generate new ID for the copy
      const newSessionId = crypto.randomUUID();

      logger.info(`Copying session ${originalSessionId} to ${newSessionId} for room sharing`);

      // DUAL STORAGE: Handle transcription copying
      let storageUploadSuccess = false;
      let transcriptionJson: string | null = null;
      const MAX_DB_SIZE = 7 * 1024 * 1024; // 7MB safety margin

      if (originalSession.transcription) {
        // Compress transcription to check size
        const compressionResult = compressJSON(originalSession.transcription.toJSON());
        const compressedSize = compressionResult.compressedSize;

        logger.info(
          `Copying transcription for session ${newSessionId}: ${(compressedSize / 1024 / 1024).toFixed(2)}MB`
        );

        const requiresStorage = compressedSize >= MAX_DB_SIZE;

        // Upload to Storage with new session ID
        const uploadResult = await this.storageService.uploadTranscriptionFile({
          sessionId: newSessionId,
          userId: newOwnerId,
          transcriptionData: originalSession.transcription.toJSON()
        });

        if (uploadResult.success) {
          storageUploadSuccess = true;
        } else if (requiresStorage) {
          throw new Error(
            `Failed to upload transcription to storage for copied session: ${uploadResult.error}`
          );
        }

        // Store in database if small enough
        if (!requiresStorage) {
          transcriptionJson = JSON.stringify(originalSession.transcription.toJSON());
        }
      }

      // Create the new session row
      const newSessionRow: Partial<SessionRow> = {
        id: newSessionId,
        user_id: newOwnerId,
        title: titlePrefix + originalSession.title,
        notes: originalSession.notes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        duration: originalSession.duration,
        transcription_text: transcriptionJson,
        has_transcription: storageUploadSuccess,
        transcription_provider: originalSession.transcription?.provider,
        transcription_language: originalSession.transcription?.language,
        transcription_confidence: originalSession.transcription?.averageConfidence,
        transcription_timestamp: originalSession.transcription?.createdAt?.toISOString(),
        tags: originalSession.tags,
        course_id: originalSession.courseId,
        course_title: originalSession.courseTitle,
        course_number: originalSession.courseNumber,
        type: originalSession.type,
        summary: originalSession.summary,
        // Track source session for audio file reference
        source_session_id: originalSessionId,
        source_user_id: originalSession.userId,
        // Mark as room-only so it doesn't appear in study mode
        is_room_only: true
      };

      // Insert the copied session
      const { error: insertError } = await client
        .from(this.tableName)
        .insert(newSessionRow);

      if (insertError) {
        throw new Error(`Failed to insert copied session: ${insertError.message}`);
      }

      logger.info(`Successfully copied session ${originalSessionId} to ${newSessionId}`);

      return newSessionId;
    } catch (error) {
      logger.error('Error copying session for room:', error);
      throw error;
    }
  }
}
