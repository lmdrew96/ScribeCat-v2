/**
 * Encryption Utilities
 *
 * Simple encryption/decryption for sensitive data like OAuth refresh tokens.
 * Uses AES-256-GCM for authenticated encryption.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

// Derive a key from a passphrase (using app identifier as salt)
const SALT = 'scribecat-v2-drive-encryption';
const KEY_LENGTH = 32; // 256 bits for AES-256

/**
 * Derive an encryption key from the user ID
 * This ensures each user's tokens are encrypted with a unique key
 */
function deriveKey(userId: string): Buffer {
  return scryptSync(userId, SALT, KEY_LENGTH);
}

/**
 * Encrypt a string value
 * @param plaintext The value to encrypt
 * @param userId User ID used to derive encryption key
 * @returns Encrypted string in format: iv:authTag:ciphertext (all hex-encoded)
 */
export function encrypt(plaintext: string, userId: string): string {
  if (!plaintext || !userId) {
    throw new Error('plaintext and userId are required for encryption');
  }

  const key = deriveKey(userId);
  const iv = randomBytes(16); // Initialization vector

  const cipher = createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Return format: iv:authTag:ciphertext (all hex)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt an encrypted string
 * @param encryptedData Encrypted string in format: iv:authTag:ciphertext
 * @param userId User ID used to derive encryption key
 * @returns Decrypted plaintext string
 */
export function decrypt(encryptedData: string, userId: string): string {
  if (!encryptedData || !userId) {
    throw new Error('encryptedData and userId are required for decryption');
  }

  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const [ivHex, authTagHex, ciphertext] = parts;

  const key = deriveKey(userId);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
