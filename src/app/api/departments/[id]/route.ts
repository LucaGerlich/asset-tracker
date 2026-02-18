import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { updateDepartmentSchema } from '@/lib/validation-organization';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/audit-log';
import { getOrganizationContext, scopeToOrganization } from '@/lib/organization-context';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgContext = await getOrganizationContext();
    const orgId = orgContext?.organization?.id;

    const department = await prisma.department.findFirst({
      where: scopeToOrganization({ id }, orgId),
      include: {
        organization: {
          select: { id: true, name: true, slug: true }
        },
        parent: {
          select: { id: true, name: true }
        },
        children: {
          select: { id: true, name: true }
        },
        _count: {
          select: { users: true }
        }
      }
    });

    if (!department) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    return NextResponse.json(department);
  } catch (error) {
    console.error('Error fetching department:', error);
    return NextResponse.json({ error: 'Failed to fetch department' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const orgContext = await getOrganizationContext();
    const orgId = orgContext?.organization?.id;

    const body = await req.json();
    const validated = updateDepartmentSchema.parse(body);

    const existingDepartment = await prisma.department.findFirst({
      where: scopeToOrganization({ id }, orgId)
    });

    if (!existingDepartment) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    // If parent is specified, verify it exists and belongs to same organization
    // Also prevent circular references
    if (validated.parentId) {
      if (validated.parentId === id) {
        return NextResponse.json({ error: 'Department cannot be its own parent' }, { status: 400 });
      }

      const parent = await prisma.department.findFirst({
        where: { 
          id: validated.parentId,
          organizationId: existingDepartment.organizationId
        }
      });

      if (!parent) {
        return NextResponse.json({ error: 'Parent department not found in this organization' }, { status: 404 });
      }
    }

    const department = await prisma.department.update({
      where: { id },
      data: {
        ...validated,
        updatedAt: new Date(),
      }
    });

    await createAuditLog({
      userId: session.user.id!,
      action: AUDIT_ACTIONS.UPDATE,
      entity: 'Department',
      entityId: department.id,
      details: validated as Record<string, unknown>,
    });

    return NextResponse.json(department);
  } catch (error) {
    console.error('Error updating department:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update department' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const orgContext = await getOrganizationContext();
    const orgId = orgContext?.organization?.id;

    const department = await prisma.department.findFirst({
      where: scopeToOrganization({ id }, orgId),
      include: {
        _count: {
          select: { children: true, users: true }
        }
      }
    });

    if (!department) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    if (department._count.children > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete department with sub-departments. Please delete or reassign child departments first.' 
      }, { status: 400 });
    }

    if (department._count.users > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete department with assigned users. Please reassign users first.' 
      }, { status: 400 });
    }

    await prisma.department.delete({
      where: { id }
    });

    await createAuditLog({
      userId: session.user.id!,
      action: AUDIT_ACTIONS.DELETE,
      entity: 'Department',
      entityId: id,
      details: { name: department.name },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting department:', error);
    return NextResponse.json({ error: 'Failed to delete department' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
