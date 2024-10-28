import prisma from "../../../lib/prisma";

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

    const deletedAsset = await prisma.userAssets.deleteMany({
      where: {
        assetid: assetId,
        userid: userId,
      },
    });

    await prisma.asset.update({
      where: { assetid: assetId },
      data: { statustypeid: "b4cf2691-370f-491e-8765-cab33a2314d4" },
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
