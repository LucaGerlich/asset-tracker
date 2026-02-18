import prisma from "../../../../lib/prisma";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { getOrganizationContext } from "@/lib/organization-context";
import { hashPassword } from "@/lib/auth-utils";
import { createUserSchema } from "@/lib/validation";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import { triggerWebhook } from "@/lib/webhooks";
import { checkUserLimit } from "@/lib/tenant-limits";

// POST /api/user/addUser
export async function POST(request) {
  try {
    // Require user:create permission
    const admin = await requirePermission('user:create');

    const limitCheck = await checkUserLimit();
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: `User limit reached (${limitCheck.current}/${limitCheck.max}). Upgrade your plan to add more users.` },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate input using Zod schema
    const validationResult = createUserSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const {
      username,
      isadmin = false,
      canrequest = true,
      lastname,
      firstname,
      email,
      lan,
      password,
    } = validationResult.data;

    // Hash the password before storing
    const hashedPassword = await hashPassword(password);

    // Get organization context for the creating admin
    const orgContext = await getOrganizationContext();

    // Create user with hashed password
    const created = await prisma.user.create({
      data: {
        username: username ?? null,
        isadmin: Boolean(isadmin),
        canrequest: Boolean(canrequest),
        lastname,
        firstname,
        email: email ?? null,
        lan: lan ?? null,
        password: hashedPassword,
        creation_date: new Date(),
        organizationId: orgContext?.organization?.id || null,
      } as Prisma.userUncheckedCreateInput,
    });

    // Create audit log
    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.CREATE,
      entity: AUDIT_ENTITIES.USER,
      entityId: created.userid,
      details: {
        username: created.username,
        isadmin: created.isadmin,
        canrequest: created.canrequest,
      },
    });

    triggerWebhook('user.created', { userId: created.userid, email: created.email }, created.organizationId).catch(() => {});

    // Remove password from response
    const { password: _, ...userWithoutPassword } = created;

    return NextResponse.json(userWithoutPassword, { status: 201 });
  } catch (error) {
    console.error("POST /api/user/addUser error:", error);

    // Handle specific error types
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    // Handle unique constraint violations
    if (error.code === "P2002") {
      return NextResponse.json(
        {
          error: "A user with this username or email already exists",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}

