import prisma from "../../../lib/prisma";

export async function POST(req) {
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

    // Check if the asset is already assigned
    const existingAssignment = await prisma.userAssets.findFirst({
      where: { assetid: assetId },
    });

    const existingStatus = await prisma.asset.findFirst({
      where: { assetid: assetId },
    });

    let result;

    if (existingAssignment) {
      // Update the existing assignment
      result = await prisma.userAssets.update({
        where: { userassetsid: existingAssignment.userassetsid },
        data: { userid: userId },
      });

      if (!existingStatus.statustypeid) {
        await prisma.asset.update({
          where: { assetid: assetId },
          data: { statustypeid: "1c4f0dd4-6a8c-496a-8e08-357fc922c026" },
        });
      }
    } else {
      // Create a new assignment
      result = await prisma.userAssets.create({
        data: {
          assetid: assetId,
          userid: userId,
        },
      });
      await prisma.asset.update({
        where: { assetid: assetId },
        data: { statustypeid: "1c4f0dd4-6a8c-496a-8e08-357fc922c026" },
      });
    }

    return new Response(
      JSON.stringify({
        message: "Asset assigned successfully",
        userAsset: result,
      }),
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error assigning asset:", error);
    return new Response(JSON.stringify({ error: "Error assigning asset" }), {
      status: 500,
    });
  }
}
