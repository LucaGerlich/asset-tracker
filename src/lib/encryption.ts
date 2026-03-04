/**
 * Encryption utilities for sensitive data at rest
 *
 * Uses AES-256-GCM for authenticated encryption and SHA-256 for one-way hashing.
 * The encryption key must be provided via the ENCRYPTION_KEY environment variable
 * as a 64-character hex string (32 bytes).
 *
 * If ENCRYPTION_KEY is not set, encrypt/decrypt gracefully pass through plaintext
 * so the application still works (with a console warning on first use).
 */

import * as crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits — recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/** Sentinel logged once when the key is missing. */
let _warnedMissingKey = false;

/**
 * Retrieve and validate the encryption key from the environment.
 * Returns `null` when the key is absent so callers can fall back to plaintext.
 */
function getKey(): Buffer | null {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) {
    if (!_warnedMissingKey) {
      console.warn(
        "[encryption] ENCRYPTION_KEY is not set — sensitive data will NOT be " +
          "encrypted at rest. Generate one with: openssl rand -hex 32",
      );
      _warnedMissingKey = true;
    }
    return null;
  }
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      "ENCRYPTION_KEY must be a 64-character hex string (32 bytes).",
    );
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 *
 * @returns A string in the format `iv:authTag:ciphertext` (all base64-encoded).
 *          If ENCRYPTION_KEY is not configured, returns the plaintext unchanged.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "ENCRYPTION_KEY is required in production. Generate one with: openssl rand -hex 32",
      );
    }
    return plaintext;
  }

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
 *                  If the value does not look encrypted (see `isEncrypted`) it is
 *                  returned as-is, which keeps backward-compatibility with data
 *                  that was stored before encryption was enabled.
 * @returns The original plaintext.
 */
export function decrypt(encrypted: string): string {
  // If the value is not in encrypted format, return it as-is. This handles
  // both the "no key configured" passthrough and legacy unencrypted data.
  if (!isEncrypted(encrypted)) return encrypted;

  const key = getKey();
  if (!key) return encrypted;

  const parts = encrypted.split(":");
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
 * Detect whether a value looks like it was produced by `encrypt()`.
 *
 * The format is three colon-separated base64 segments:
 *   <iv 16 chars>:<authTag 24 chars>:<ciphertext 1+ chars>
 *
 * This is a heuristic — it checks structural format, not cryptographic validity.
 */
export function isEncrypted(value: string): boolean {
  if (!value || typeof value !== "string") return false;

  const parts = value.split(":");
  if (parts.length !== 3) return false;

  const [ivB64, authTagB64, ciphertextB64] = parts;

  // Each segment must be valid base64 with reasonable lengths.
  // IV = 12 bytes -> 16 base64 chars
  // AuthTag = 16 bytes -> 24 base64 chars
  // Ciphertext = at least 1 base64 char
  const base64Pattern = /^[A-Za-z0-9+/]+=*$/;
  return (
    base64Pattern.test(ivB64) &&
    ivB64.length === 16 &&
    base64Pattern.test(authTagB64) &&
    authTagB64.length === 24 &&
    base64Pattern.test(ciphertextB64) &&
    ciphertextB64.length >= 1
  );
}

/**
 * Encrypt an array of strings (e.g. backup codes).
 * Each element is encrypted individually so the array structure is preserved.
 * If ENCRYPTION_KEY is not set, returns the array unchanged.
 */
export function encryptArray(values: string[]): string[] {
  return values.map(encrypt);
}

/**
 * Decrypt an array of strings previously encrypted with `encryptArray()`.
 * Handles mixed arrays where some elements may be unencrypted (legacy data).
 */
export function decryptArray(values: string[]): string[] {
  return values.map(decrypt);
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
