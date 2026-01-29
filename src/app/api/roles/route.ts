import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { roleSchema } from '@/lib/validation-organization';
import { PERMISSIONS, getAllPermissions } from '@/lib/rbac';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/audit-log';
import { z } from 'zod';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { userid: session.user.id! },
      select: { organizationId: true }
    });

    const roles = await prisma.role.findMany({
      where: user?.organizationId ? {
        OR: [
          { organizationId: user.organizationId },
          { organizationId: null } // System roles
        ]
      } : {},
      include: {
        organization: {
          select: { id: true, name: true }
        },
        _count: {
          select: { userRoles: true }
        }
      },
      orderBy: [
        { isSystem: 'desc' },
        { name: 'asc' }
      ]
    });

    return NextResponse.json(roles);
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
