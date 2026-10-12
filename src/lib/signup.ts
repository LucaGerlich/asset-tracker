/**
 * Whether anyone may create a new organization through public sign-up
 * (`/register` and `POST /api/auth/register`).
 *
 * Closed by default: self-hosted installs and the setup flow create their
 * first admin without it. The SaaS deployment opts in with
 * ALLOW_PUBLIC_SIGNUP=true. Only the exact string "true" opens sign-up.
 */
export function isPublicSignupEnabled(): boolean {
  return process.env.ALLOW_PUBLIC_SIGNUP === "true";
}
