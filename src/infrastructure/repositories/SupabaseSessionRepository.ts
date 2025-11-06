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

// Database row type (matches sessions table schema)
interface SessionRow {
  id: string;
  user_id: string;
  title: string;
  notes: string;
  created_at: string;
  updated_at: string;
  duration: number;
  transcription_text?: string;
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
   */
  async save(session: Session): Promise<void> {
    try {
      if (!this.userId) {
        throw new Error('User ID not set. Call setUserId() before save()');
      }

      const client = SupabaseClient.getInstance().getClient();

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
        // Transcription fields
        transcription_text: session.transcription?.fullText,
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

      return this.rowToSession(data as SessionRow);
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

      return (data as SessionRow[]).map(row => this.rowToSession(row));
    } catch (error) {
      console.error('Error finding all sessions:', error);
      return [];
    }
  }

  /**
   * Update a session
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

      const updates: Partial<SessionRow> = {
        title: session.title,
        notes: session.notes,
        tags: session.tags,
        course_id: session.courseId,
        course_title: session.courseTitle,
        course_number: session.courseNumber,
        transcription_text: session.transcription?.fullText,
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
   */
  private rowToSession(row: SessionRow): Session {
    // Create transcription if data exists
    let transcription: Transcription | undefined;
    if (row.transcription_text) {
      // Create a single segment from the full text
      // (we don't store individual segments in the database for cloud sync)
      const segments = [{
        text: row.transcription_text,
        startTime: 0,
        endTime: row.duration,
        confidence: row.transcription_confidence
      }];

      transcription = new Transcription(
        row.transcription_text,
        segments,
        row.transcription_language || 'en',
        (row.transcription_provider as 'assemblyai') || 'assemblyai',
        row.transcription_timestamp ? new Date(row.transcription_timestamp) : new Date(),
        row.transcription_confidence
      );
    }

    // NOTE: recordingPath is not stored in cloud - it's local only
    // For cloud synced sessions, we'll use a placeholder or download path
    const recordingPath = `cloud://${row.id}/audio.webm`;

    return new Session(
      row.id,
      row.title,
      recordingPath,
      row.notes,
      new Date(row.created_at),
      new Date(row.updated_at),
      row.duration / 1000, // Convert milliseconds to seconds
      transcription,
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

      return (data as SessionRow[]).map(row => this.rowToSession(row));
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
