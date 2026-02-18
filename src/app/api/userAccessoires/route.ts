import { NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";
import { getOrganizationContext } from "@/lib/organization-context";

// GET /api/userAccessoires?userId=...
export async function GET(req) {
  try {
    const authUser = await requireApiAuth();
    const orgContext = await getOrganizationContext();
    const orgId = orgContext?.organization?.id;

    const userId = req.nextUrl.searchParams.get("userId");
    const resolvedUserId = authUser.isAdmin ? userId : authUser.id;
    const where: Record<string, unknown> = resolvedUserId ? { userid: resolvedUserId } : {};

    // Scope through the related accessory's organizationId
    if (orgId) {
      where.accessories = { organizationId: orgId };
    }

    const rows = await prisma.userAccessoires.findMany({ where });
    return NextResponse.json(rows, { status: 200 });
  } catch (e) {
    console.error("GET /api/userAccessoires error:", e);
    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to fetch userAccessoires" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
