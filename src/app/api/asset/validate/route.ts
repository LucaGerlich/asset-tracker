import { type NextRequest, NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";
import { logger } from "@/lib/logger";

// GET /api/asset/validate?assettag=...&serialnumber=...
export async function GET(req: NextRequest) {
  try {
    await requireApiAuth();
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;
    const url = req.nextUrl;
    const assettag = url.searchParams.get("assettag");
    const serialnumber = url.searchParams.get("serialnumber");
    const result: Record<string, { exists: boolean }> = {};

    if (assettag) {
      const byTag = await prisma.asset.findFirst({
        where: scopeToOrganization({ assettag }, orgId),
      });
      result.assettag = { exists: Boolean(byTag) };
    }
    if (serialnumber) {
      const bySerial = await prisma.asset.findFirst({
        where: scopeToOrganization({ serialnumber }, orgId),
      });
      result.serialnumber = { exists: Boolean(bySerial) };
    }

    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    const denied = apiErrorResponse(e);
    if (denied) return denied;
    logger.error("GET /api/asset/validate error", { error: e });
    return NextResponse.json({ error: "Validation error" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
