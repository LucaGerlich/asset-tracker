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
export async function POST(req) {
  try {
    const body = await req.json();
    const { manufacturername } = body || {};

    if (!manufacturername) {
      return NextResponse.json(
        { error: "manufacturername is required" },
        { status: 400 }
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

// PUT /api/manufacturer
export async function PUT(req) {
  try {
    const body = await req.json();
    const { manufacturerid, manufacturername } = body || {};

    if (!manufacturerid) {
      return NextResponse.json({ error: "manufacturerid is required" }, { status: 400 });
    }

    const updated = await prisma.manufacturer.update({
      where: { manufacturerid },
      data: {
        manufacturername,
        change_date: new Date(),
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    console.error("PUT /api/manufacturer error:", e);
    return NextResponse.json({ error: "Failed to update manufacturer" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
