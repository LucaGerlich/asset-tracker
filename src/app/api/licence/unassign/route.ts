import prisma from "../../../../lib/prisma";
import { requirePermission } from "@/lib/api-auth";

// DELETE /api/licence/unassign
// Body: { licenceId }
export async function DELETE(req) {
  try {
    await requirePermission('license:assign');
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
    if (e instanceof Error && e.message === "Unauthorized") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    if (e instanceof Error && e.message.startsWith("Forbidden")) {
      return new Response(JSON.stringify({ error: e.message }), { status: 403 });
    }
    return new Response(JSON.stringify({ error: "Failed to unassign licence" }), { status: 500 });
  }
}
