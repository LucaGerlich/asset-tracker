import { NextRequest, NextResponse } from "next/server";
import {
  requireApiAdmin,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import prisma from "@/lib/prisma";
import { updateRoleSchema } from "@/lib/validation-organization";
import { PERMISSIONS } from "@/lib/rbac";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit-log";
import { z } from "zod";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await requireApiAdmin();

    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        organization: {
          select: { id: true, name: true },
        },
        userRoles: {
          include: {
            user: {
              select: {
                userid: true,
                firstname: true,
                lastname: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    // Verify role belongs to admin's org (system roles are readable by all)
    if (role.organizationId && role.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    return NextResponse.json(role);
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("Error fetching role", { error });
    return NextResponse.json(
      { error: "Failed to fetch role" },
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
    await requireWritableOrg(user);

    const existingRole = await prisma.role.findUnique({
      where: { id },
    });

    if (!existingRole) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    // Verify role belongs to admin's org
    if (
      existingRole.organizationId &&
      existingRole.organizationId !== user.organizationId
    ) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    if (existingRole.isSystem) {
      return NextResponse.json(
        { error: "System roles cannot be modified" },
        { status: 400 },
      );
    }

    const body = await req.json();
    const validated = updateRoleSchema.parse(body);

    if (validated.permissions) {
      const validPermissions = Object.keys(PERMISSIONS);
      const invalidPerms = validated.permissions.filter(
        (p) => !validPermissions.includes(p),
      );
      if (invalidPerms.length > 0) {
        return NextResponse.json(
          {
            error: `Invalid permissions: ${invalidPerms.join(", ")}`,
            validPermissions,
          },
          { status: 400 },
        );
      }
    }

    // Check for duplicate name within organization if name is being changed
    if (validated.name && validated.name !== existingRole.name) {
      const duplicateRole = await prisma.role.findFirst({
        where: {
          name: validated.name,
          organizationId: existingRole.organizationId,
          NOT: { id },
        },
      });

      if (duplicateRole) {
        return NextResponse.json(
          { error: "Role with this name already exists" },
          { status: 400 },
        );
      }
    }

    const role = await prisma.role.update({
      where: { id },
      data: {
        ...validated,
        updatedAt: new Date(),
      },
    });

    await createAuditLog({
      userId: user.id!,
      action: AUDIT_ACTIONS.UPDATE,
      entity: "Role",
      entityId: role.id,
      details: validated as Record<string, unknown>,
    });

    return NextResponse.json(role);
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("Error updating role", { error });
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to update role" },
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
    await requireWritableOrg(user);

    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        _count: {
          select: { userRoles: true },
        },
      },
    });

    if (!role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    // Verify role belongs to admin's org
    if (role.organizationId && role.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    if (role.isSystem) {
      return NextResponse.json(
        { error: "System roles cannot be deleted" },
        { status: 400 },
      );
    }

    if (role._count.userRoles > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot delete role with assigned users. Please reassign users first.",
          userCount: role._count.userRoles,
        },
        { status: 400 },
      );
    }

    await prisma.role.delete({
      where: { id },
    });

    await createAuditLog({
      userId: user.id!,
      action: AUDIT_ACTIONS.DELETE,
      entity: "Role",
      entityId: id,
      details: { name: role.name },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("Error deleting role", { error });
    return NextResponse.json(
      { error: "Failed to delete role" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
