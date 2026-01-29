import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { organizationSchema } from '@/lib/validation-organization';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/audit-log';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizations = await prisma.organization.findMany({
      include: {
        _count: {
          select: { users: true, assets: true, departments: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json(organizations);
  } catch (error) {
    console.error('Error fetching organizations:', error);
    return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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
      userId: session.user.id!,
      action: AUDIT_ACTIONS.CREATE,
      entity: 'Organization',
      entityId: organization.id,
      details: { name: organization.name, slug: organization.slug },
    });

    return NextResponse.json(organization, { status: 201 });
  } catch (error) {
    console.error('Error creating organization:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
