import type { NextRequest } from "next/server";
import prisma from "../../../../lib/prisma";
import {
  requirePermission,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { invalidateCacheByPrefix } from "@/lib/cache";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";
import { logger } from "@/lib/logger";

// Body: { licenceId }
export async function DELETE(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const user = await requirePermission("license:assign");
    await requireWritableOrg(user);
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;
    const { licenceId } = await req.json();
    if (!licenceId) {
      return new Response(JSON.stringify({ error: "licenceId is required" }), {
        status: 400,
      });
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
      data: { licenceduserid: null, change_date: new Date() },
    });

    await invalidateCacheByPrefix("licences_all").catch(() => {});

    return new Response(JSON.stringify(updated), { status: 200 });
  } catch (e) {
    const denied = apiErrorResponse(e);
    if (denied) return denied;
    logger.error("DELETE /api/licence/unassign error", { error: e });
    return new Response(
      JSON.stringify({ error: "Failed to unassign licence" }),
      { status: 500 },
    );
  }
}
