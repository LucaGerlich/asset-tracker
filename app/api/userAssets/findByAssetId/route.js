import prisma from "../../../lib/prisma";

export async function GET(req) {
  try {
    const { assetId } = await req.json();

    if (!assetId) {
      return new Response(JSON.stringify({ error: "Asset ID is required" }), {
        status: 400,
      });
    }

    const userAsset = await prisma.userAssets.findFirst({
      where: { assetid: assetId },
    });

    if (!userAsset) {
      return new Response(JSON.stringify({ error: "UserAsset not found" }), {
        status: 404,
      });
    }

    return new Response(JSON.stringify({ userAsset }), {
      status: 200,
    });
  } catch (error) {
    console.error("Error finding UserAsset:", error);
    return new Response(JSON.stringify({ error: "Error finding UserAsset" }), {
      status: 500,
    });
  }
}
