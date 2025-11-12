/**
 * Image Compression Utilities
 *
 * Compresses images before storing as base64 to reduce database size.
 * Uses canvas to resize and compress images with quality control.
 */

import { createLogger } from '../../shared/logger.js';

const logger = createLogger('ImageCompression');

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1, default 0.8
  format?: 'image/jpeg' | 'image/png' | 'image/webp';
}

export interface CompressedImageResult {
  dataUrl: string;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

/**
 * Compress an image file to reduce size
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressedImageResult> {
  const {
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.85,
    format = 'image/jpeg'
  } = options;

  logger.info(`Compressing image: ${file.name} (${formatFileSize(file.size)})`);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Failed to read file'));

    reader.onload = (e) => {
      const img = new window.Image();

      img.onerror = () => reject(new Error('Failed to load image'));

      img.onload = () => {
        try {
          // Calculate new dimensions while maintaining aspect ratio
          let { width, height } = calculateDimensions(
            img.width,
            img.height,
            maxWidth,
            maxHeight
          );

          // Create canvas for compression
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          // Enable image smoothing for better quality
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Draw and compress
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to compressed format
          const dataUrl = canvas.toDataURL(format, quality);

          // Calculate compression stats
          const originalSize = file.size;
          const compressedSize = estimateBase64Size(dataUrl);
          const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;

          logger.info(
            `Compressed ${file.name}: ${formatFileSize(originalSize)} → ${formatFileSize(compressedSize)} (${compressionRatio.toFixed(1)}% reduction)`
          );

          resolve({
            dataUrl,
            width,
            height,
            originalSize,
            compressedSize,
            compressionRatio
          });
        } catch (error) {
          reject(error);
        }
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Calculate dimensions maintaining aspect ratio
 */
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  let width = originalWidth;
  let height = originalHeight;

  // Scale down if wider than max
  if (width > maxWidth) {
    height = (maxWidth / width) * height;
    width = maxWidth;
  }

  // Scale down if taller than max
  if (height > maxHeight) {
    width = (maxHeight / height) * width;
    height = maxHeight;
  }

  return {
    width: Math.round(width),
    height: Math.round(height)
  };
}

/**
 * Estimate base64 string size in bytes
 */
function estimateBase64Size(dataUrl: string): number {
  // Base64 adds ~33% overhead, but we can estimate from the string length
  // Each base64 character represents 6 bits
  const base64Length = dataUrl.split(',')[1]?.length || 0;
  return Math.round((base64Length * 3) / 4);
}

/**
 * Format file size for logging
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

/**
 * Check if file type is supported for compression
 */
export function isSupportedImageType(file: File): boolean {
  const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  return supportedTypes.includes(file.type);
}

/**
 * Get recommended compression options based on file type
 */
export function getRecommendedOptions(file: File): CompressionOptions {
  // PNG: Higher quality, no format change (to preserve transparency)
  if (file.type === 'image/png') {
    return {
      maxWidth: 1200,
      maxHeight: 1200,
      quality: 0.9,
      format: 'image/png'
    };
  }

  // WebP: Good quality, good compression
  if (file.type === 'image/webp') {
    return {
      maxWidth: 1200,
      maxHeight: 1200,
      quality: 0.85,
      format: 'image/webp'
    };
  }

  // JPEG/JPG/others: Standard compression
  return {
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 0.85,
    format: 'image/jpeg'
  };
}
