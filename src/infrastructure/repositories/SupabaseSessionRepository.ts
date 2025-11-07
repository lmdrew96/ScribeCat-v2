/**
 * SupabaseSessionRepository
 *
 * Implementation of ISessionRepository using Supabase database.
 * Stores session metadata in the cloud with RLS policies for data isolation.
 *
 * NOTE: This repository only stores metadata. Audio files are handled separately
 * by SupabaseStorageService.
 */

import { Session, SyncStatus } from '../../domain/entities/Session.js';
import { Transcription } from '../../domain/entities/Transcription.js';
import { ISessionRepository } from '../../domain/repositories/ISessionRepository.js';
import { SupabaseClient } from '../services/supabase/SupabaseClient.js';
import { SupabaseStorageService } from '../services/supabase/SupabaseStorageService.js';

// Database row type (matches sessions table schema)
interface SessionRow {
  id: string;
  user_id: string;
  title: string;
  notes: string;
  created_at: string;
  updated_at: string;
  duration: number;
  // DUAL STORAGE: Transcriptions stored in BOTH database AND Storage during migration
  // - Small transcriptions: stored in transcription_text (backward compatible)
  // - Large transcriptions: stored in Storage (new system)
  // - Read priority: Try Storage first, fallback to database
  transcription_text?: string; // JSON string of TranscriptionData (backward compatibility)
  has_transcription?: boolean; // Flag to indicate if transcription file exists in Storage
  transcription_provider?: string;
  transcription_language?: string;
  transcription_confidence?: number;
  transcription_timestamp?: string;
  tags: string[];
  course_id?: string;
  course_title?: string;
  course_number?: string;
  deleted_at?: string | null;
}

export class SupabaseSessionRepository implements ISessionRepository {
  private tableName = 'sessions';
  private userId: string | null = null;
  private storageService: SupabaseStorageService;

  constructor(storageService?: SupabaseStorageService) {
    this.storageService = storageService || new SupabaseStorageService();
  }

  /**
   * Set the current user ID for this repository
   * Must be called before save() or update() operations
   */
  setUserId(userId: string | null): void {
    console.log('SupabaseSessionRepository.setUserId called with:', typeof userId, userId);
    if (userId && typeof userId !== 'string') {
      console.error('❌ ERROR: userId is not a string!', userId);
      throw new Error(`userId must be a string, got ${typeof userId}`);
    }
    this.userId = userId;
    console.log('✅ SupabaseSessionRepository userId set to:', this.userId);
  }

  /**
   * Save a session to Supabase
   * DUAL STORAGE: Writes transcription to BOTH Storage (for large files) AND database (for backward compatibility)
   */
  async save(session: Session): Promise<void> {
    try {
      if (!this.userId) {
        throw new Error('User ID not set. Call setUserId() before save()');
      }

      const client = SupabaseClient.getInstance().getClient();

      // DUAL STORAGE Phase 1: Upload transcription to Storage (if exists)
      let storageUploadSuccess = false;
      if (session.transcription) {
        console.log('📤 Uploading transcription to Storage...');
        try {
          const uploadResult = await this.storageService.uploadTranscriptionFile({
            sessionId: session.id,
            userId: this.userId,
            transcriptionData: session.transcription.toJSON()
          });
          storageUploadSuccess = uploadResult.success;
          if (storageUploadSuccess) {
            console.log('✅ Transcription uploaded to Storage');
          } else {
            console.warn('⚠️ Storage upload failed, will use database fallback:', uploadResult.error);
          }
        } catch (storageError) {
          console.warn('⚠️ Storage upload error, will use database fallback:', storageError);
        }
      }

      // DUAL STORAGE Phase 2: Conditionally write to database based on size
      // Calculate transcription size to avoid exceeding API payload limit
      let transcriptionJson: string | null = null;
      const MAX_DB_SIZE = 7 * 1024 * 1024; // 7MB safety margin (Supabase limit is ~8-10MB)

      if (session.transcription) {
        transcriptionJson = JSON.stringify(session.transcription.toJSON());
        const transcriptionSize = new Blob([transcriptionJson]).size;

        if (transcriptionSize >= MAX_DB_SIZE) {
          console.log(`⚠️ Transcription too large for database (${(transcriptionSize / 1024 / 1024).toFixed(2)}MB), using Storage only`);
          transcriptionJson = null; // Don't write to database, rely on Storage
        } else {
          console.log(`✅ Transcription small enough for database (${(transcriptionSize / 1024 / 1024).toFixed(2)}MB)`);
        }
      }

      // Convert Session entity to database row
      const row: Partial<SessionRow> = {
        id: session.id,
        user_id: this.userId,
        title: session.title,
        notes: session.notes,
        duration: Math.round(session.duration * 1000), // Convert seconds to milliseconds (integer)
        tags: session.tags,
        course_id: session.courseId,
        course_title: session.courseTitle,
        course_number: session.courseNumber,
        updated_at: session.updatedAt.toISOString(),
        // DUAL STORAGE: Write to database only if small enough, otherwise rely on Storage
        transcription_text: transcriptionJson,
        // Transcription metadata
        has_transcription: storageUploadSuccess, // Only set true if Storage upload succeeded
        transcription_provider: session.transcription?.provider,
        transcription_language: session.transcription?.language,
        transcription_confidence: session.transcription?.averageConfidence,
        transcription_timestamp: session.transcription?.createdAt?.toISOString()
      };

      // Use upsert to INSERT new records or UPDATE existing ones
      // This handles both new sessions and recording over existing sessions
      const { error } = await client
        .from(this.tableName)
        .upsert(row, {
          onConflict: 'id', // Use the id column as the conflict target
          ignoreDuplicates: false // Always update if exists
        });

      if (error) {
        throw new Error(`Failed to save session: ${error.message}`);
      }
    } catch (error) {
      console.error('Error saving session to Supabase:', error);
      throw error;
    }
  }

