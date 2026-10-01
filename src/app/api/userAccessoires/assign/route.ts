import type { NextRequest } from "next/server";
import prisma from "../../../../lib/prisma";
import { Prisma } from "@prisma/client";
import { requireApiAdmin, requireNotDemoMode } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

// POST /api/userAccessoires/assign
// Body: { userId, accessorieId }
export async function POST(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const admin = await requireApiAdmin();
    const { userId, accessorieId } = await req.json();
    if (!userId || !accessorieId) {
      return new Response(
        JSON.stringify({ error: "userId and accessorieId are required" }),
        { status: 400 },
      );
    }
    const orgId = admin.organizationId ?? null;
    // Wrap check + create in a transaction to prevent duplicate assignments
    const { record, idempotent } = await prisma.$transaction(async (tx) => {
      // Both the accessory and the target user must belong to the admin's org.
      const accessory = await tx.accessories.findFirst({
        where: { accessorieid: accessorieId, organizationId: orgId },
        select: { accessorieid: true },
      });
      if (!accessory) {
        throw new Error("ACCESSORY_NOT_FOUND");
      }
      const targetUser = await tx.user.findFirst({
        where: { userid: userId, organizationId: orgId },
        select: { userid: true },
      });
      if (!targetUser) {
        throw new Error("USER_NOT_FOUND");
      }

      const exists = await tx.userAccessoires.findFirst({
        where: { userid: userId, accessorieid: accessorieId },
      });

      // Idempotent: if already assigned to the same user, return as-is
      if (exists) {
        return { record: exists, idempotent: true };
      }

      const created = await tx.userAccessoires.create({
        data: {
          userid: userId,
          accessorieid: accessorieId,
          creation_date: new Date(),
        } as Prisma.userAccessoiresUncheckedCreateInput,
      });

      return { record: created, idempotent: false };
    });

    return new Response(
      JSON.stringify({
        message: idempotent
          ? "Accessory already assigned to this user"
          : "Accessory assigned",
        userAccessoire: record,
      }),
      { status: 200 },
    );
  } catch (e) {
    logger.error("POST /api/userAccessoires/assign error", { error: e });
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
    if (
      e instanceof Error &&
      (e.message === "ACCESSORY_NOT_FOUND" || e.message === "USER_NOT_FOUND")
    ) {
      return new Response(
        JSON.stringify({ error: "Accessory or user not found" }),
        { status: 404 },
      );
    }
    return new Response(
      JSON.stringify({ error: "Failed to assign accessory" }),
      { status: 500 },
    );
  }
}
