import { auth } from "@/auth";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";

interface ExtendedSession extends Session {
  user: {
    id?: string;
    isAdmin?: boolean;
    canRequest?: boolean;
    name?: string | null;
    email?: string | null;
    username?: string;
    firstname?: string;
    lastname?: string;
  };
}

/**
 * Require authentication for a page
 * Redirects to login if not authenticated
 */
export async function requireAuth(): Promise<ExtendedSession> {
  const session = await auth();

  if (!session || !session.user) {
    redirect("/login");
  }

  return session as ExtendedSession;
}

/**
 * Require admin role for a page
 * Redirects to login if not authenticated
 * Redirects to home if not admin
 */
export async function requireAdmin(): Promise<ExtendedSession> {
  const session = await requireAuth();

  if (!(session.user as { isAdmin?: boolean }).isAdmin) {
    redirect("/");
  }

  return session;
}

/**
 * Require request permission for a page
 * Throws error if user doesn't have permission
 */
export async function requireCanRequest(): Promise<ExtendedSession> {
  const session = await requireAuth();
  const user = session.user as { canRequest?: boolean; isAdmin?: boolean };

  if (!user.canRequest && !user.isAdmin) {
    throw new Error("You do not have permission to request items");
  }

  return session;
}
