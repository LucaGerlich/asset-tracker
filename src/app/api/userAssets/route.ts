import { NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";
import { getOrganizationContext } from "@/lib/organization-context";

// GET /api/userAssets
export async function GET() {
  try {
    const user = await requireApiAuth();
    const orgContext = await getOrganizationContext();
    const orgId = orgContext?.organization?.id;

    const where: Record<string, unknown> = user.isAdmin ? {} : { userid: user.id };

    // Scope through the related asset's organizationId
    if (orgId) {
      where.asset = { organizationId: orgId };
    }

    const items = await prisma.userAssets.findMany({ where });
    return NextResponse.json(items, { status: 200 });
  } catch (error) {
    console.error("GET /api/userAssets error:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to fetch userAssets" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
