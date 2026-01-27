import prisma from "../../../../lib/prisma";

// DELETE /api/userAccessoires/unassign
// Body: { userId, accessorieId }
export async function DELETE(req) {
  try {
    const { userId, accessorieId } = await req.json();
    if (!userId || !accessorieId) {
      return new Response(JSON.stringify({ error: "userId and accessorieId are required" }), { status: 400 });
    }
    const result = await prisma.userAccessoires.deleteMany({ where: { userid: userId, accessorieid: accessorieId } });
    return new Response(JSON.stringify({ message: "Accessory unassigned", result }), { status: 200 });
  } catch (e) {
    console.error("DELETE /api/userAccessoires/unassign error:", e);
    return new Response(JSON.stringify({ error: "Failed to unassign accessory" }), { status: 500 });
  }
}

