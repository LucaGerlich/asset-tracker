import { NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { Prisma } from "@prisma/client";

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
export async function POST(req) {
  try {
    const body = await req.json();
    const { locationname, street, housenumber, city, country } = body || {};

    if (!locationname) {
      return NextResponse.json(
        { error: "locationname is required" },
        { status: 400 }
      );
    }

    const created = await prisma.location.create({
      data: {
        locationname,
        street: street ?? null,
        housenumber: housenumber ?? null,
        city: city ?? null,
        country: country ?? null,
        creation_date: new Date(),
      } as Prisma.locationUncheckedCreateInput,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error("POST /api/location error:", e);
    return NextResponse.json({ error: "Failed to create location" }, { status: 500 });
  }
}

// PUT /api/location
export async function PUT(req) {
  try {
    const body = await req.json();
    const { locationid, locationname, street, housenumber, city, country } = body || {};

    if (!locationid) {
      return NextResponse.json({ error: "locationid is required" }, { status: 400 });
    }

    const updated = await prisma.location.update({
      where: { locationid },
      data: {
        locationname,
        street: street ?? null,
        housenumber: housenumber ?? null,
        city: city ?? null,
        country: country ?? null,
        change_date: new Date(),
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    console.error("PUT /api/location error:", e);
    return NextResponse.json({ error: "Failed to update location" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
