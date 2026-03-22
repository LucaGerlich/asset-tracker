import type { NextRequest } from "next/server";
import prisma from "../../../../lib/prisma";
import { requirePermission } from "@/lib/api-auth";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";
import { logger } from "@/lib/logger";

// GET /api/asset/getAsset?id=<assetid>
export async function GET(req: NextRequest) {
  try {
    await requirePermission("asset:view");
    const orgContext = await getOrganizationContext();
    const orgId = orgContext?.organization?.id;

    const id = req.nextUrl.searchParams.get("id");
    if (id) {
      const asset = await prisma.asset.findFirst({
        where: scopeToOrganization({ assetid: id }, orgId),
        include: {
          statusType: { select: { statustypeid: true, statustypename: true } },
          manufacturer: {
            select: { manufacturerid: true, manufacturername: true },
          },
          model: { select: { modelid: true, modelname: true } },
          location: { select: { locationid: true, locationname: true } },
          supplier: { select: { supplierid: true, suppliername: true } },
          assetCategoryType: {
            select: {
              assetcategorytypeid: true,
              assetcategorytypename: true,
            },
          },
        },
      });
      if (!asset) {
        return new Response(
          JSON.stringify({ error: `Asset with id ${id} not found` }),
          { status: 404 },
        );
      }
      return new Response(JSON.stringify(asset), { status: 200 });
    }

    const where = scopeToOrganization({}, orgId);
    const assets = await prisma.asset.findMany({
      where,
      take: 1000,
      select: {
        assetid: true,
        assetname: true,
        assettag: true,
        serialnumber: true,
        statustypeid: true,
        assetcategorytypeid: true,
        manufacturerid: true,
        modelid: true,
        locationid: true,
        supplierid: true,
        purchaseprice: true,
        purchasedate: true,
        requestable: true,
        mobile: true,
        specs: true,
        notes: true,
        creation_date: true,
        change_date: true,
      },
    });
    return new Response(JSON.stringify(assets), { status: 200 });
  } catch (error) {
    logger.error("Error fetching asset(s)", { error });
    if (error instanceof Error && error.message === "Unauthorized") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });
    }
    if (error instanceof Error && error.message.startsWith("Forbidden")) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 403,
      });
    }
    return new Response(JSON.stringify({ error: "Error fetching asset(s)" }), {
      status: 500,
    });
  }
}
