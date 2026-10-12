import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import prisma from "./prisma";

const API_KEY_PREFIX = "at_live_";
const KEY_RANDOM_BYTES = 32;
const BCRYPT_ROUNDS = 10;

/**
 * Generate a new API key.
 * Returns the plaintext key (shown once to the user), the prefix for identification,
 * and the bcrypt hash for storage.
 */
export async function generateApiKey(): Promise<{
  key: string;
  prefix: string;
  hash: string;
}> {
  const randomPart = randomBytes(KEY_RANDOM_BYTES).toString("hex");
  const key = `${API_KEY_PREFIX}${randomPart}`;
  const prefix = key.substring(0, 8);
  const hash = await bcrypt.hash(key, BCRYPT_ROUNDS);

  return { key, prefix, hash };
}

/**
 * Validate an API key against stored hashes.
 * Looks up candidate keys by prefix, then bcrypt-compares to find a match.
 * Updates lastUsedAt on successful validation.
 * Returns the api_keys record (with user relation) or null.
 */
export async function validateApiKey(key: string) {
  if (!key.startsWith("at_")) {
    return null;
  }

  const prefix = key.substring(0, 8);

  // Find all active, non-expired keys with matching prefix
  const candidates = await prisma.apiKey.findMany({
    where: {
      keyPrefix: prefix,
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: {
      user: {
        select: {
          userid: true,
          username: true,
          firstname: true,
          lastname: true,
          email: true,
          isadmin: true,
          canrequest: true,
          organizationId: true,
          isActive: true,
          organization: { select: { isActive: true, suspendedAt: true } },
        },
      },
    },
  });

  for (const candidate of candidates) {
    const isMatch = await bcrypt.compare(key, candidate.keyHash);
    if (isMatch) {
      // Update lastUsedAt asynchronously (fire and forget)
      prisma.apiKey
        .update({
          where: { id: candidate.id },
          data: { lastUsedAt: new Date() },
        })
        .catch(() => {
          // Silently ignore update failures to not block the request
        });

      return candidate;
    }
  }

  return null;
}
