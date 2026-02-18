import prisma from "../../../../lib/prisma";

export async function DELETE(req) {
  try {
    const { assetId, userId } = await req.json();

    if (!assetId || !userId) {
      return new Response(
        JSON.stringify({ error: "Asset ID and User ID are required" }),
        {
          status: 400,
        }
      );
    }

    // Resolve the "Available" status id (case-insensitive)
    const availableStatus = await prisma.statusType.findFirst({
      where: { statustypename: { equals: "Available", mode: "insensitive" } },
    });
    if (!availableStatus) {
      return new Response(
        JSON.stringify({ error: "Status 'Available' not found in statusType" }),
        { status: 500 }
      );
    }

    const deletedAsset = await prisma.$transaction(async (tx) => {
      const deleted = await tx.userAssets.deleteMany({
        where: {
          assetid: assetId,
          userid: userId,
        },
      });

      await tx.asset.update({
        where: { assetid: assetId },
        data: { statustypeid: availableStatus.statustypeid },
      });

      return deleted;
    });

    return new Response(
      JSON.stringify({
        message: "Asset unassigned successfully",
        asset: deletedAsset,
      }),
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error unassigning asset:", error);
    return new Response(JSON.stringify({ error: "Error unassigning asset" }), {
      status: 500,
    });
  }
}
