import type { NextRequest } from "next/server";
import prisma from "../../../../lib/prisma";
import { requirePermission, requireNotDemoMode } from "@/lib/api-auth";
import { triggerWebhook } from "@/lib/webhooks";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";
import { logger } from "@/lib/logger";

// POST /api/licence/assign
// Body: { licenceId, userId }
export async function POST(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    await requirePermission("license:assign");
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;
    const { licenceId, userId } = await req.json();
    if (!licenceId || !userId) {
      return new Response(
        JSON.stringify({ error: "licenceId and userId are required" }),
        { status: 400 },
      );
    }

    // Verify licence belongs to user's organization
    const licence = await prisma.licence.findFirst({
      where: scopeToOrganization({ licenceid: licenceId }, orgId),
      select: { licenceid: true },
    });
    if (!licence) {
      return new Response(JSON.stringify({ error: "Licence not found" }), {
        status: 404,
      });
    }

    const updated = await prisma.licence.update({
      where: { licenceid: licenceId },
      data: { licenceduserid: userId, change_date: new Date() },
    });

    triggerWebhook("license.assigned", {
      licenceId,
      userId,
      licenceKey: updated.licencekey ? "***" : null,
    }).catch(() => {});

    return new Response(JSON.stringify(updated), { status: 200 });
  } catch (e) {
    logger.error("POST /api/licence/assign error", { error: e });
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
    return new Response(JSON.stringify({ error: "Failed to assign licence" }), {
      status: 500,
    });
  }
}
