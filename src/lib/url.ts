/**
 * Returns the application's base URL.
 *
 * Checks environment variables in order of precedence:
 *   BETTER_AUTH_URL > NEXTAUTH_URL > NEXT_PUBLIC_APP_URL
 *
 * Throws in production if none are set, to prevent silent failures
 * (e.g., SSO callbacks, invite emails, magic links routing to localhost).
 * Falls back to localhost only in development.
 */
export function getBaseUrl(): string {
  const url =
    process.env.BETTER_AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL;

  if (url) return url;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Missing BETTER_AUTH_URL, NEXTAUTH_URL, or NEXT_PUBLIC_APP_URL. " +
        "One must be set in production to generate correct URLs for SSO, invites, and magic links.",
    );
  }

  return "http://localhost:3000";
}
