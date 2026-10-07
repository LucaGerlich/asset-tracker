import type { NextRequest } from "next/server";
import prisma from "../../../../lib/prisma";
import {
  requireApiAdmin,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";

// Body: { userId, accessorieId }
export async function DELETE(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const admin = await requireApiAdmin();
    await requireWritableOrg(admin);
    const { userId, accessorieId } = await req.json();
    if (!userId || !accessorieId) {
      return new Response(
        JSON.stringify({ error: "userId and accessorieId are required" }),
        { status: 400 },
      );
    }
    // The accessory must belong to the admin's organization.
    const accessory = await prisma.accessories.findFirst({
      where: {
        accessorieid: accessorieId,
        organizationId: admin.organizationId ?? null,
      },
      select: { accessorieid: true },
    });
    if (!accessory) {
      return new Response(JSON.stringify({ error: "Accessory not found" }), {
        status: 404,
      });
    }
    const result = await prisma.userAccessoires.deleteMany({
      where: { userid: userId, accessorieid: accessorieId },
    });
    return new Response(
      JSON.stringify({ message: "Accessory unassigned", result }),
      { status: 200 },
    );
  } catch (e) {
    const denied = apiErrorResponse(e);
    if (denied) return denied;
    logger.error("DELETE /api/userAccessoires/unassign error", { error: e });
    return new Response(
      JSON.stringify({ error: "Failed to unassign accessory" }),
      { status: 500 },
    );
  }
}
