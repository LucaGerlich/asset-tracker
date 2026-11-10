import { type NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { searchIdsByFullText } from "@/lib/fulltext-search";
import {
  requireApiAuth,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import {
  findForeignReference,
  foreignReferenceError,
} from "@/lib/org-references";
import {
  assertEmailAssignable,
  EmailConflictError,
} from "@/lib/email-ownership";
import { isSuperAdmin } from "@/lib/super-admin";
import { hasPermission } from "@/lib/rbac";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";
import { applyDepartmentScopeToUsers } from "@/lib/department-access";
import { updateUserSchema } from "@/lib/validation";
import { setUserPassword } from "@/lib/auth-utils";
import { findAdminDemotionViolation } from "@/lib/admin-demotion";
import {
  parsePaginationParams,
  buildPrismaArgs,
  buildPaginatedResponse,
} from "@/lib/pagination";
import { logger } from "@/lib/logger";
import { triggerWebhook } from "@/lib/webhooks";
import { invalidateCacheByPrefix } from "@/lib/cache";
import { memberUserSelect } from "@/lib/user-select";
import type { Prisma } from "@prisma/client";

const USER_SORT_FIELDS = ["firstname", "lastname", "email", "creation_date"];

/**
 * Non-admins see colleagues with public columns only: no SCIM/SSO
 * bookkeeping, auth provider, 2FA state or access-expiry dates.
 */
const viewerSelect = (isAdmin: boolean): { select?: Prisma.userSelect } =>
  isAdmin ? {} : { select: memberUserSelect };

const stripPassword = (user) => {
  if (!user) return user;
  const { password: _password, ldapDN: _ldapDN, ...rest } = user;
  return rest;
};

// Optional query: ?id=<userid>
// Pagination: ?page=1&pageSize=25&sortBy=lastname&sortOrder=asc&search=keyword
export async function GET(req: NextRequest) {
  try {
    const authUser = await requireApiAuth();
    const searchParams = req.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (id) {
      // Users can view their own profile; others need user:view permission
      if (authUser.id !== id) {
        const canViewUsers =
          authUser.isAdmin ||
          (authUser.id ? await hasPermission(authUser.id, "user:view") : false);
        if (!canViewUsers) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }

      // Scope to organization (except for own profile). Colleagues are shown
      // to non-admins with public columns only.
      let user;
      if (authUser.id === id) {
        user = await prisma.user.findUnique({ where: { userid: id } });
      } else {
        const orgContext = await getOrganizationContext();
        const orgId = orgContext?.organization?.id;
        user = await prisma.user.findFirst({
          where: scopeToOrganization({ userid: id }, orgId),
          ...viewerSelect(Boolean(authUser.isAdmin)),
        });
      }

      if (!user) {
        return NextResponse.json(
          { error: `User with id ${id} not found` },
          { status: 404 },
        );
      }
      return NextResponse.json(stripPassword(user), { status: 200 });
    }

    // Listing all users requires user:view permission
    const canViewUsers =
      authUser.isAdmin ||
      (authUser.id ? await hasPermission(authUser.id, "user:view") : false);
    if (!canViewUsers) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const orgContext = await getOrganizationContext();
    const orgId = orgContext?.organization?.id;
    const listSelect = viewerSelect(Boolean(authUser.isAdmin));

    // If no `page` param, return all results for backward compatibility
    if (!searchParams.has("page")) {
      const baseWhere = scopeToOrganization({}, orgId);
      const where = await applyDepartmentScopeToUsers(baseWhere, authUser);
      const users = await prisma.user.findMany({ where, ...listSelect });
      return NextResponse.json(users.map(stripPassword), { status: 200 });
    }

    // Paginated path
    const params = parsePaginationParams(searchParams);
    const prismaArgs = buildPrismaArgs(params, USER_SORT_FIELDS);

    const baseWhere: Record<string, unknown> = scopeToOrganization({}, orgId);

    // Full-text search using tsvector GIN index (falls back to ILIKE if needed)
    if (params.search) {
      const matchingIds = await searchIdsByFullText(
        "user",
        orgId,
        params.search,
      );

      if (matchingIds && matchingIds.length > 0) {
        baseWhere.userid = { in: matchingIds };
      } else if (matchingIds) {
        // tsvector returned no results — empty set
        baseWhere.userid = { in: [] };
      } else {
        // Fallback to ILIKE if tsvector query failed (e.g. migration not applied yet)
        baseWhere.OR = [
          { firstname: { contains: params.search, mode: "insensitive" } },
          { lastname: { contains: params.search, mode: "insensitive" } },
          { email: { contains: params.search, mode: "insensitive" } },
          { username: { contains: params.search, mode: "insensitive" } },
        ];
      }
    }

    const where = await applyDepartmentScopeToUsers(baseWhere, authUser);

    const [users, total] = await Promise.all([
      prisma.user.findMany({ where, ...prismaArgs, ...listSelect }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json(
      buildPaginatedResponse(users.map(stripPassword), total, params),
      { status: 200 },
    );
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("GET /api/user error", { error });
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 },
    );
  }
}

// PUT /api/user
// Body must include userid; any provided fields will be updated
export async function PUT(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const authUser = await requireApiAuth();
    await requireWritableOrg(authUser);
    const body = await req.json();
    const { userid, password, _expectedVersion, ...data } = body || {};

    if (!userid) {
      return NextResponse.json(
        { error: "userid is required to update a user" },
        { status: 400 },
      );
    }

    if (!authUser.isAdmin && authUser.id !== userid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Resolve the target inside the caller's org before anything that could
    // reveal whether the id exists elsewhere (such as the version check
    // below): a foreign and a missing user must look the same.
    const targetUser = await prisma.user.findFirst({
      where: scopeToOrganization({ userid }, authUser.organizationId),
      select: { change_date: true, email: true, username: true },
    });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (
      _expectedVersion &&
      targetUser.change_date &&
      new Date(_expectedVersion).getTime() !==
        new Date(targetUser.change_date).getTime()
    ) {
      return NextResponse.json(
        {
          error:
            "This user was modified by another admin. Please refresh and try again.",
        },
        { status: 409 },
      );
    }

    // A user's own password and email are credentials: they change through
    // /api/auth/change-password (current password, rate limit, session
    // revocation) and the email-change flow, not through this profile route.
    // The edit form echoes the unchanged email back, which stays allowed. A
    // user without a stored email may set one, since there is nothing to protect.
    const isSelf = authUser.id === userid;
    if (isSelf) {
      if (typeof password === "string" && password.length > 0) {
        return NextResponse.json(
          {
            error:
              "Use the change password flow in your account settings to change your own password",
          },
          { status: 400 },
        );
      }
      if (
        targetUser.email &&
        typeof data.email === "string" &&
        data.email !== "" &&
        data.email.toLowerCase() !== targetUser.email.toLowerCase()
      ) {
        return NextResponse.json(
          {
            error:
              "Your own email address cannot be changed here. Ask an administrator.",
          },
          { status: 400 },
        );
      }
    }

    const schema = authUser.isAdmin
      ? updateUserSchema
      : updateUserSchema.omit({
          isadmin: true,
          canrequest: true,
          departmentId: true,
          accessExpiresAt: true,
        });

    // Convert empty strings to undefined so optional fields pass validation
    const cleanedData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      cleanedData[key] = value === "" ? undefined : value;
    }
    // Invite, SSO and SCIM users have their email as username, which the
    // no-"@" username policy rejects. The edit form echoes it back unchanged,
    // so the policy only applies when the username actually changes.
    if (cleanedData.username === targetUser.username) {
      delete cleanedData.username;
    }

    const validationResult = schema.strict().safeParse({
      ...cleanedData,
      ...(typeof password === "string" && password.length > 0
        ? { password }
        : {}),
    });

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validationResult.error.issues },
        { status: 400 },
      );
    }

    // Removing admin rights goes through the same guard as the permissions
    // routes: no self-demotion and never the org's last active admin.
    if ((validationResult.data as { isadmin?: boolean }).isadmin === false) {
      const violation = await findAdminDemotionViolation({
        callerId: authUser.id,
        targetUserIds: [userid],
        organizationId: authUser.organizationId,
      });
      if (violation) {
        return NextResponse.json({ error: violation }, { status: 400 });
      }
    }

    // departmentId is admin-only; the non-admin schema omits it.
    const foreign = await findForeignReference(authUser.organizationId, {
      department: (validationResult.data as { departmentId?: string | null })
        .departmentId,
    });
    if (foreign) {
      return NextResponse.json(foreignReferenceError(foreign), {
        status: 400,
      });
    }

    const updateData = { ...validationResult.data } as Record<string, unknown>;
    // Strip password from profile update — it goes to accounts.password via setUserPassword.
    const newPassword = updateData.password as string | undefined;
    delete updateData.password;

    // A stored own email is never rewritten here (see above); an echoed value
    // is dropped. Only a missing email can be set.
    if (isSelf && targetUser.email) delete updateData.email;

    // Only an email that is actually being set needs an ownership check.
    if (typeof updateData.email === "string") {
      updateData.email = await assertEmailAssignable(updateData.email, {
        excludeUserId: userid,
        callerIsSuperAdmin: await isSuperAdmin(authUser),
      });
    }

    // Convert accessExpiresAt string to Date or null
    if ("accessExpiresAt" in updateData) {
      updateData.accessExpiresAt = updateData.accessExpiresAt
        ? new Date(updateData.accessExpiresAt as string)
        : null;
    }

    let updated;
    if (_expectedVersion) {
      // Atomic optimistic-lock write: only update if change_date still matches
      // the version the client loaded, closing the read-check → write window.
      const result = await prisma.user.updateMany({
        where: { userid, change_date: new Date(_expectedVersion) },
        data: {
          ...updateData,
          change_date: new Date(),
        },
      });
      if (result.count === 0) {
        return NextResponse.json(
          {
            error:
              "This user was modified by another admin. Please refresh and try again.",
          },
          { status: 409 },
        );
      }
      updated = await prisma.user.findUnique({ where: { userid } });
    } else {
      updated = await prisma.user.update({
        where: { userid },
        data: {
          ...updateData,
          change_date: new Date(),
        },
      });
    }

    if (!updated) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (newPassword) {
      await setUserPassword(userid, newPassword);
    }

    triggerWebhook(
      "user.updated",
      {
        userId: userid,
        changes: [
          ...Object.keys(updateData),
          ...(newPassword ? ["password"] : []),
        ],
      },
      updated.organizationId,
    ).catch(() => {});

    await invalidateCacheByPrefix("users").catch(() => {});
    await invalidateCacheByPrefix("user_count").catch(() => {});

    return NextResponse.json(stripPassword(updated), { status: 200 });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    if (error instanceof EmailConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    logger.error("PUT /api/user error", { error });
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
