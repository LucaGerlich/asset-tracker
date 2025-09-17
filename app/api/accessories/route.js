import { NextResponse } from "next/server";
import prisma from "../../lib/prisma";

// GET /api/accessories
export async function GET() {
  try {
    const items = await prisma.accessories.findMany({});
    return NextResponse.json(items, { status: 200 });
  } catch (e) {
    console.error("GET /api/accessories error:", e);
    return NextResponse.json({ error: "Failed to fetch accessories" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";

