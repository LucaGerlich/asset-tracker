import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  requirePermission,
  requireNotDemoMode,
  requireSuperAdmin,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { organizationSchema } from "@/lib/validation-organization";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit-log";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import {
  parsePaginationParams,
  buildPrismaArgs,
  buildPaginatedResponse,
} from "@/lib/pagination";
import { logger } from "@/lib/logger";
import { organizationApiSelect } from "@/lib/organizations";

const ORGANIZATION_SORT_FIELDS = ["name", "slug", "createdAt"];

export async function GET(req: NextRequest) {
  try {
    const authUser = await requirePermission("org:view");

    const searchParams = req.nextUrl.searchParams;

    // Scope to the user's own organization to prevent enumeration
    const orgFilter: Record<string, unknown> = authUser.organizationId
      ? { id: authUser.organizationId }
      : {};

    const select = {
      ...organizationApiSelect,
      _count: {
        select: { users: true, assets: true, departments: true },
      },
    };

    // If no `page` param, return all results for backward compatibility
    if (!searchParams.has("page")) {
      const organizations = await prisma.organization.findMany({
        where: orgFilter,
        select,
        orderBy: { name: "asc" },
      });
      return NextResponse.json(organizations);
    }

    // Paginated path
    const params = parsePaginationParams(searchParams);
    const prismaArgs = buildPrismaArgs(params, ORGANIZATION_SORT_FIELDS);

    const where: Record<string, unknown> = { ...orgFilter };

    // Search filter
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: "insensitive" } },
        { slug: { contains: params.search, mode: "insensitive" } },
      ];
    }

    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({ where, select, ...prismaArgs }),
      prisma.organization.count({ where }),
    ]);

    return NextResponse.json(
      buildPaginatedResponse(organizations, total, params),
      { status: 200 },
    );
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("Error fetching organizations", { error });
    return NextResponse.json(
      { error: "Failed to fetch organizations" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const authUser = await requireSuperAdmin();
    await requireWritableOrg(authUser);

    const body = await req.json();
    const validated = organizationSchema.parse(body);

    const existingOrg = await prisma.organization.findUnique({
      where: { slug: validated.slug },
    });

    if (existingOrg) {
      return NextResponse.json(
        { error: "Organization with this slug already exists" },
        { status: 400 },
      );
    }

    const organization = await prisma.organization.create({
      data: {
        name: validated.name,
        slug: validated.slug,
        description: validated.description,
        settings: validated.settings
          ? (validated.settings as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
      select: organizationApiSelect,
    });

    await createAuditLog({
      userId: authUser.id!,
      action: AUDIT_ACTIONS.CREATE,
      entity: "Organization",
      entityId: organization.id,
      details: { name: organization.name, slug: organization.slug },
    });

    return NextResponse.json(organization, { status: 201 });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("Error creating organization", { error });
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to create organization" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
