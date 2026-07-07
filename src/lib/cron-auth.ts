import { timingSafeEqual } from "crypto";

/**
 * Constant-time verification of a cron request's Authorization header against
 * the configured CRON_SECRET.
 *
 * Using a plain `===`/`!==` string comparison leaks the secret via a timing
 * side channel (the comparison short-circuits on the first differing byte),
 * so we compare fixed-length buffers with timingSafeEqual instead.
 *
 * Returns false when the secret is unset or the header does not match.
 */
export function isValidCronAuth(
  authHeader: string | null,
  cronSecret: string | undefined = process.env.CRON_SECRET,
): boolean {
  if (!cronSecret || !authHeader) {
    return false;
  }

  const expected = Buffer.from(`Bearer ${cronSecret}`);
  const provided = Buffer.from(authHeader);

  // timingSafeEqual throws on length mismatch, so gate on length first. The
  // length of the expected token is not secret, so this branch is safe.
  if (expected.length !== provided.length) {
    return false;
  }

  return timingSafeEqual(expected, provided);
}
