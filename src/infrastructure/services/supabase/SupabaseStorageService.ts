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

export class SupabaseStorageService {
  private readonly bucketName = 'audio-files';

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

      // Generate storage path: {user_id}/{session_id}/{filename}
      const storagePath = `${params.userId}/${params.sessionId}/${params.fileName}`;

      // Upload file to storage
      const { data, error } = await client.storage
        .from(this.bucketName)
        .upload(storagePath, params.audioData, {
          contentType: params.mimeType || 'audio/webm',
          cacheControl: '3600',
          upsert: false // Don't overwrite existing files
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
      console.error('Error checking file existence:', error);
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
}
