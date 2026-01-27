import { auth } from "@/auth";
import { redirect } from "next/navigation";

/**
 * Require authentication for a page
 * Redirects to login if not authenticated
 * @returns {Promise<Session>} The user session
 */
export async function requireAuth() {
  const session = await auth();

  if (!session || !session.user) {
    redirect("/login");
  }

  return session;
}

/**
 * Require admin role for a page
 * Redirects to login if not authenticated
 * Redirects to home if not admin
 * @returns {Promise<Session>} The user session
 */
export async function requireAdmin() {
  const session = await requireAuth();

  if (!session.user.isAdmin) {
    redirect("/");
  }

  return session;
}

/**
 * Require request permission for a page
 * Throws error if user doesn't have permission
 * @returns {Promise<Session>} The user session
 */
export async function requireCanRequest() {
  const session = await requireAuth();

  if (!session.user.canRequest && !session.user.isAdmin) {
    throw new Error("You do not have permission to request items");
  }

  return session;
}
