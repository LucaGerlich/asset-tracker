import { NextResponse } from "next/server";
import prisma from "../../../lib/prisma";

// GET /api/userAssets
export async function GET() {
  try {
    const items = await prisma.userAssets.findMany({});
    return NextResponse.json(items, { status: 200 });
  } catch (error) {
    console.error("GET /api/userAssets error:", error);
    return NextResponse.json({ error: "Failed to fetch userAssets" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";

