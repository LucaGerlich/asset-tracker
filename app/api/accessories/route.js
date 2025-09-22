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
export async function POST(req) {
  try {
    const body = await req.json();
    const {
      accessoriename,
      accessorietag,
      manufacturerid,
      statustypeid,
      accessoriecategorytypeid,
      locationid,
      supplierid,
      modelid,
      purchaseprice,
      purchasedate,
      requestable,
    } = body || {};

    if (
      !accessoriename ||
      !accessorietag ||
      !manufacturerid ||
      !statustypeid ||
      !accessoriecategorytypeid ||
      !locationid ||
      !supplierid ||
      !modelid
    ) {
      return NextResponse.json(
        {
          error:
            "accessoriename, accessorietag, manufacturerid, statustypeid, accessoriecategorytypeid, locationid, supplierid and modelid are required",
        },
        { status: 400 }
      );
    }

    const created = await prisma.accessories.create({
      data: {
        accessoriename,
        accessorietag,
        manufacturerid,
        statustypeid,
        accessoriecategorytypeid,
        locationid,
        supplierid,
        modelid,
        purchaseprice:
          purchaseprice === undefined || purchaseprice === null || purchaseprice === ""
            ? null
            : Number(purchaseprice),
        purchasedate: purchasedate ? new Date(purchasedate) : null,
        requestable: typeof requestable === "boolean" ? requestable : null,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error("POST /api/accessories error:", e);
    return NextResponse.json({ error: "Failed to create accessory" }, { status: 500 });
  }
}

// PUT /api/accessories
export async function PUT(req) {
  try {
    const body = await req.json();
    const {
      accessorieid,
      accessoriename,
      accessorietag,
      manufacturerid,
      statustypeid,
      accessoriecategorytypeid,
      locationid,
      supplierid,
      modelid,
      purchaseprice,
      purchasedate,
      requestable,
    } = body || {};

    if (!accessorieid) {
      return NextResponse.json({ error: "accessorieid is required" }, { status: 400 });
    }

    const updated = await prisma.accessories.update({
      where: { accessorieid },
      data: {
        accessoriename,
        accessorietag,
        manufacturerid,
        statustypeid,
        accessoriecategorytypeid,
        locationid,
        supplierid,
        modelid,
        purchaseprice:
          purchaseprice === undefined || purchaseprice === null || purchaseprice === ""
            ? null
            : Number(purchaseprice),
        purchasedate: purchasedate ? new Date(purchasedate) : null,
        requestable: typeof requestable === "boolean" ? requestable : null,
        change_date: new Date(),
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    console.error("PUT /api/accessories error:", e);
    return NextResponse.json({ error: "Failed to update accessory" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
