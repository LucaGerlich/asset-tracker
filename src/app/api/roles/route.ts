import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { roleSchema } from '@/lib/validation-organization';
import { PERMISSIONS, getAllPermissions } from '@/lib/rbac';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/audit-log';
import { z } from 'zod';
import {
  parsePaginationParams,
  buildPrismaArgs,
  buildPaginatedResponse,
} from "@/lib/pagination";

const ROLE_SORT_FIELDS = ["name", "createdAt"];

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = req.nextUrl.searchParams;

    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { userid: session.user.id! },
      select: { organizationId: true }
    });

    const where: Record<string, unknown> = user?.organizationId ? {
      OR: [
        { organizationId: user.organizationId },
        { organizationId: null } // System roles
      ]
    } : {};

    const include = {
      organization: {
        select: { id: true, name: true }
      },
      _count: {
        select: { userRoles: true }
      }
    };

    // If no `page` param, return all results for backward compatibility
    if (!searchParams.has("page")) {
      const roles = await prisma.role.findMany({
        where,
        include,
        orderBy: [
          { isSystem: 'desc' },
          { name: 'asc' }
        ]
      });
      return NextResponse.json(roles);
    }

    // Paginated path
    const params = parsePaginationParams(searchParams);
    const prismaArgs = buildPrismaArgs(params, ROLE_SORT_FIELDS);

    // Search filter
    if (params.search) {
      const searchOR = [
        { name: { contains: params.search, mode: "insensitive" } },
      ];
      if (where.OR) {
        // Wrap existing org-scoping OR and search OR in AND
        where.AND = [{ OR: where.OR as unknown[] }, { OR: searchOR }];
        delete where.OR;
      } else {
        where.OR = searchOR;
      }
    }

    const [roles, total] = await Promise.all([
      prisma.role.findMany({ where, include, ...prismaArgs }),
      prisma.role.count({ where }),
    ]);

    return NextResponse.json(
      buildPaginatedResponse(roles, total, params),
      { status: 200 },
    );
  } catch (error) {
    console.error('Error fetching roles:', error);
    return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const validated = roleSchema.parse(body);

    // Validate permissions
    const validPermissions = Object.keys(PERMISSIONS);
    const invalidPerms = validated.permissions.filter(p => !validPermissions.includes(p));
    if (invalidPerms.length > 0) {
      return NextResponse.json({ 
        error: `Invalid permissions: ${invalidPerms.join(', ')}`,
        validPermissions 
      }, { status: 400 });
    }

    // Get user's organization if not specified
    let organizationId = validated.organizationId;
    if (!organizationId) {
      const user = await prisma.user.findUnique({
        where: { userid: session.user.id! },
        select: { organizationId: true }
      });
      organizationId = user?.organizationId || null;
    }

    // Check for duplicate name within organization
    const existingRole = await prisma.role.findFirst({
      where: {
        name: validated.name,
        organizationId: organizationId || null
      }
    });

    if (existingRole) {
      return NextResponse.json({ error: 'Role with this name already exists' }, { status: 400 });
    }

    const role = await prisma.role.create({
      data: {
        name: validated.name,
        description: validated.description,
        permissions: validated.permissions,
        organizationId: organizationId || null,
        isSystem: false,
      }
    });

    await createAuditLog({
      userId: session.user.id!,
      action: AUDIT_ACTIONS.CREATE,
      entity: 'Role',
      entityId: role.id,
      details: { name: role.name, permissions: role.permissions },
    });

    return NextResponse.json(role, { status: 201 });
  } catch (error) {
    console.error('Error creating role:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create role' }, { status: 500 });
  }
}

// Get list of available permissions
export async function OPTIONS() {
  const permissions = getAllPermissions();
  return NextResponse.json({ permissions });
}

export const dynamic = 'force-dynamic';
