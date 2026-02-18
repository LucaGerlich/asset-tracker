/**
 * Security headers utility.
 *
 * Returns a set of standard HTTP security headers that should be applied to
 * every response.  The helper intentionally avoids external dependencies so it
 * can be used from both `next.config` and middleware without pulling in extra
 * packages.
 */

/**
 * Determine whether the current runtime environment is localhost / dev.
 * We check common env-vars set by Next.js and fall back to NODE_ENV.
 */
function isLocalhost(): boolean {
  // VERCEL_URL is only set on Vercel deployments
  if (process.env.VERCEL_URL) return false;

  // Explicit check for production
  if (process.env.NODE_ENV === "production") return false;

  return true;
}

/**
 * Returns a record of standard security headers suitable for all responses.
 *
 * Headers included:
 *  - X-Content-Type-Options  -- prevent MIME-type sniffing
 *  - X-Frame-Options         -- prevent click-jacking
 *  - X-XSS-Protection        -- legacy XSS filter (still useful for older browsers)
 *  - Referrer-Policy          -- limit referrer leakage
 *  - Permissions-Policy       -- restrict device APIs
 *  - Strict-Transport-Security (HSTS) -- only added when NOT on localhost
 */
export function getSecurityHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };

  if (!isLocalhost()) {
    headers["Strict-Transport-Security"] =
      "max-age=31536000; includeSubDomains";
  }

  return headers;
}
