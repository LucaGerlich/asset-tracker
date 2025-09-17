import prisma from "../../../lib/prisma";

// POST /api/licence/assign
// Body: { licenceId, userId }
export async function POST(req) {
  try {
    const { licenceId, userId } = await req.json();
    if (!licenceId || !userId) {
      return new Response(JSON.stringify({ error: "licenceId and userId are required" }), { status: 400 });
    }
    const updated = await prisma.licence.update({
      where: { licenceid: licenceId },
      data: { licenceduserid: userId, change_date: new Date() },
    });
    return new Response(JSON.stringify(updated), { status: 200 });
  } catch (e) {
    console.error("POST /api/licence/assign error:", e);
    return new Response(JSON.stringify({ error: "Failed to assign licence" }), { status: 500 });
  }
}

