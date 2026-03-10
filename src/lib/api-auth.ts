import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { hasPermission, hasAnyPermission, type Permission } from "./rbac";
import prisma from "./prisma";
import { validateApiKey } from "./api-keys";

/**
 * Block mutating operations in demo mode.
 * Returns a 403 response if DEMO_MODE is enabled, null otherwise.
 */
export function requireNotDemoMode() {
  if (process.env.DEMO_MODE === "true") {
    return NextResponse.json(
      { error: "This action is disabled in demo mode" },
      { status: 403 },
    );
  }
  return null;
}

export interface AuthUser {
  id?: string;
  isAdmin?: boolean;
  canRequest?: boolean;
  name?: string | null;
  email?: string | null;
  username?: string;
  firstname?: string;
  lastname?: string;
  organizationId?: string;
  /** The department this user belongs to (null if unassigned) */
  departmentId?: string | null;
  /** Set when authenticated via API key instead of session */
  apiKeyId?: string;
  /** Scopes granted to the API key (undefined for session auth) */
  apiKeyScopes?: string[];
}

/**
 * Extract Bearer token from Authorization header if it looks like an API key.
 */
async function getApiKeyFromHeaders(): Promise<string | null> {
  const hdrs = await headers();
  const authHeader = hdrs.get("authorization");
  if (!authHeader) return null;

  const match = authHeader.match(/^Bearer\s+(at_.+)$/i);
  return match ? match[1] : null;
}

/**
 * Authenticate via API key.
 * Returns an AuthUser or null if the key is invalid.
 */
async function authenticateWithApiKey(
  apiKey: string,
): Promise<AuthUser | null> {
  const record = await validateApiKey(apiKey);
  if (!record) return null;

  const dbUser = record.user;
  if (!dbUser || !dbUser.isActive) return null;

  return {
    id: dbUser.userid,
    name: `${dbUser.firstname} ${dbUser.lastname}`,
    email: dbUser.email,
    username: dbUser.username || undefined,
    firstname: dbUser.firstname,
    lastname: dbUser.lastname,
    isAdmin: dbUser.isadmin,
    canRequest: dbUser.canrequest,
    organizationId: dbUser.organizationId || undefined,
    apiKeyId: record.id,
    apiKeyScopes: record.scopes,
  };
}

/**
 * Get authenticated user from session or API key.
 * First checks for an API key in the Authorization header (Bearer at_...),
 * then falls back to BetterAuth session authentication.
 */
export async function getAuthUser(): Promise<AuthUser> {
  // Try API key authentication first
  const apiKey = await getApiKeyFromHeaders();
  if (apiKey) {
    const user = await authenticateWithApiKey(apiKey);
    if (!user) {
      throw new Error("Unauthorized");
    }
    return user;
  }

  // Fall back to session authentication
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || !session.user) {
    throw new Error("Unauthorized");
  }

  // Fetch custom user fields from DB
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
    throw new Error("Unauthorized");
  }

  return {
    id: dbUser.userid,
    name: `${dbUser.firstname} ${dbUser.lastname}`,
    email: dbUser.email,
    username: dbUser.username || undefined,
    firstname: dbUser.firstname,
    lastname: dbUser.lastname,
    isAdmin: dbUser.isadmin,
    canRequest: dbUser.canrequest,
    organizationId: dbUser.organizationId || undefined,
    departmentId: dbUser.departmentId,
  };
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

/**
 * Require specific permission(s) for API routes
 * Checks RBAC permissions via user roles. Admin users pass all checks.
 */
export async function requirePermission(
  ...permissions: Permission[]
): Promise<AuthUser> {
  const user = await getAuthUser();

  if (!user.id) {
    throw new Error("Unauthorized");
  }

  // Admin users bypass permission checks
  if (user.isAdmin) {
    return user;
  }

  const hasAccess =
    permissions.length === 1
      ? await hasPermission(user.id, permissions[0])
      : await hasAnyPermission(user.id, permissions);

  if (!hasAccess) {
    throw new Error("Forbidden: Insufficient permissions");
  }

  return user;
}
