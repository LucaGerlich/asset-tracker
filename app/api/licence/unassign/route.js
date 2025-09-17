import prisma from "../../../lib/prisma";

// DELETE /api/licence/unassign
// Body: { licenceId }
export async function DELETE(req) {
  try {
    const { licenceId } = await req.json();
    if (!licenceId) {
      return new Response(JSON.stringify({ error: "licenceId is required" }), { status: 400 });
    }
    const updated = await prisma.licence.update({
      where: { licenceid: licenceId },
      data: { licenceduserid: null, change_date: new Date() },
    });
    return new Response(JSON.stringify(updated), { status: 200 });
  } catch (e) {
    console.error("DELETE /api/licence/unassign error:", e);
    return new Response(JSON.stringify({ error: "Failed to unassign licence" }), { status: 500 });
  }
}

