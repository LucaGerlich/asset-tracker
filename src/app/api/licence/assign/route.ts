import prisma from "../../../../lib/prisma";
import { requirePermission } from "@/lib/api-auth";
import { triggerWebhook } from "@/lib/webhooks";

// POST /api/licence/assign
// Body: { licenceId, userId }
export async function POST(req) {
  try {
    await requirePermission('license:assign');
    const { licenceId, userId } = await req.json();
    if (!licenceId || !userId) {
      return new Response(JSON.stringify({ error: "licenceId and userId are required" }), { status: 400 });
    }
    const updated = await prisma.licence.update({
      where: { licenceid: licenceId },
      data: { licenceduserid: userId, change_date: new Date() },
    });

    triggerWebhook('license.assigned', { licenceId, userId, licenceKey: updated.licencekey }).catch(() => {});

    return new Response(JSON.stringify(updated), { status: 200 });
  } catch (e) {
    console.error("POST /api/licence/assign error:", e);
    if (e instanceof Error && e.message === "Unauthorized") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    if (e instanceof Error && e.message.startsWith("Forbidden")) {
      return new Response(JSON.stringify({ error: e.message }), { status: 403 });
    }
    return new Response(JSON.stringify({ error: "Failed to assign licence" }), { status: 500 });
  }
}
