import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApiAdmin, requireNotDemoMode } from "@/lib/api-auth";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/users/[id]/roles
export async function GET(req: Request, { params }: RouteParams) {
  try {
    await requireApiAdmin();
    const { id } = await params;

    // Verify user exists and belongs to admin's org
    const orgContext = await getOrganizationContext();
    const orgId = orgContext?.organization?.id;
    const user = await prisma.user.findFirst({
      where: scopeToOrganization({ userid: id }, orgId),
      select: { userid: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userRoles = await prisma.userRole.findMany({
      where: { userId: id },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            description: true,
            permissions: true,
            isSystem: true,
          },
        },
      },
    });

    const roles = userRoles.map((ur) => ur.role);

    return NextResponse.json(roles, { status: 200 });
  } catch (error) {
    logger.error("GET /api/admin/users/[id]/roles error", { error });
    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message.includes("Forbidden")) {
        return NextResponse.json(
          { error: "Forbidden: Admin access required" },
          { status: 403 },
        );
      }
    }
    return NextResponse.json(
      { error: "Failed to fetch user roles" },
      { status: 500 },
    );
  }
}

// POST /api/admin/users/[id]/roles
// Assign a role to a user
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const admin = await requireApiAdmin();
    const { id } = await params;
    const body = await req.json();
    const { roleId } = body;

    if (!roleId) {
      return NextResponse.json(
        { error: "roleId is required" },
        { status: 400 },
      );
    }

    // Verify user exists and belongs to admin's org
    const orgContext = await getOrganizationContext();
    const orgId = orgContext?.organization?.id;
    const user = await prisma.user.findFirst({
      where: scopeToOrganization({ userid: id }, orgId),
      select: { userid: true, username: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify role exists and belongs to admin's org (or is a system role)
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true, name: true, organizationId: true },
    });

    if (!role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    if (role.organizationId && role.organizationId !== (orgId ?? null)) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    const userRole = await prisma.userRole.create({
      data: {
        userId: id,
        roleId: roleId,
        grantedBy: admin.id || null,
      },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            description: true,
            permissions: true,
            isSystem: true,
          },
        },
      },
    });

    await createAuditLog({
      userId: admin.id || null,
      action: AUDIT_ACTIONS.ASSIGN,
      entity: "user_role",
      entityId: userRole.id,
      details: {
        targetUserId: id,
        targetUsername: user.username,
        roleId: role.id,
        roleName: role.name,
      },
    });

    return NextResponse.json(userRole, { status: 201 });
  } catch (error) {
    logger.error("POST /api/admin/users/[id]/roles error", { error });
    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message.includes("Forbidden")) {
        return NextResponse.json(
          { error: "Forbidden: Admin access required" },
          { status: 403 },
        );
      }
    }
    // Handle unique constraint violation (role already assigned)
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Role is already assigned to this user" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Failed to assign role to user" },
      { status: 500 },
    );
  }
}

// DELETE /api/admin/users/[id]/roles
export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const admin = await requireApiAdmin();
    const { id } = await params;
    const body = await req.json();
    const { roleId } = body;

    if (!roleId) {
      return NextResponse.json(
        { error: "roleId is required" },
        { status: 400 },
      );
    }

    // Verify target user belongs to admin's org
    const orgContext = await getOrganizationContext();
    const orgId = orgContext?.organization?.id;
    const targetUser = await prisma.user.findFirst({
      where: scopeToOrganization({ userid: id }, orgId),
      select: { userid: true },
    });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Find the user-role assignment
    const userRole = await prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId: id,
          roleId: roleId,
        },
      },
      include: {
        role: {
          select: { id: true, name: true },
        },
        user: {
          select: { userid: true, username: true },
        },
      },
    });

    if (!userRole) {
      return NextResponse.json(
        { error: "Role assignment not found" },
        { status: 404 },
      );
    }

    await prisma.userRole.delete({
      where: {
        userId_roleId: {
          userId: id,
          roleId: roleId,
        },
      },
    });

    await createAuditLog({
      userId: admin.id || null,
      action: AUDIT_ACTIONS.UNASSIGN,
      entity: "user_role",
      entityId: userRole.id,
      details: {
        targetUserId: id,
        targetUsername: userRole.user.username,
        roleId: userRole.role.id,
        roleName: userRole.role.name,
      },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    logger.error("DELETE /api/admin/users/[id]/roles error", { error });
    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message.includes("Forbidden")) {
        return NextResponse.json(
          { error: "Forbidden: Admin access required" },
          { status: 403 },
        );
      }
    }
    return NextResponse.json(
      { error: "Failed to remove role from user" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
