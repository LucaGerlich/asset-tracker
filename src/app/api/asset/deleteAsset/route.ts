import prisma from "../../../../lib/prisma";
import { requirePermission } from "@/lib/api-auth";
import { getOrganizationContext, scopeToOrganization } from "@/lib/organization-context";
import { triggerWebhook } from "@/lib/webhooks";

export async function DELETE(req) {
  try {
    await requirePermission('asset:delete');
    const orgContext = await getOrganizationContext();
    const orgId = orgContext?.organization?.id;

    const { assetId } = await req.json();

    if (!assetId) {
      return new Response(JSON.stringify({ error: "Asset ID is required" }), {
        status: 400,
      });
    }

    // Verify asset belongs to user's organization before deleting
    const asset = await prisma.asset.findFirst({
      where: scopeToOrganization({ assetid: assetId }, orgId),
    });

    if (!asset) {
      return new Response(JSON.stringify({ error: "Asset not found" }), {
        status: 404,
      });
    }

    // Remove dependent relations first to satisfy FK constraints
    await prisma.$transaction([
      prisma.userAssets.deleteMany({ where: { assetid: assetId } }),
      prisma.asset.delete({ where: { assetid: assetId } }),
    ]);

    triggerWebhook('asset.deleted', { assetId, assetName: asset.assetname }, orgId).catch(() => {});

    return new Response(
      JSON.stringify({ message: "Asset deleted successfully" }),
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error deleting asset:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith("Forbidden")) {
      return new Response(JSON.stringify({ error: error.message }), { status: 403 });
    }
    return new Response(JSON.stringify({ error: "Error deleting asset" }), {
      status: 500,
    });
  }
}
