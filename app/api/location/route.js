import { NextResponse } from "next/server";
import prisma from "../../lib/prisma";

// GET /api/location
export async function GET() {
  try {
    const items = await prisma.location.findMany({});
    return NextResponse.json(items, { status: 200 });
  } catch (e) {
    console.error("GET /api/location error:", e);
    return NextResponse.json({ error: "Failed to fetch locations" }, { status: 500 });
  }
}

// POST /api/location
export async function POST(request) {
  try {
    const body = await request.json();
    const { locationname, street, housenumber, city, country } = body || {};

    if (!locationname) {
      return NextResponse.json(
        { error: "locationname is required" },
        { status: 400 },
      );
    }

    const created = await prisma.location.create({
      data: {
        locationname,
        street: street || null,
        housenumber: housenumber || null,
        city: city || null,
        country: country || null,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error("POST /api/location error:", e);
    return NextResponse.json({ error: "Failed to create location" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
