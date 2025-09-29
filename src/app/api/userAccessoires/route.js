import { NextResponse } from "next/server";
import prisma from "../../../lib/prisma";

// GET /api/userAccessoires?userId=...
export async function GET(req) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");
    const where = userId ? { userid: userId } : {};
    const rows = await prisma.userAccessoires.findMany({ where });
    return NextResponse.json(rows, { status: 200 });
  } catch (e) {
    console.error("GET /api/userAccessoires error:", e);
    return NextResponse.json({ error: "Failed to fetch userAccessoires" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";

