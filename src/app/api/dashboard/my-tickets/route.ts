import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApiAuth, type AuthUser } from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user: AuthUser = await requireApiAuth();

    const tickets = await prisma.tickets.findMany({
      where: { createdBy: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    const items = tickets.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      createdAt: t.createdAt.toISOString(),
    }));

    return NextResponse.json(items);
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("GET /api/dashboard/my-tickets error", { error });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
