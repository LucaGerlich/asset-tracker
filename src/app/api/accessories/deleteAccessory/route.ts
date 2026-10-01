import type { NextRequest } from "next/server";
import prisma from "../../../../lib/prisma";
import { logger } from "@/lib/logger";
import { requirePermission, requireNotDemoMode } from "@/lib/api-auth";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";
import { invalidateCacheByPrefix } from "@/lib/cache";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";

export async function DELETE(req: NextRequest) {
  const startTime = Date.now();

  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const admin = await requirePermission("accessory:delete");
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;
    const { accessoryId } = await req.json();

    if (!accessoryId) {
      logger.warn(
        "DELETE /api/accessories/deleteAccessory - Missing accessoryId",
        {
          type: "validation_error",
        },
      );
      return new Response(
        JSON.stringify({ error: "Accessory ID is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Verify accessory belongs to user's organization
    const accessory = await prisma.accessories.findFirst({
      where: scopeToOrganization({ accessorieid: accessoryId }, orgId),
      select: { accessorieid: true },
    });
    if (!accessory) {
      return new Response(JSON.stringify({ error: "Accessory not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    logger.info("Deleting accessory", {
      accessoryId,
      type: "accessory_delete",
    });

    await prisma.$transaction([
      prisma.userAccessoires.deleteMany({
        where: { accessorieid: accessoryId },
      }),
      prisma.accessories.delete({ where: { accessorieid: accessoryId } }),
    ]);

    await createAuditLog({
      userId: admin.id ?? null,
      action: AUDIT_ACTIONS.DELETE,
      entity: AUDIT_ENTITIES.ACCESSORY,
      entityId: accessoryId,
    });

    await invalidateCacheByPrefix("accessories_all").catch(() => {});
    await invalidateCacheByPrefix("accessory_count").catch(() => {});
    await invalidateCacheByPrefix("accessory_status_distribution").catch(
      () => {},
    );

    const duration = Date.now() - startTime;
    logger.apiResponse(
      "DELETE",
      "/api/accessories/deleteAccessory",
      200,
      duration,
      {
        accessoryId,
      },
    );

    return new Response(
      JSON.stringify({ message: "Accessory deleted successfully" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.apiError("DELETE", "/api/accessories/deleteAccessory", error, {
      duration,
    });

    if (error instanceof Error && error.message === "Unauthorized") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (error instanceof Error && error.message.startsWith("Forbidden")) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Error deleting accessory" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
