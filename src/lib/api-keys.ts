import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import prisma from "./prisma";

const API_KEY_PREFIX = "at_live_";
const KEY_RANDOM_BYTES = 32;
const BCRYPT_ROUNDS = 10;
/** Brand prefix plus 8 random characters: the indexed lookup id of a key. */
const LOOKUP_PREFIX_LENGTH = 16;
/** Legacy keys stored only the brand prefix, which every key shares. */
const LEGACY_PREFIX = API_KEY_PREFIX;
/** bcrypt ignores input past 72 bytes; a key is exactly that long. */
const KEY_LENGTH = API_KEY_PREFIX.length + KEY_RANDOM_BYTES * 2;

/**
 * Generate a new API key.
 * Returns the plaintext key (shown once to the user), the lookup prefix
 * (brand prefix + 8 random characters, so a request matches at most one row)
 * and the bcrypt hash for storage.
 */
export async function generateApiKey(): Promise<{
  key: string;
  prefix: string;
  hash: string;
}> {
  const randomPart = randomBytes(KEY_RANDOM_BYTES).toString("hex");
  const key = `${API_KEY_PREFIX}${randomPart}`;
  const prefix = key.substring(0, LOOKUP_PREFIX_LENGTH);
  const hash = await bcrypt.hash(key, BCRYPT_ROUNDS);

  return { key, prefix, hash };
}

const apiKeyInclude = {
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
} as const;

async function findMatchingKey(key: string, keyPrefix: string) {
  // Find all active, non-expired keys with matching prefix
  const candidates = await prisma.apiKey.findMany({
    where: {
      keyPrefix,
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: apiKeyInclude,
  });

  for (const candidate of candidates) {
    if (await bcrypt.compare(key, candidate.keyHash)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Validate an API key against stored hashes.
 * Keys issued with a 16-character lookup prefix are matched by that prefix, so
 * a request costs one bcrypt compare. Keys issued before the lookup prefix
 * existed (stored prefix "at_live_") are only checked as a fallback, which
 * bounds the cost to the remaining legacy rows.
 * Updates lastUsedAt on successful validation.
 * Returns the api_keys record (with user relation) or null.
 */
export async function validateApiKey(key: string) {
  if (!key.startsWith("at_") || key.length !== KEY_LENGTH) {
    return null;
  }

  const match =
    (await findMatchingKey(key, key.substring(0, LOOKUP_PREFIX_LENGTH))) ??
    (await findMatchingKey(key, LEGACY_PREFIX));

  if (!match) {
    return null;
  }

  // Update lastUsedAt asynchronously (fire and forget)
  prisma.apiKey
    .update({
      where: { id: match.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {
      // Silently ignore update failures to not block the request
    });

  return match;
}
