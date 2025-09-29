import { NextResponse } from "next/server";
import prisma from "../../../lib/prisma";

// GET /api/consumable
export async function GET() {
  try {
    const items = await prisma.consumable.findMany({});
    return NextResponse.json(items, { status: 200 });
  } catch (e) {
    console.error("GET /api/consumable error:", e);
    return NextResponse.json({ error: "Failed to fetch consumables" }, { status: 500 });
  }
}

// POST /api/consumable
export async function POST(req) {
  try {
    const body = await req.json();
    const {
      consumablename,
      consumablecategorytypeid,
      manufacturerid,
      supplierid,
      purchaseprice,
      purchasedate,
    } = body || {};

    if (!consumablename || !consumablecategorytypeid || !manufacturerid || !supplierid) {
      return NextResponse.json(
        {
          error: "consumablename, consumablecategorytypeid, manufacturerid and supplierid are required",
        },
        { status: 400 }
      );
    }

    const created = await prisma.consumable.create({
      data: {
        consumablename,
        consumablecategorytypeid,
        manufacturerid,
        supplierid,
        purchaseprice:
          purchaseprice === undefined || purchaseprice === null || purchaseprice === ""
            ? null
            : Number(purchaseprice),
        purchasedate: purchasedate ? new Date(purchasedate) : null,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error("POST /api/consumable error:", e);
    return NextResponse.json({ error: "Failed to create consumable" }, { status: 500 });
  }
}

// PUT /api/consumable
export async function PUT(req) {
  try {
    const body = await req.json();
    const {
      consumableid,
      consumablename,
      consumablecategorytypeid,
      manufacturerid,
      supplierid,
      purchaseprice,
      purchasedate,
    } = body || {};

    if (!consumableid) {
      return NextResponse.json({ error: "consumableid is required" }, { status: 400 });
    }

    const updated = await prisma.consumable.update({
      where: { consumableid },
      data: {
        consumablename,
        consumablecategorytypeid,
        manufacturerid,
        supplierid,
        purchaseprice:
          purchaseprice === undefined || purchaseprice === null || purchaseprice === ""
            ? null
            : Number(purchaseprice),
        purchasedate: purchasedate ? new Date(purchasedate) : null,
        change_date: new Date(),
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    console.error("PUT /api/consumable error:", e);
    return NextResponse.json({ error: "Failed to update consumable" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
