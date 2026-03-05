/**
 * BetterAuth React client
 *
 * Client-side auth hooks and methods for use in React components.
 * Replaces NextAuth's useSession, signIn, signOut.
 */

import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";
import { usernameClient } from "better-auth/plugins/username/client";

/** User fields available in BetterAuth session (includes additionalFields) */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
  twoFactorEnabled?: boolean;
  // Custom additionalFields
  firstname?: string;
  lastname?: string;
  username?: string;
  isadmin?: boolean;
  canrequest?: boolean;
  organizationId?: string;
  departmentId?: string;
  authProvider?: string;
  isActive?: boolean;
  mfaEnabled?: boolean;
}

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : undefined,
  plugins: [usernameClient(), twoFactorClient()],
});

// Re-export commonly used methods for convenience
export const { signIn, signOut, useSession } = authClient;
