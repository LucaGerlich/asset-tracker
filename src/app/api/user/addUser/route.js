import prisma from "../../../../lib/prisma";
import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { hashPassword } from "@/lib/auth-utils";
import { createUserSchema } from "@/lib/validation";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";

// POST /api/user/addUser
export async function POST(request) {
  try {
    // Require admin authentication
    const admin = await requireApiAdmin();

    const body = await request.json();

    // Validate input using Zod schema
    const validationResult = createUserSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.errors,
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
      },
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

