import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  requirePermission,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { departmentSchema } from "@/lib/validation-organization";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit-log";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";
import { z } from "zod";
import {
  parsePaginationParams,
  buildPrismaArgs,
  buildPaginatedResponse,
} from "@/lib/pagination";
import { logger } from "@/lib/logger";

const DEPARTMENT_SORT_FIELDS = ["name", "createdAt"];

export async function GET(req: NextRequest) {
  try {
    await requirePermission("dept:view");

    const orgContext = await getOrganizationContext();
    const orgId = orgContext?.organization?.id;

    const searchParams = req.nextUrl.searchParams;
    const organizationId = searchParams.get("organizationId");

    // Use the query param if provided, otherwise scope to user's org
    const where: Record<string, unknown> = scopeToOrganization(
      organizationId ? { organizationId } : {},
      orgId,
    );

    const include = {
      organization: {
        select: { id: true, name: true, slug: true },
      },
      parent: {
        select: { id: true, name: true },
      },
      _count: {
        select: { children: true, users: true },
      },
    };

    // If no `page` param, return all results for backward compatibility
    if (!searchParams.has("page")) {
      const departments = await prisma.department.findMany({
        where,
        include,
        orderBy: { name: "asc" },
      });
      return NextResponse.json(departments);
    }

    // Paginated path
    const params = parsePaginationParams(searchParams);
    const prismaArgs = buildPrismaArgs(params, DEPARTMENT_SORT_FIELDS);

    // Search filter
    if (params.search) {
      where.OR = [{ name: { contains: params.search, mode: "insensitive" } }];
    }

    const [departments, total] = await Promise.all([
      prisma.department.findMany({ where, include, ...prismaArgs }),
      prisma.department.count({ where }),
    ]);

    return NextResponse.json(
      buildPaginatedResponse(departments, total, params),
      { status: 200 },
    );
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("Error fetching departments", { error });
    return NextResponse.json(
      { error: "Failed to fetch departments" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const authUser = await requirePermission("dept:manage");
    await requireWritableOrg(authUser);

    // A department always belongs to the caller's own org; a caller without
    // an org cannot create one.
    const orgId = authUser.organizationId;
    if (!orgId) {
      return NextResponse.json(
        { error: "An organization is required to create departments" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const validated = departmentSchema.parse(body);

    // The body organizationId is never used; if sent, it must be the caller's.
    if (validated.organizationId && validated.organizationId !== orgId) {
      return NextResponse.json(
        { error: "Cannot create department in another organization" },
        { status: 403 },
      );
    }

    // If parent is specified, verify it exists and belongs to the same organization
    if (validated.parentId) {
      const parent = await prisma.department.findFirst({
        where: {
          id: validated.parentId,
          organizationId: orgId,
        },
      });

      if (!parent) {
        return NextResponse.json(
          { error: "Parent department not found in this organization" },
          { status: 404 },
        );
      }
    }

    const department = await prisma.department.create({
      data: {
        name: validated.name,
        description: validated.description,
        organizationId: orgId,
        parentId: validated.parentId || null,
      },
      include: {
        organization: {
          select: { id: true, name: true },
        },
      },
    });

    await createAuditLog({
      userId: authUser.id!,
      action: AUDIT_ACTIONS.CREATE,
      entity: "Department",
      entityId: department.id,
      details: {
        name: department.name,
        organizationId: department.organizationId,
      },
    });

    return NextResponse.json(department, { status: 201 });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("Error creating department", { error });
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to create department" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
