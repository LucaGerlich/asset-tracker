import prisma from "../../../../lib/prisma";

// POST /api/userAccessoires/assign
// Body: { userId, accessorieId }
export async function POST(req) {
  try {
    const { userId, accessorieId } = await req.json();
    if (!userId || !accessorieId) {
      return new Response(JSON.stringify({ error: "userId and accessorieId are required" }), { status: 400 });
    }
    const exists = await prisma.userAccessoires.findFirst({ where: { userid: userId, accessorieid: accessorieId } });
    let record = exists;
    if (!exists) {
      record = await prisma.userAccessoires.create({ data: { userid: userId, accessorieid: accessorieId } });
    }
    return new Response(JSON.stringify({ message: "Accessory assigned", userAccessoire: record }), { status: 200 });
  } catch (e) {
    console.error("POST /api/userAccessoires/assign error:", e);
    return new Response(JSON.stringify({ error: "Failed to assign accessory" }), { status: 500 });
  }
}

