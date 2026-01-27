import { auth } from "@/auth";

interface AuthUser {
  id?: string;
  isAdmin?: boolean;
  canRequest?: boolean;
  name?: string | null;
  email?: string | null;
  username?: string;
  firstname?: string;
  lastname?: string;
}

/**
 * Get authenticated user from session
 * Throws error if not authenticated
 */
export async function getAuthUser(): Promise<AuthUser> {
  const session = await auth();

  if (!session || !session.user) {
    throw new Error("Unauthorized");
  }

  return session.user as AuthUser;
}

/**
 * Require authentication for API routes
 */
export async function requireApiAuth(): Promise<AuthUser> {
  return await getAuthUser();
}

/**
 * Require admin role for API routes
 */
export async function requireApiAdmin(): Promise<AuthUser> {
  const user = await getAuthUser();

  if (!user.isAdmin) {
    throw new Error("Forbidden: Admin access required");
  }

  return user;
}

/**
 * Check if user has request permission
 */
export async function requireApiCanRequest(): Promise<AuthUser> {
  const user = await getAuthUser();

  if (!user.canRequest && !user.isAdmin) {
    throw new Error("Forbidden: Request permission required");
  }

  return user;
}
