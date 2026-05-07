import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { hasPermission, hasAnyPermission, type Permission } from "./rbac";
import prisma from "./prisma";
import { validateApiKey } from "./api-keys";
import {
  getOrgSuspensionStatus,
  requireActiveOrg,
  requireWriteAccess,
} from "./org-suspension";
import {
  isPlanFeatureEnabled,
  getRequiredPlan,
  type PlanFeature,
} from "./plan-features";

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
 * Require authentication for API routes.
 * Also blocks fully locked-out organizations (past grace period).
 */
export async function requireApiAuth(): Promise<AuthUser> {
  const user = await getAuthUser();

  // Check org suspension (block locked-out orgs from all access)
  const orgStatus = await getOrgSuspensionStatus(user.organizationId);
  const blocked = requireActiveOrg(orgStatus);
  if (blocked) {
    throw new Error("Forbidden: Organization suspended");
  }

  return user;
}

/**
 * Require that the user's org is fully active (not suspended or in grace period).
 * Call this in write endpoints (POST/PUT/PATCH/DELETE) after requireApiAuth/requireApiAdmin.
 */
export async function requireWritableOrg(user: AuthUser): Promise<void> {
  const orgStatus = await getOrgSuspensionStatus(user.organizationId);
  const blocked = requireWriteAccess(orgStatus);
  if (blocked) {
    throw new Error("Forbidden: Organization is in read-only mode");
  }
}

/**
 * Require that the user's org has a plan that includes a specific feature.
 * Self-hosted mode: always passes. Call after requireApiAuth/requireApiAdmin.
 */
export async function requirePlanFeature(
  user: AuthUser,
  feature: PlanFeature,
): Promise<void> {
  const enabled = await isPlanFeatureEnabled(user.organizationId, feature);
  if (!enabled) {
    const required = getRequiredPlan(feature);
    throw new Error(
      `Forbidden: This feature requires the ${required} plan. Please upgrade.`,
    );
  }
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
 * Require platform super-admin access for global settings.
 *
 * Super-admins are identified by email via the SUPER_ADMIN_EMAILS env var
 * (comma-separated). This gates access to platform-wide configuration
 * (SSO, LDAP, Freshdesk, integrations) that affects all tenants.
 */
export async function requireSuperAdmin(): Promise<AuthUser> {
  const user = await requireApiAdmin();

  const superAdminEmails = process.env.SUPER_ADMIN_EMAILS;
  if (!superAdminEmails) {
    // If no super-admin list is configured, all admins have access (single-tenant mode)
    return user;
  }

  const allowed = superAdminEmails
    .split(",")
    .map((e) => e.trim().toLowerCase());
  if (!user.email || !allowed.includes(user.email.toLowerCase())) {
    throw new Error("Forbidden: Super-admin access required");
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

  // API key scope enforcement — applies to ALL users, including admins.
  // apiKeyScopes is defined (even if empty) when authenticated via API key,
  // and undefined when authenticated via session cookie.
  if (user.apiKeyScopes !== undefined) {
    const hasScope = permissions.some((p) => user.apiKeyScopes!.includes(p));
    if (!hasScope) {
      throw new Error("Forbidden: API key lacks required scope");
    }
    return user;
  }

  // Admin users bypass RBAC permission checks (session auth only)
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
