/**
 * SupabaseStorageService
 *
 * Handles audio file uploads and downloads to/from Supabase Storage.
 * Manages the audio-files bucket with user-specific folders.
 *
 * Storage path format: {user_id}/{session_id}/{filename}
 */

import { SupabaseClient } from './SupabaseClient.js';

export interface UploadAudioFileParams {
  sessionId: string;
  userId: string;
  audioData: ArrayBuffer;
  fileName: string;
  mimeType?: string;
}

export interface AudioFileMetadata {
  sessionId: string;
  storagePath: string;
  fileSizeBytes: number;
  mimeType: string;
  uploadedAt: Date;
}

export interface UploadTranscriptionParams {
  sessionId: string;
  userId: string;
  transcriptionData: any; // TranscriptionData object
}

export class SupabaseStorageService {
  private readonly bucketName = 'audio-files';
  private readonly transcriptionBucketName = 'transcription-data';

  /**
   * Upload an audio file to Supabase Storage
   */
  async uploadAudioFile(params: UploadAudioFileParams): Promise<{
    success: boolean;
    storagePath?: string;
    error?: string;
  }> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      // Generate storage path: {user_id}/{session_id}/audio.webm
      // Always use 'audio.webm' for consistency (ignores local timestamped filename)
      const storagePath = `${params.userId}/${params.sessionId}/audio.webm`;

      // Upload file to storage
      const { data, error } = await client.storage
        .from(this.bucketName)
        .upload(storagePath, params.audioData, {
          contentType: params.mimeType || 'audio/webm',
          cacheControl: '3600',
          upsert: true // Allow overwriting (e.g., when re-uploading or updating)
        });

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        storagePath: data.path
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error uploading file'
      };
    }
  }

  /**
   * Download an audio file from Supabase Storage
   */
  async downloadAudioFile(storagePath: string): Promise<{
    success: boolean;
    data?: Blob;
    error?: string;
  }> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      const { data, error } = await client.storage
        .from(this.bucketName)
        .download(storagePath);

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        data
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error downloading file'
      };
    }
  }

  /**
   * Get a signed URL for playing audio
   * Useful for streaming audio without downloading the entire file
   */
  async getSignedUrl(storagePath: string, expiresIn: number = 3600): Promise<{
    success: boolean;
    url?: string;
    error?: string;
  }> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      const { data, error } = await client.storage
        .from(this.bucketName)
        .createSignedUrl(storagePath, expiresIn);

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        url: data.signedUrl
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error creating signed URL'
      };
    }
  }

  /**
   * Delete an audio file from Supabase Storage
   */
  async deleteAudioFile(storagePath: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      const { error } = await client.storage
        .from(this.bucketName)
        .remove([storagePath]);

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error deleting file'
      };
    }
  }

  /**
   * List all audio files for a user
   */
  async listUserAudioFiles(userId: string): Promise<{
    success: boolean;
    files?: Array<{ name: string; size: number; createdAt: string }>;
    error?: string;
  }> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      const { data, error } = await client.storage
        .from(this.bucketName)
        .list(userId, {
          limit: 1000,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      const files = data.map(file => ({
        name: file.name,
        size: file.metadata?.size || 0,
        createdAt: file.created_at || new Date().toISOString()
      }));

      return {
        success: true,
        files
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error listing files'
      };
    }
  }

  /**
   * Check if an audio file exists in storage
   */
  async fileExists(storagePath: string): Promise<boolean> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      const { data, error } = await client.storage
        .from(this.bucketName)
        .list(storagePath.split('/').slice(0, -1).join('/'));

      if (error) return false;

      const fileName = storagePath.split('/').pop();
      return data.some(file => file.name === fileName);
    } catch (error) {
      // Silently return false (expected for files that don't exist)
      return false;
    }
  }

  /**
   * Get the public URL for an audio file (for public buckets only)
   * Note: Our bucket is private, so use getSignedUrl instead
   */
  getPublicUrl(storagePath: string): string {
    const client = SupabaseClient.getInstance().getClient();

    const { data } = client.storage
      .from(this.bucketName)
      .getPublicUrl(storagePath);

    return data.publicUrl;
  }

  /**
   * Upload a transcription file to Supabase Storage
   * Stores transcription data as JSON to avoid database size limits
   * Uses separate transcription-data bucket to avoid MIME type restrictions
   */
  async uploadTranscriptionFile(params: UploadTranscriptionParams): Promise<{
    success: boolean;
    storagePath?: string;
    error?: string;
  }> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      // Generate storage path: {user_id}/{session_id}/transcription.json
      const storagePath = `${params.userId}/${params.sessionId}/transcription.json`;

      // Convert transcription data to JSON string
      const jsonData = JSON.stringify(params.transcriptionData);
      const blob = new Blob([jsonData], { type: 'application/json' });

      // Upload file to transcription-data bucket (NOT audio-files bucket)
      const { data, error } = await client.storage
        .from(this.transcriptionBucketName)
        .upload(storagePath, blob, {
          contentType: 'application/json',
          cacheControl: '3600',
          upsert: true // Allow overwriting (in case transcription is updated)
        });

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        storagePath: data.path
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error uploading transcription'
      };
    }
  }

  /**
   * Download a transcription file from Supabase Storage
   */
  async downloadTranscriptionFile(userId: string, sessionId: string): Promise<{
    success: boolean;
    data?: any; // TranscriptionData object
    error?: string;
  }> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      // Generate storage path: {user_id}/{session_id}/transcription.json
      const storagePath = `${userId}/${sessionId}/transcription.json`;

      const { data, error } = await client.storage
        .from(this.transcriptionBucketName)
        .download(storagePath);

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      // Parse JSON from blob
      const text = await data.text();
      const transcriptionData = JSON.parse(text);

      return {
        success: true,
        data: transcriptionData
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error downloading transcription'
      };
    }
  }

  /**
   * Delete a transcription file from Supabase Storage
   */
  async deleteTranscriptionFile(userId: string, sessionId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      const storagePath = `${userId}/${sessionId}/transcription.json`;

      const { error } = await client.storage
        .from(this.transcriptionBucketName)
        .remove([storagePath]);

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error deleting transcription'
      };
    }
  }
}
