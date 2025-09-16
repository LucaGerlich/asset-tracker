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

    // Resolve the "Active" status id (case-insensitive)
    const activeStatus = await prisma.statusType.findFirst({
      where: { statustypename: { equals: "Active", mode: "insensitive" } },
    });
    if (!activeStatus) {
      return new Response(
        JSON.stringify({ error: "Status 'Active' not found in statusType" }),
        { status: 500 }
      );
    }

    // Check if the asset is already assigned
    const existingAssignment = await prisma.userAssets.findFirst({
      where: { assetid: assetId },
    });

    let result;

    if (existingAssignment) {
      // Update the existing assignment
      result = await prisma.userAssets.update({
        where: { userassetsid: existingAssignment.userassetsid },
        data: { userid: userId },
      });
    } else {
      // Create a new assignment
      result = await prisma.userAssets.create({
        data: {
          assetid: assetId,
          userid: userId,
        },
      });
    }

    // Set asset status to Active on assign
    await prisma.asset.update({
      where: { assetid: assetId },
      data: { statustypeid: activeStatus.statustypeid },
    });

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
