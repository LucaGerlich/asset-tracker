import { type NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import {
  requireApiAuth,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
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
import {
  parsePaginationParams,
  buildPrismaArgs,
  buildPaginatedResponse,
} from "@/lib/pagination";
import { logger } from "@/lib/logger";
import { triggerWebhook } from "@/lib/webhooks";
import { invalidateCacheByPrefix } from "@/lib/cache";

const USER_SORT_FIELDS = ["firstname", "lastname", "email", "creation_date"];

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

      // Scope to organization (except for own profile)
      let user;
      if (authUser.id === id) {
        user = await prisma.user.findUnique({ where: { userid: id } });
      } else {
        const orgContext = await getOrganizationContext();
        const orgId = orgContext?.organization?.id;
        user = await prisma.user.findFirst({
          where: scopeToOrganization({ userid: id }, orgId),
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

    // If no `page` param, return all results for backward compatibility
    if (!searchParams.has("page")) {
      const baseWhere = scopeToOrganization({}, orgId);
      const where = await applyDepartmentScopeToUsers(baseWhere, authUser);
      const users = await prisma.user.findMany({ where });
      return NextResponse.json(users.map(stripPassword), { status: 200 });
    }

    // Paginated path
    const params = parsePaginationParams(searchParams);
    const prismaArgs = buildPrismaArgs(params, USER_SORT_FIELDS);

    const baseWhere: Record<string, unknown> = scopeToOrganization({}, orgId);

    // Full-text search using tsvector GIN index (falls back to ILIKE if needed)
    if (params.search) {
      const tsQuery = params.search.trim().split(/\s+/).join(" & ");
      const matchingIds = await prisma
        .$queryRawUnsafe<Array<{ userid: string }>>(
          `SELECT "userid" FROM "user" WHERE "search_vector" @@ websearch_to_tsquery('english', $1)`,
          tsQuery,
        )
        .catch(() => null);

      if (matchingIds && matchingIds.length > 0) {
        baseWhere.userid = { in: matchingIds.map((r) => r.userid) };
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
      prisma.user.findMany({ where, ...prismaArgs }),
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
      select: { change_date: true },
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

    const updateData = { ...validationResult.data } as Record<string, unknown>;
    // Strip password from profile update — it goes to accounts.password via setUserPassword.
    const newPassword = updateData.password as string | undefined;
    delete updateData.password;

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
