import type { NextRequest } from "next/server";
import prisma from "../../../../lib/prisma";
import {
  requirePermission,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { triggerWebhook } from "@/lib/webhooks";
import { invalidateCacheByPrefix } from "@/lib/cache";
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
    const user = await requirePermission("license:assign");
    await requireWritableOrg(user);
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

    // The target user must also belong to the caller's organization.
    const targetUser = await prisma.user.findFirst({
      where: { userid: userId, organizationId: orgId ?? null },
      select: { userid: true },
    });
    if (!targetUser) {
      return new Response(JSON.stringify({ error: "User not found" }), {
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

    await invalidateCacheByPrefix("licences_all").catch(() => {});

    return new Response(JSON.stringify(updated), { status: 200 });
  } catch (e) {
    const denied = apiErrorResponse(e);
    if (denied) return denied;
    logger.error("POST /api/licence/assign error", { error: e });
    return new Response(JSON.stringify({ error: "Failed to assign licence" }), {
      status: 500,
    });
  }
}
