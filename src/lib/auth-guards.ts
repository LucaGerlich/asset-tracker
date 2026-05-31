import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "./prisma";

interface ExtendedSession {
  user: {
    id?: string;
    isAdmin?: boolean;
    canRequest?: boolean;
    name?: string | null;
    email?: string | null;
    username?: string;
    firstname?: string;
    lastname?: string;
    organizationId?: string;
    departmentId?: string;
  };
}

/**
 * Require authentication for a page.
 * Redirects to login if not authenticated.
 */
export async function requireAuth(): Promise<ExtendedSession> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || !session.user) {
    redirect("/login");
  }

  const dbUser = await prisma.user.findUnique({
    where: { userid: session.user.id },
    select: {
      userid: true,
      username: true,
      firstname: true,
      lastname: true,
      email: true,
      isadmin: true,
      canrequest: true,
      organizationId: true,
      departmentId: true,
      isActive: true,
    },
  });

  if (!dbUser || !dbUser.isActive) {
    redirect("/login");
  }

  return {
    user: {
      id: dbUser.userid,
      name: `${dbUser.firstname} ${dbUser.lastname}`,
      email: dbUser.email,
      username: dbUser.username || undefined,
      firstname: dbUser.firstname,
      lastname: dbUser.lastname,
      isAdmin: dbUser.isadmin,
      canRequest: dbUser.canrequest,
      organizationId: dbUser.organizationId || undefined,
      departmentId: dbUser.departmentId || undefined,
    },
  };
}

/**
 * Require admin role for a page.
 * Redirects to login if not authenticated.
 * Redirects to home if not admin.
 */
export async function requireAdmin(): Promise<ExtendedSession> {
  const session = await requireAuth();

  if (!session.user.isAdmin) {
    redirect("/dashboard");
  }

  return session;
}

/**
 * Require request permission for a page.
 */
export async function requireCanRequest(): Promise<ExtendedSession> {
  const session = await requireAuth();

  if (!session.user.canRequest && !session.user.isAdmin) {
    throw new Error("You do not have permission to request items");
  }

  return session;
}
