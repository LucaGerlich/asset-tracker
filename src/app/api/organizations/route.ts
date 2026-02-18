import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/api-auth';
import { organizationSchema } from '@/lib/validation-organization';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/audit-log';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import {
  parsePaginationParams,
  buildPrismaArgs,
  buildPaginatedResponse,
} from "@/lib/pagination";

const ORGANIZATION_SORT_FIELDS = ["name", "slug", "createdAt"];

export async function GET(req: NextRequest) {
  try {
    await requirePermission('org:view');

    const searchParams = req.nextUrl.searchParams;

    const include = {
      _count: {
        select: { users: true, assets: true, departments: true }
      }
    };

    // If no `page` param, return all results for backward compatibility
    if (!searchParams.has("page")) {
      const organizations = await prisma.organization.findMany({
        include,
        orderBy: { name: 'asc' }
      });
      return NextResponse.json(organizations);
    }

    // Paginated path
    const params = parsePaginationParams(searchParams);
    const prismaArgs = buildPrismaArgs(params, ORGANIZATION_SORT_FIELDS);

    const where: Record<string, unknown> = {};

    // Search filter
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: "insensitive" } },
        { slug: { contains: params.search, mode: "insensitive" } },
      ];
    }

    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({ where, include, ...prismaArgs }),
      prisma.organization.count({ where }),
    ]);

    return NextResponse.json(
      buildPaginatedResponse(organizations, total, params),
      { status: 200 },
    );
  } catch (error) {
    console.error('Error fetching organizations:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await requirePermission('org:manage');

    const body = await req.json();
    const validated = organizationSchema.parse(body);

    // Check if slug is unique
    const existingOrg = await prisma.organization.findUnique({
      where: { slug: validated.slug }
    });

    if (existingOrg) {
      return NextResponse.json({ error: 'Organization with this slug already exists' }, { status: 400 });
    }

    const organization = await prisma.organization.create({
      data: {
        name: validated.name,
        slug: validated.slug,
        description: validated.description,
        settings: validated.settings ? (validated.settings as Prisma.InputJsonValue) : Prisma.JsonNull,
        isActive: validated.isActive,
      }
    });

    await createAuditLog({
      userId: authUser.id!,
      action: AUDIT_ACTIONS.CREATE,
      entity: 'Organization',
      entityId: organization.id,
      details: { name: organization.name, slug: organization.slug },
    });

    return NextResponse.json(organization, { status: 201 });
  } catch (error) {
    console.error('Error creating organization:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
