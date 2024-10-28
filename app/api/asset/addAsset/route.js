import prisma from "../../../lib/prisma";

export async function PUT(req) {
  try {
    const { assetId } = await req.json();

    if (!assetId) {
      return new Response(JSON.stringify({ error: "Asset ID is required" }), {
        status: 400,
      });
    }

    await prisma.asset.delete({
      where: { assetid: assetId },
    });

    return new Response(
      JSON.stringify({ message: "Asset deleted successfully" }),
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error deleting asset:", error);
    return new Response(JSON.stringify({ error: "Error deleting asset" }), {
      status: 500,
    });
  }
}
