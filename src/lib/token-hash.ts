import { createHash } from "node:crypto";

/**
 * SHA-256 hex digest used to store single-use secrets (password-reset and
 * set-password tokens, SCIM bearer tokens) at rest. The tokens are 128+ bit
 * random values, so a fast unsalted digest is enough: it only has to keep a
 * database leak from yielding usable tokens.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
