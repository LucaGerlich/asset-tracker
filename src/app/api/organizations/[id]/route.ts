import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { updateOrganizationSchema } from '@/lib/validation-organization';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/audit-log';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

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

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        departments: {
          orderBy: { name: 'asc' }
        },
        _count: {
          select: { users: true, assets: true, accessories: true, licences: true }
        }
      }
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json(organization);
  } catch (error) {
    console.error('Error fetching organization:', error);
    return NextResponse.json({ error: 'Failed to fetch organization' }, { status: 500 });
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

    const body = await req.json();
    const validated = updateOrganizationSchema.parse(body);

    // Check if slug is unique (excluding current organization)
    if (validated.slug) {
      const existingOrg = await prisma.organization.findFirst({
        where: { 
          slug: validated.slug,
          NOT: { id }
        }
      });

      if (existingOrg) {
        return NextResponse.json({ error: 'Organization with this slug already exists' }, { status: 400 });
      }
    }

    const updateData: {
      name?: string;
      slug?: string;
      description?: string | null;
      settings?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
      isActive?: boolean;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.slug !== undefined) updateData.slug = validated.slug;
    if (validated.description !== undefined) updateData.description = validated.description;
    if (validated.settings !== undefined) {
      updateData.settings = validated.settings ? (validated.settings as Prisma.InputJsonValue) : Prisma.JsonNull;
    }
    if (validated.isActive !== undefined) updateData.isActive = validated.isActive;

    const organization = await prisma.organization.update({
      where: { id },
      data: updateData
    });

    await createAuditLog({
      userId: session.user.id!,
      action: AUDIT_ACTIONS.UPDATE,
      entity: 'Organization',
      entityId: organization.id,
      details: validated as Record<string, unknown>,
    });

    return NextResponse.json(organization);
  } catch (error) {
    console.error('Error updating organization:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update organization' }, { status: 500 });
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

    // Check if organization has any associated data
    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true, assets: true, accessories: true, licences: true, consumables: true }
        }
      }
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const totalRelatedItems = 
      organization._count.users +
      organization._count.assets +
      organization._count.accessories +
      organization._count.licences +
      organization._count.consumables;

    if (totalRelatedItems > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete organization with existing data. Please reassign or delete associated resources first.',
        counts: organization._count
      }, { status: 400 });
    }

    await prisma.organization.delete({
      where: { id }
    });

    await createAuditLog({
      userId: session.user.id!,
      action: AUDIT_ACTIONS.DELETE,
      entity: 'Organization',
      entityId: id,
      details: { name: organization.name, slug: organization.slug },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting organization:', error);
    return NextResponse.json({ error: 'Failed to delete organization' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
