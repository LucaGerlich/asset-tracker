import { NextResponse } from "next/server";
import prisma from "../../lib/prisma";

// GET /api/manufacturer
export async function GET() {
  try {
    const items = await prisma.manufacturer.findMany({});
    return NextResponse.json(items, { status: 200 });
  } catch (e) {
    console.error("GET /api/manufacturer error:", e);
    return NextResponse.json({ error: "Failed to fetch manufacturers" }, { status: 500 });
  }
}

// POST /api/manufacturer
export async function POST(request) {
  try {
    const body = await request.json();
    const { manufacturername } = body || {};

    if (!manufacturername) {
      return NextResponse.json(
        { error: "manufacturername is required" },
        { status: 400 },
      );
    }

    const created = await prisma.manufacturer.create({
      data: {
        manufacturername,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error("POST /api/manufacturer error:", e);
    return NextResponse.json({ error: "Failed to create manufacturer" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
