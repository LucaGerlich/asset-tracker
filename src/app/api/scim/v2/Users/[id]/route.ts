import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  authenticateScim,
  scimHeaders,
  scimError,
  userToScim,
} from "@/lib/scim";
import { logger } from "@/lib/logger";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const USER_SELECT = {
  userid: true,
  username: true,
  firstname: true,
  lastname: true,
  email: true,
  isActive: true,
  externalId: true,
  creation_date: true,
  change_date: true,
} as const;

/**
 * GET /api/scim/v2/Users/:id
 * Get single user (SCIM 2.0 RFC 7644 Section 3.4.1)
 */
export async function GET(req: Request, { params }: RouteParams) {
  const authErr = await authenticateScim(req);
  if (authErr) return authErr;

  try {
    const { id } = await params;
    const url = new URL(req.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    const user = await prisma.user.findUnique({
      where: { userid: id },
      select: USER_SELECT,
    });

    if (!user) {
      return NextResponse.json(
        scimError("User not found", 404),
        { status: 404, headers: scimHeaders() },
      );
    }

    return NextResponse.json(
      userToScim(user, baseUrl),
      { headers: scimHeaders() },
    );
  } catch (error) {
    logger.error("SCIM GET /Users/:id error", { error });
    return NextResponse.json(
      scimError("Internal server error", 500),
      { status: 500, headers: scimHeaders() },
    );
  }
}

/**
 * PUT /api/scim/v2/Users/:id
 * Replace user (SCIM 2.0 RFC 7644 Section 3.5.1)
 */
export async function PUT(req: Request, { params }: RouteParams) {
  const authErr = await authenticateScim(req);
  if (authErr) return authErr;

  try {
    const { id } = await params;
    const body = await req.json();
    const url = new URL(req.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    const existing = await prisma.user.findUnique({
      where: { userid: id },
      select: { userid: true },
    });

    if (!existing) {
      return NextResponse.json(
        scimError("User not found", 404),
        { status: 404, headers: scimHeaders() },
      );
    }

    const user = await prisma.user.update({
      where: { userid: id },
      data: {
        username: body.userName || undefined,
        firstname: body.name?.givenName || undefined,
        lastname: body.name?.familyName || undefined,
        email: body.emails?.[0]?.value || undefined,
        isActive: body.active !== undefined ? body.active : undefined,
        externalId: body.externalId || undefined,
        scimLastSync: new Date(),
        change_date: new Date(),
      },
      select: USER_SELECT,
    });

    await createAuditLog({
      userId: user.userid,
      action: AUDIT_ACTIONS.UPDATE,
      entity: AUDIT_ENTITIES.USER,
      entityId: user.userid,
      details: { method: "scim" },
    });

    return NextResponse.json(
      userToScim(user, baseUrl),
      { headers: scimHeaders() },
    );
  } catch (error) {
    logger.error("SCIM PUT /Users/:id error", { error });
    return NextResponse.json(
      scimError("Internal server error", 500),
      { status: 500, headers: scimHeaders() },
    );
  }
}

/**
 * PATCH /api/scim/v2/Users/:id
 * Partial update (SCIM 2.0 RFC 7644 Section 3.5.2)
 * Supports "Operations" array with op: replace/add
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  const authErr = await authenticateScim(req);
  if (authErr) return authErr;

  try {
    const { id } = await params;
    const body = await req.json();
    const url = new URL(req.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    const existing = await prisma.user.findUnique({
      where: { userid: id },
      select: { userid: true },
    });

    if (!existing) {
      return NextResponse.json(
        scimError("User not found", 404),
        { status: 404, headers: scimHeaders() },
      );
    }

    const updateData: Record<string, unknown> = {
      scimLastSync: new Date(),
      change_date: new Date(),
    };

    // Process SCIM PatchOp operations
    const operations = body.Operations || body.operations || [];
    for (const op of operations) {
      const path = op.path?.toLowerCase();
      const value = op.value;

      if (path === "active" || (!path && typeof value === "object" && "active" in value)) {
        updateData.isActive = path ? value : value.active;
      }
      if (path === "username" || (!path && typeof value === "object" && "userName" in value)) {
        updateData.username = path ? value : value.userName;
      }
      if (path === "name.givenname") {
        updateData.firstname = value;
      }
      if (path === "name.familyname") {
        updateData.lastname = value;
      }
      if (path === "emails[type eq \"work\"].value" || path === "emails") {
        const email = typeof value === "string" ? value : value?.[0]?.value;
        if (email) updateData.email = email;
      }
      if (path === "externalid") {
        updateData.externalId = value;
      }

      // Handle bulk value object without path (Azure AD pattern)
      if (!path && typeof value === "object") {
        if (value.name?.givenName) updateData.firstname = value.name.givenName;
        if (value.name?.familyName) updateData.lastname = value.name.familyName;
        if (value.emails?.[0]?.value) updateData.email = value.emails[0].value;
        if (value.userName) updateData.username = value.userName;
        if (value.externalId) updateData.externalId = value.externalId;
      }
    }

    const user = await prisma.user.update({
      where: { userid: id },
      data: updateData,
      select: USER_SELECT,
    });

    await createAuditLog({
      userId: user.userid,
      action: AUDIT_ACTIONS.UPDATE,
      entity: AUDIT_ENTITIES.USER,
      entityId: user.userid,
      details: { method: "scim-patch", operations: operations.length },
    });

    return NextResponse.json(
      userToScim(user, baseUrl),
      { headers: scimHeaders() },
    );
  } catch (error) {
    logger.error("SCIM PATCH /Users/:id error", { error });
    return NextResponse.json(
      scimError("Internal server error", 500),
      { status: 500, headers: scimHeaders() },
    );
  }
}

/**
 * DELETE /api/scim/v2/Users/:id
 * Soft-delete user (SCIM 2.0 RFC 7644 Section 3.6)
 * Sets isActive=false rather than hard-deleting.
 */
export async function DELETE(req: Request, { params }: RouteParams) {
  const authErr = await authenticateScim(req);
  if (authErr) return authErr;

  try {
    const { id } = await params;

    const existing = await prisma.user.findUnique({
      where: { userid: id },
      select: { userid: true },
    });

    if (!existing) {
      return NextResponse.json(
        scimError("User not found", 404),
        { status: 404, headers: scimHeaders() },
      );
    }

    // Soft-delete: deactivate the user
    await prisma.user.update({
      where: { userid: id },
      data: {
        isActive: false,
        scimLastSync: new Date(),
        change_date: new Date(),
      },
    });

    await createAuditLog({
      userId: id,
      action: AUDIT_ACTIONS.DELETE,
      entity: AUDIT_ENTITIES.USER,
      entityId: id,
      details: { method: "scim", softDelete: true },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.error("SCIM DELETE /Users/:id error", { error });
    return NextResponse.json(
      scimError("Internal server error", 500),
      { status: 500, headers: scimHeaders() },
    );
  }
}

export const dynamic = "force-dynamic";
