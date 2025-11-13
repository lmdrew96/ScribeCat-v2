/**
 * SupabaseStorageService
 *
 * Handles audio file uploads and downloads to/from Supabase Storage.
 * Manages the audio-files bucket with user-specific folders.
 *
 * Storage path format: {user_id}/{session_id}/{filename}
 */

import { SupabaseClient } from './SupabaseClient.js';
import { compressJSON, decompressJSON, formatBytes } from '../../../shared/utils/compressionUtils.js';
import { createLogger } from '../../../shared/logger.js';

const logger = createLogger('SupabaseStorageService');

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
   * Upload a transcription file to Supabase Storage with compression and retry logic
   * Stores transcription data as compressed JSON to reduce size and improve upload reliability
   * Uses separate transcription-data bucket to avoid MIME type restrictions
   */
  async uploadTranscriptionFile(params: UploadTranscriptionParams): Promise<{
    success: boolean;
    storagePath?: string;
    error?: string;
  }> {
    const maxRetries = 5;
    const baseDelay = 1000; // 1 second

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const client = SupabaseClient.getInstance().getClient();

        // Generate storage path: {user_id}/{session_id}/transcription.json.gz
        const storagePath = `${params.userId}/${params.sessionId}/transcription.json.gz`;

        // Compress transcription data using gzip
        const compressionResult = compressJSON(params.transcriptionData);

        logger.info(
          `Compressing transcription for upload: ${formatBytes(compressionResult.originalSize)} → ${formatBytes(compressionResult.compressedSize)} (${compressionResult.compressionRatio.toFixed(1)}% reduction)`
        );

        // Create blob from compressed data
        const blob = new Blob([compressionResult.compressed], { type: 'application/gzip' });

        // ROOT CAUSE FIX: Calculate adaptive timeout based on file size
        // Assumptions: ~100KB/s for slow connection, with 30s base timeout
        const fileSizeBytes = compressionResult.compressedSize;
        const baseTimeout = 30000; // 30 seconds base
        const timeoutPerMB = 10000; // 10 seconds per MB
        const adaptiveTimeout = baseTimeout + (fileSizeBytes / (1024 * 1024)) * timeoutPerMB;
        const timeout = Math.min(Math.max(adaptiveTimeout, 30000), 300000); // Min 30s, max 5 minutes

        logger.info(
          `Uploading with adaptive timeout: ${(timeout / 1000).toFixed(0)}s for ${formatBytes(fileSizeBytes)}`
        );

        // Upload with timeout
        const uploadPromise = client.storage
          .from(this.transcriptionBucketName)
          .upload(storagePath, blob, {
            contentType: 'application/gzip',
            cacheControl: '3600',
            upsert: true // Allow overwriting (in case transcription is updated)
          });

        // Race against adaptive timeout
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Upload timeout after ${(timeout / 1000).toFixed(0)}s`)), timeout)
        );

        const { data, error } = await Promise.race([uploadPromise, timeoutPromise]) as any;

        if (error) {
          throw new Error(error.message);
        }

        logger.info(`Transcription uploaded successfully on attempt ${attempt}`);
        return {
          success: true,
          storagePath: data.path
        };

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s, 8s, 16s
          const delayMs = baseDelay * Math.pow(2, attempt - 1);
          logger.warn(
            `Transcription upload failed (attempt ${attempt}/${maxRetries}): ${errorMessage}. Retrying in ${delayMs}ms...`
          );
          await new Promise(resolve => setTimeout(resolve, delayMs));
        } else {
          logger.error(
            `Transcription upload failed after ${maxRetries} attempts: ${errorMessage}`
          );
          return {
            success: false,
            error: `Upload failed after ${maxRetries} retries: ${errorMessage}`
          };
        }
      }
    }

    return {
      success: false,
      error: 'Max retry attempts reached'
    };
  }

  /**
   * Download a transcription file from Supabase Storage and decompress it
   * Handles both new compressed (.json.gz) and legacy uncompressed (.json) files
   */
  async downloadTranscriptionFile(userId: string, sessionId: string): Promise<{
    success: boolean;
    data?: any; // TranscriptionData object
    error?: string;
  }> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      // Try new compressed format first
      const compressedPath = `${userId}/${sessionId}/transcription.json.gz`;

      let downloadResult = await client.storage
        .from(this.transcriptionBucketName)
        .download(compressedPath);

      let isCompressed = true;

      // If compressed file not found, try legacy uncompressed format
      if (downloadResult.error) {
        const uncompressedPath = `${userId}/${sessionId}/transcription.json`;
        downloadResult = await client.storage
          .from(this.transcriptionBucketName)
          .download(uncompressedPath);
        isCompressed = false;

        if (downloadResult.error) {
          return {
            success: false,
            error: downloadResult.error.message
          };
        }
      }

      const { data } = downloadResult;

      // Decompress or parse based on file format
      let transcriptionData: any;

      if (isCompressed) {
        // Decompress gzipped data
        const arrayBuffer = await data.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        transcriptionData = decompressJSON(uint8Array);
        logger.info(`Downloaded and decompressed transcription for session ${sessionId}`);
      } else {
        // Legacy: parse uncompressed JSON
        const text = await data.text();
        transcriptionData = JSON.parse(text);
        logger.info(`Downloaded legacy uncompressed transcription for session ${sessionId}`);
      }

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
   * Handles both new compressed (.json.gz) and legacy uncompressed (.json) files
   */
  async deleteTranscriptionFile(userId: string, sessionId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const client = SupabaseClient.getInstance().getClient();

      // Try to delete both formats (one will fail, that's okay)
      const compressedPath = `${userId}/${sessionId}/transcription.json.gz`;
      const uncompressedPath = `${userId}/${sessionId}/transcription.json`;

      // Attempt to delete both (silently ignore if one doesn't exist)
      await client.storage
        .from(this.transcriptionBucketName)
        .remove([compressedPath, uncompressedPath]);

      // We don't check for errors because files might not exist
      // As long as we attempted to delete, it's a success
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error deleting transcription'
      };
    }
  }
}
