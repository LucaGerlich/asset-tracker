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

// POST /api/accessories
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      accessoriename,
      accessorietag,
      manufacturerid,
      modelid,
      statustypeid,
      accessoriecategorytypeid,
      locationid,
      supplierid,
      purchaseprice,
      purchasedate,
      requestable,
    } = body || {};

    if (!accessoriename || !accessorietag || !manufacturerid || !modelid || !statustypeid || !accessoriecategorytypeid || !locationid || !supplierid) {
      return NextResponse.json(
        { error: "accessoriename, accessorietag, manufacturerid, modelid, statustypeid, accessoriecategorytypeid, locationid and supplierid are required" },
        { status: 400 },
      );
    }

    const created = await prisma.accessories.create({
      data: {
        accessoriename,
        accessorietag,
        manufacturerid,
        modelid,
        statustypeid,
        accessoriecategorytypeid,
        locationid,
        supplierid,
        purchaseprice: purchaseprice === undefined || purchaseprice === "" ? null : Number(purchaseprice),
        purchasedate: purchasedate ? new Date(purchasedate) : null,
        requestable: requestable === undefined || requestable === "" ? null : requestable === true || requestable === "true",
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error("POST /api/accessories error:", e);
    return NextResponse.json({ error: "Failed to create accessory" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
