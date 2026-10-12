import { NextRequest, NextResponse } from "next/server";
import {
  requireApiAdmin,
  requireNotDemoMode,
  requireSuperAdmin,
  requireWritableOrg,
} from "@/lib/api-auth";
import {
  apiErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from "@/lib/errors";
import prisma from "@/lib/prisma";
import {
  organizationAdminUpdateSchema,
  updateOrganizationSchema,
  type OrganizationAdminUpdateInput,
} from "@/lib/validation-organization";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit-log";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Probe whether the caller is a platform super-admin. `isadmin` is per-org,
 * so it must never grant access to another org on its own. Only guard denials
 * mean "no"; any other failure (e.g. the database) propagates as a 500.
 */
async function isPlatformSuperAdmin(): Promise<boolean> {
  try {
    await requireSuperAdmin();
    return true;
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof UnauthorizedError) {
      return false;
    }
    throw error;
  }
}

function organizationNotFound() {
  return NextResponse.json(
    { error: "Organization not found" },
    { status: 404 },
  );
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await requireApiAdmin();

    // Prevent IDOR: an admin may only view their own organization unless they
    // are a platform super-admin.
    if (user.organizationId !== id && !(await isPlatformSuperAdmin())) {
      return organizationNotFound();
    }

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        departments: {
          orderBy: { name: "asc" },
        },
        _count: {
          select: {
            users: true,
            assets: true,
            accessories: true,
            licences: true,
          },
        },
      },
    });

    if (!organization) {
      return organizationNotFound();
    }

    return NextResponse.json(organization);
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("Error fetching organization", { error });
    return NextResponse.json(
      { error: "Failed to fetch organization" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const { id } = await params;
    const user = await requireApiAdmin();
    const superAdmin = await isPlatformSuperAdmin();

    // Admins can only update their own organization; only a platform
    // super-admin may act on another one.
    const actsOnOwnOrg = user.organizationId === id;
    if (!actsOnOwnOrg && !superAdmin) {
      return organizationNotFound();
    }
    if (actsOnOwnOrg) {
      await requireWritableOrg(user);
    }

    const body = await req.json();
    // Only a super-admin may change `isActive`; for everyone else the schema
    // strips it, so a tenant can never lift its own suspension.
    const validated: OrganizationAdminUpdateInput = superAdmin
      ? organizationAdminUpdateSchema.parse(body)
      : updateOrganizationSchema.parse(body);

    // Check if slug is unique (excluding current organization)
    if (validated.slug) {
      const existingOrg = await prisma.organization.findFirst({
        where: {
          slug: validated.slug,
          NOT: { id },
        },
      });

      if (existingOrg) {
        return NextResponse.json(
          { error: "Organization with this slug already exists" },
          { status: 400 },
        );
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
    if (validated.description !== undefined)
      updateData.description = validated.description;
    if (validated.settings !== undefined) {
      updateData.settings = validated.settings
        ? (validated.settings as Prisma.InputJsonValue)
        : Prisma.JsonNull;
    }
    // Read only for a super-admin, so the tenant path cannot write it even if
    // a schema change ever let the key through.
    if (superAdmin && validated.isActive !== undefined) {
      updateData.isActive = validated.isActive;
    }

    const organization = await prisma.organization.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog({
      userId: user.id!,
      action: AUDIT_ACTIONS.UPDATE,
      entity: "Organization",
      entityId: organization.id,
      details: validated,
    });

    return NextResponse.json(organization);
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("Error updating organization", { error });
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: error.issues.map((i) => i.message),
        },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Failed to update organization" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const { id } = await params;
    const user = await requireApiAdmin();

    // Admins can only delete their own organization; only a platform
    // super-admin may act on another one.
    const actsOnOwnOrg = user.organizationId === id;
    if (!actsOnOwnOrg && !(await isPlatformSuperAdmin())) {
      return organizationNotFound();
    }
    if (actsOnOwnOrg) {
      await requireWritableOrg(user);
    }

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            assets: true,
            accessories: true,
            licences: true,
            consumables: true,
          },
        },
      },
    });

    if (!organization) {
      return organizationNotFound();
    }

    const totalRelatedItems =
      organization._count.users +
      organization._count.assets +
      organization._count.accessories +
      organization._count.licences +
      organization._count.consumables;

    if (totalRelatedItems > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot delete organization with existing data. Please reassign or delete associated resources first.",
          counts: organization._count,
        },
        { status: 400 },
      );
    }

    await prisma.organization.delete({
      where: { id },
    });

    await createAuditLog({
      userId: user.id!,
      action: AUDIT_ACTIONS.DELETE,
      entity: "Organization",
      entityId: id,
      details: { name: organization.name, slug: organization.slug },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("Error deleting organization", { error });
    return NextResponse.json(
      { error: "Failed to delete organization" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
