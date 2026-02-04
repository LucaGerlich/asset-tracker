import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// PATCH /api/admin/users/bulk-permissions
export async function PATCH(req) {
  try {
    const body = await req.json();
    const { userIds, isadmin, canrequest } = body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: "userIds array is required and must not be empty" },
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
      return NextResponse.json(
        { error: "At least one permission field (isadmin or canrequest) is required" },
        { status: 400 }
      );
    }

    updateData.change_date = new Date();

    // Update multiple users at once
    const result = await prisma.user.updateMany({
      where: {
        userid: {
          in: userIds,
        },
      },
      data: updateData,
    });

    return NextResponse.json(
      {
        message: "Bulk permissions updated successfully",
        count: result.count,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("PATCH /api/admin/users/bulk-permissions error:", error);

    return NextResponse.json(
      { error: "Failed to update bulk permissions" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