  /**
   * Find a session by ID
   */
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
   * Update a session
   * DUAL STORAGE: Writes transcription to BOTH Storage (for large files) AND database (for backward compatibility)
   */
  async update(session: Session): Promise<void> {
    console.log('🔷 SupabaseSessionRepository.update() called');
    console.log('  Session ID:', session.id);
    console.log('  Session title:', session.title);
    console.log('  Session userId:', session.userId);
    console.log('  Repository userId:', this.userId);

    try {
      const client = SupabaseClient.getInstance().getClient();

      // Check if client is authenticated
      const { data: { user }, error: authError } = await client.auth.getUser();
      console.log('  🔐 Supabase auth status:');
      console.log('    - authenticated:', !!user);
      console.log('    - user id:', user?.id || 'none');
      console.log('    - auth error:', authError?.message || 'none');

      // DUAL STORAGE: Upload transcription to Storage (if exists)
      let storageUploadSuccess = false;
      if (session.transcription && session.userId) {
        console.log('📤 Uploading transcription to Storage...');
        try {
          const uploadResult = await this.storageService.uploadTranscriptionFile({
            sessionId: session.id,
            userId: session.userId,
            transcriptionData: session.transcription.toJSON()
          });
          storageUploadSuccess = uploadResult.success;
          if (storageUploadSuccess) {
            console.log('✅ Transcription uploaded to Storage');
          } else {
            console.warn('⚠️ Storage upload failed, will use database fallback:', uploadResult.error);
          }
        } catch (storageError) {
          console.warn('⚠️ Storage upload error, will use database fallback:', storageError);
        }
      }

      // DUAL STORAGE: Conditionally write to database based on size
      let transcriptionJson: string | null = null;
      const MAX_DB_SIZE = 7 * 1024 * 1024; // 7MB safety margin (Supabase limit is ~8-10MB)

      if (session.transcription) {
        transcriptionJson = JSON.stringify(session.transcription.toJSON());
        const transcriptionSize = new Blob([transcriptionJson]).size;

        if (transcriptionSize >= MAX_DB_SIZE) {
          console.log(`⚠️ Transcription too large for database (${(transcriptionSize / 1024 / 1024).toFixed(2)}MB), using Storage only`);
          transcriptionJson = null; // Don't write to database, rely on Storage
        } else {
          console.log(`✅ Transcription small enough for database (${(transcriptionSize / 1024 / 1024).toFixed(2)}MB)`);
        }
      }

      const updates: Partial<SessionRow> = {
        title: session.title,
        notes: session.notes,
        tags: session.tags,
        course_id: session.courseId,
        course_title: session.courseTitle,
        course_number: session.courseNumber,
        // DUAL STORAGE: Write to database only if small enough, otherwise rely on Storage
        transcription_text: transcriptionJson,
        // Transcription metadata
        has_transcription: storageUploadSuccess,
        transcription_provider: session.transcription?.provider,
        transcription_language: session.transcription?.language,
        transcription_confidence: session.transcription?.averageConfidence,
        transcription_timestamp: session.transcription?.createdAt?.toISOString(),
        updated_at: session.updatedAt.toISOString()
      };

      console.log('  📦 Update payload:');
      console.log('    - notes length:', updates.notes?.length || 0);
      console.log('    - notes preview:', updates.notes?.substring(0, 100) || '(empty)');
      console.log('    - updated_at:', updates.updated_at);
      console.log('    - title:', updates.title);

      console.log('  🚀 Sending update to Supabase...');
      const { data, error } = await client
        .from(this.tableName)
        .update(updates)
        .eq('id', session.id)
        .select(); // Add select() to see what was actually updated

      console.log('  📨 Supabase response:');
      console.log('    - error:', error || 'none');
      console.log('    - data:', data);
      console.log('    - rows affected:', data?.length || 0);

      if (error) {
        console.error('  ❌ Supabase update error:', error);
        console.error('    - code:', error.code);
        console.error('    - message:', error.message);
        console.error('    - details:', error.details);
        console.error('    - hint:', error.hint);
        throw new Error(`Failed to update session: ${error.message}`);
      }

      if (!data || data.length === 0) {
        console.warn('  ⚠️ WARNING: Update succeeded but no rows were affected!');
        console.warn('    This could mean:');
        console.warn('    1. The session ID does not exist in the database');
        console.warn('    2. RLS policy is blocking the update silently');
        console.warn('    3. The WHERE clause did not match any rows');
      } else {
        console.log('  ✅ Successfully updated session in Supabase');
        console.log('    - Updated notes length:', data[0].notes?.length || 0);
        console.log('    - Updated timestamp:', data[0].updated_at);
      }
    } catch (error) {
      console.error('  ❌ Exception in SupabaseSessionRepository.update():', error);
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
      row.deleted_at ? new Date(row.deleted_at) : undefined // deletedAt
    );
  }

