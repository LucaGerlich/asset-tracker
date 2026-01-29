import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { departmentSchema } from '@/lib/validation-organization';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/audit-log';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = req.nextUrl.searchParams.get('organizationId');

    const where = organizationId ? { organizationId } : {};

    const departments = await prisma.department.findMany({
      where,
      include: {
        organization: {
          select: { id: true, name: true, slug: true }
        },
        parent: {
          select: { id: true, name: true }
        },
        _count: {
          select: { children: true, users: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json(departments);
  } catch (error) {
    console.error('Error fetching departments:', error);
    return NextResponse.json({ error: 'Failed to fetch departments' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const validated = departmentSchema.parse(body);

    // Verify organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: validated.organizationId }
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // If parent is specified, verify it exists and belongs to same organization
    if (validated.parentId) {
      const parent = await prisma.department.findFirst({
        where: { 
          id: validated.parentId,
          organizationId: validated.organizationId
        }
      });

      if (!parent) {
        return NextResponse.json({ error: 'Parent department not found in this organization' }, { status: 404 });
      }
    }

    const department = await prisma.department.create({
      data: {
        name: validated.name,
        description: validated.description,
        organizationId: validated.organizationId,
        parentId: validated.parentId || null,
      },
      include: {
        organization: {
          select: { id: true, name: true }
        }
      }
    });

    await createAuditLog({
      userId: session.user.id!,
      action: AUDIT_ACTIONS.CREATE,
      entity: 'Department',
      entityId: department.id,
      details: { name: department.name, organizationId: department.organizationId },
    });

    return NextResponse.json(department, { status: 201 });
  } catch (error) {
    console.error('Error creating department:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create department' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
