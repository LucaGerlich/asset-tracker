import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { method, usefulLifeYears, salvagePercent } = body || {};

    const updated = await prisma.depreciation_settings.update({
      where: { id: params.id },
      data: {
        method: method ?? undefined,
        usefulLifeYears: usefulLifeYears !== undefined ? Number(usefulLifeYears) : undefined,
        salvagePercent: salvagePercent !== undefined ? Number(salvagePercent) : undefined,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("PUT /api/admin/depreciation/[id] error:", error);
    return NextResponse.json({ error: "Failed to update depreciation settings" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
