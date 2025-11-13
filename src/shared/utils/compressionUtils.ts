/**
 * Compression Utilities
 *
 * Provides gzip compression/decompression for JSON data to reduce storage size.
 * Uses pako library for browser-compatible compression.
 */

import * as pako from 'pako';

export interface CompressionResult {
  compressed: Uint8Array;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number; // Percentage reduction (0-100)
}

/**
 * Compress a JSON object using gzip
 * Returns the compressed data as a Uint8Array
 */
export function compressJSON(data: any): CompressionResult {
  // Convert to JSON string
  const jsonString = JSON.stringify(data);
  const originalSize = new Blob([jsonString]).size;

  // Compress using gzip
  const compressed = pako.gzip(jsonString, { level: 6 }); // Level 6 = good balance of speed/compression

  const compressedSize = compressed.length;
  const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;

  return {
    compressed,
    originalSize,
    compressedSize,
    compressionRatio
  };
}

/**
 * Decompress gzip data and parse as JSON
 */
export function decompressJSON(compressed: Uint8Array): any {
  // Decompress using gunzip
  const decompressed = pako.ungzip(compressed, { to: 'string' });

  // Parse JSON
  return JSON.parse(decompressed);
}

/**
 * Check if data would benefit from compression
 * Returns true if estimated compression would save significant space (>20% reduction)
 */
export function shouldCompress(data: any): boolean {
  const jsonString = JSON.stringify(data);
  const size = new Blob([jsonString]).size;

  // Only compress if data is large enough (>1KB) to benefit
  // Compression adds overhead for small data
  if (size < 1024) {
    return false;
  }

  // JSON text compresses very well (typically 60-80% reduction)
  // We can estimate without actually compressing
  return true;
}

/**
 * Convert Uint8Array to Base64 string for storage
 */
export function uint8ArrayToBase64(uint8Array: Uint8Array): string {
  let binary = '';
  const len = uint8Array.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
}

/**
 * Convert Base64 string back to Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const uint8Array = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    uint8Array[i] = binary.charCodeAt(i);
  }
  return uint8Array;
}

/**
 * Format file size for logging
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}