  /**
   * Load transcription and attach it to the session
   * DUAL STORAGE: Tries Storage first, falls back to database column for backward compatibility
   */
  private async loadTranscription(session: Session, row: SessionRow): Promise<void> {
    try {
      let transcriptionData: any = null;

      // PHASE 1: Try to load from Storage first (new system)
      if (row.has_transcription && row.user_id) {
        console.log(`📥 Trying to load transcription from Storage for session ${session.id}...`);
        const storageResult = await this.storageService.downloadTranscriptionFile(
          row.user_id,
          session.id
        );

        if (storageResult.success && storageResult.data) {
          transcriptionData = storageResult.data;
          console.log(`✅ Loaded transcription from Storage`);
        } else {
          console.log(`⚠️ Storage load failed, trying database fallback...`);
        }
      }

      // PHASE 2: Fallback to database column (backward compatibility)
      if (!transcriptionData && row.transcription_text) {
        console.log(`📥 Loading transcription from database column for session ${session.id}...`);
        try {
          transcriptionData = JSON.parse(row.transcription_text);
          console.log(`✅ Loaded transcription from database (${row.transcription_text.length} chars)`);
        } catch (parseError) {
          console.error(`❌ Failed to parse transcription_text:`, parseError);
        }
      }

      // Attach transcription to session if we found it
      if (transcriptionData) {
        const transcription = Transcription.fromJSON(transcriptionData);
        session.addTranscription(transcription);
      }
    } catch (error) {
      console.error(`Error loading transcription for session ${session.id}:`, error);
      // Don't throw - session is still valid without transcription
    }
  }

  /**
   * Restore a soft-deleted session from trash
   */
  async restore(sessionId: string): Promise<void> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      // Restore by setting deleted_at to NULL and updating updated_at
      const { error } = await client
        .from(this.tableName)
        .update({
          deleted_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (error) {
        throw new Error(`Failed to restore session: ${error.message}`);
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
   * Removes the session completely from the database
   */
  async permanentlyDelete(sessionId: string): Promise<void> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      // Hard delete - physically remove from database
      const { error } = await client
        .from(this.tableName)
        .delete()
        .eq('id', sessionId);

      if (error) {
        throw new Error(`Failed to permanently delete session: ${error.message}`);
      }
    } catch (error) {
      console.error('Error permanently deleting session:', error);
      throw error;
    }
  }
}
