/**
 * Webhook rows as API responses. The stored secret is encrypted, and global
 * webhooks (no organization) are listed to every tenant, so it never leaves the
 * server: callers learn only whether one is set. A new secret is written
 * through PUT, never read back.
 */
export type PublicWebhook<T extends { secret: string | null }> = Omit<
  T,
  "secret"
> & { hasSecret: boolean };

export function toPublicWebhook<T extends { secret: string | null }>(
  webhook: T,
): PublicWebhook<T> {
  const { secret, ...rest } = webhook;
  return { ...rest, hasSecret: Boolean(secret) };
}
