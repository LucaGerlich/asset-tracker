import prisma from "../../../lib/prisma";

export async function PUT(req) {
  try {
    const { userAssetsId, userId } = await req.json();

    if (!userAssetsId || !userId) {
      console.error("Missing userAssetsId or userId", { userAssetsId, userId });
      return new Response(
        JSON.stringify({ error: "UserAssets ID and User ID are required" }),
        {
          status: 400,
        }
      );
    }

    const updatedUserAsset = await prisma.userAssets.update({
      where: {
        userassetsid: userAssetsId,
      },
      data: {
        userid: userId,
        change_date: new Date(),
      },
    });

    return new Response(
      JSON.stringify({
        message: "UserAsset updated successfully",
        userAsset: updatedUserAsset,
      }),
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error updating UserAsset:", error);
    return new Response(JSON.stringify({ error: "Error updating UserAsset" }), {
      status: 500,
    });
  }
}
