import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApiAdmin } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

// PATCH /api/admin/users/[id]/permissions
export async function PATCH(req, { params }) {
  const startTime = Date.now();

  try {
    await requireApiAdmin();
    const { id } = await params;
    const body = await req.json();
    const { isadmin, canrequest } = body;

    if (!id) {
      logger.warn("PATCH /api/admin/users/[id]/permissions - Missing user ID");
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Build update data object with only provided fields
    const updateData: { isadmin?: boolean; canrequest?: boolean; change_date?: Date } = {};
    if (typeof isadmin === "boolean") {
      updateData.isadmin = isadmin;
    }
    if (typeof canrequest === "boolean") {
      updateData.canrequest = canrequest;
    }

    if (Object.keys(updateData).length === 0) {
      logger.warn("PATCH /api/admin/users/[id]/permissions - No permissions provided", {
        userId: id,
      });
      return NextResponse.json(
        { error: "At least one permission field (isadmin or canrequest) is required" },
        { status: 400 }
      );
    }

    updateData.change_date = new Date();

    logger.info("Updating user permissions", {
      userId: id,
      permissions: updateData,
      type: "permission_update",
    });

    const updatedUser = await prisma.user.update({
      where: { userid: id },
      data: updateData,
      select: {
        userid: true,
        username: true,
        firstname: true,
        lastname: true,
        email: true,
        isadmin: true,
        canrequest: true,
      },
    });

    const duration = Date.now() - startTime;
    logger.apiResponse("PATCH", `/api/admin/users/${id}/permissions`, 200, duration, {
      userId: id,
    });

    return NextResponse.json(updatedUser, { status: 200 });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.apiError("PATCH", "/api/admin/users/[id]/permissions", error, {
      userId: params.id,
      duration,
    });
    
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update user permissions" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
