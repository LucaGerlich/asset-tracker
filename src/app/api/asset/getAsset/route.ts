import prisma from "../../../../lib/prisma";
import { requirePermission } from "@/lib/api-auth";
import { getOrganizationContext, scopeToOrganization } from "@/lib/organization-context";

// GET /api/asset/getAsset?id=<assetid>
export async function GET(req) {
  try {
    await requirePermission('asset:view');
    const orgContext = await getOrganizationContext();
    const orgId = orgContext?.organization?.id;

    const id = req.nextUrl.searchParams.get("id");
    if (id) {
      const asset = await prisma.asset.findFirst({
        where: scopeToOrganization({ assetid: id }, orgId),
      });
      if (!asset) {
        return new Response(
          JSON.stringify({ error: `Asset with id ${id} not found` }),
          { status: 404 }
        );
      }
      return new Response(JSON.stringify(asset), { status: 200 });
    }

    const where = scopeToOrganization({}, orgId);
    const assets = await prisma.asset.findMany({ where });
    return new Response(JSON.stringify(assets), { status: 200 });
  } catch (error) {
    console.error("Error fetching asset(s):", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith("Forbidden")) {
      return new Response(JSON.stringify({ error: error.message }), { status: 403 });
    }
    return new Response(JSON.stringify({ error: "Error fetching asset(s)" }), {
      status: 500,
    });
  }
}
