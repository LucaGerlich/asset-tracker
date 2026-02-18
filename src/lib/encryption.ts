/**
 * Encryption utilities for sensitive data at rest
 *
 * Uses AES-256-GCM for authenticated encryption and SHA-256 for one-way hashing.
 * The encryption key must be provided via the ENCRYPTION_KEY environment variable
 * as a 64-character hex string (32 bytes).
 */

import * as crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits — recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Retrieve and validate the encryption key from the environment.
 */
function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      "ENCRYPTION_KEY environment variable is not set. " +
        "Generate one with: openssl rand -hex 32"
    );
  }
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      "ENCRYPTION_KEY must be a 64-character hex string (32 bytes)."
    );
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 *
 * @returns A string in the format `iv:authTag:ciphertext` (all base64-encoded).
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

/**
 * Decrypt a string previously produced by `encrypt()`.
 *
 * @param encrypted A string in the format `iv:authTag:ciphertext` (all base64).
 * @returns The original plaintext.
 */
export function decrypt(encrypted: string): string {
  const key = getKey();

  const parts = encrypted.split(":");
  if (parts.length !== 3) {
    throw new Error(
      "Invalid encrypted value. Expected format: iv:authTag:ciphertext"
    );
  }

  const [ivB64, authTagB64, ciphertextB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Produce a one-way SHA-256 hash of a value.
 *
 * Useful for indexing or comparing sensitive data without storing it in
 * plaintext (e.g., looking up a record by an API key hash).
 *
 * @returns Hex-encoded SHA-256 digest.
 */
export function hashSensitive(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}
