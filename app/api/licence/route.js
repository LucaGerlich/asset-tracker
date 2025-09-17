import { NextResponse } from "next/server";
import prisma from "../../lib/prisma";

// GET /api/licence
export async function GET() {
  try {
    const items = await prisma.licence.findMany({});
    return NextResponse.json(items, { status: 200 });
  } catch (e) {
    console.error("GET /api/licence error:", e);
    return NextResponse.json({ error: "Failed to fetch licences" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";

