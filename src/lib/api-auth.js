import { auth } from "@/auth";

/**
 * Get authenticated user from session
 * Throws error if not authenticated
 * @returns {Promise<User>} The authenticated user
 */
export async function getAuthUser() {
  const session = await auth();

  if (!session || !session.user) {
    throw new Error("Unauthorized");
  }

  return session.user;
}

/**
 * Require authentication for API routes
 * @returns {Promise<User>} The authenticated user
 */
export async function requireApiAuth() {
  return await getAuthUser();
}

/**
 * Require admin role for API routes
 * @returns {Promise<User>} The authenticated admin user
 */
export async function requireApiAdmin() {
  const user = await getAuthUser();

  if (!user.isAdmin) {
    throw new Error("Forbidden: Admin access required");
  }

  return user;
}

/**
 * Check if user has request permission
 * @returns {Promise<User>} The authenticated user with request permission
 */
export async function requireApiCanRequest() {
  const user = await getAuthUser();

  if (!user.canRequest && !user.isAdmin) {
    throw new Error("Forbidden: Request permission required");
  }

  return user;
}
