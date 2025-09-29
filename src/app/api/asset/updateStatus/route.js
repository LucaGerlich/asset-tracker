import prisma from "../../../../lib/prisma";

// PUT /api/asset/updateStatus
// Body: { assetId: string, statusTypeId?: string, statusName?: string }
export async function PUT(req) {
  try {
    const { assetId, statusTypeId, statusName } = await req.json();

    if (!assetId || (!statusTypeId && !statusName)) {
      return new Response(
        JSON.stringify({ error: "assetId and statusTypeId or statusName are required" }),
        { status: 400 }
      );
    }

    let statusId = statusTypeId;
    if (!statusId && statusName) {
      const found = await prisma.statusType.findFirst({
        where: { statustypename: { equals: statusName, mode: "insensitive" } },
      });
      if (!found) {
        return new Response(
          JSON.stringify({ error: `Status '${statusName}' not found` }),
          { status: 404 }
        );
      }
      statusId = found.statustypeid;
    }

    const updated = await prisma.asset.update({
      where: { assetid: assetId },
      data: { statustypeid: statusId, change_date: new Date() },
    });

    return new Response(JSON.stringify(updated), { status: 200 });
  } catch (error) {
    console.error("PUT /api/asset/updateStatus error:", error);
    return new Response(JSON.stringify({ error: "Failed to update status" }), {
      status: 500,
    });
  }
}

export const dynamic = "force-dynamic";

