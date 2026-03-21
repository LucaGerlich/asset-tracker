import type { NextRequest } from "next/server";
import prisma from "../../../../lib/prisma";
import { requireApiAdmin, requireNotDemoMode } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

// DELETE /api/userAccessoires/unassign
// Body: { userId, accessorieId }
export async function DELETE(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    await requireApiAdmin();
    const { userId, accessorieId } = await req.json();
    if (!userId || !accessorieId) {
      return new Response(
        JSON.stringify({ error: "userId and accessorieId are required" }),
        { status: 400 },
      );
    }
    const result = await prisma.userAccessoires.deleteMany({
      where: { userid: userId, accessorieid: accessorieId },
    });
    return new Response(
      JSON.stringify({ message: "Accessory unassigned", result }),
      { status: 200 },
    );
  } catch (e) {
    logger.error("DELETE /api/userAccessoires/unassign error", { error: e });
    if (e instanceof Error && e.message === "Unauthorized") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });
    }
    if (e instanceof Error && e.message.startsWith("Forbidden")) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 403,
      });
    }
    return new Response(
      JSON.stringify({ error: "Failed to unassign accessory" }),
      { status: 500 },
    );
  }
}
