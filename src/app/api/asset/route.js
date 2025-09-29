import { NextResponse } from "next/server";
import prisma from "../../../lib/prisma";

// GET /api/asset
// Optional query: ?id=<assetid>
export async function GET(req) {
  try {
    const id = req.nextUrl.searchParams.get("id");

    if (id) {
      const asset = await prisma.asset.findUnique({ where: { assetid: id } });
      if (!asset) {
        return NextResponse.json(
          { error: `Asset with id ${id} not found` },
          { status: 404 }
        );
      }
      return NextResponse.json(asset, { status: 200 });
    }

    const assets = await prisma.asset.findMany({});
    return NextResponse.json(assets, { status: 200 });
  } catch (error) {
    console.error("GET /api/asset error:", error);
    return NextResponse.json({ error: "Failed to fetch assets" }, { status: 500 });
  }
}

// POST /api/asset
export async function POST(req) {
  try {
    const body = await req.json();

    const {
      assetname,
      assettag,
      serialnumber,
      modelid,
      specs,
      notes,
      purchaseprice,
      purchasedate,
      mobile,
      requestable,
      assetcategorytypeid,
      statustypeid,
      supplierid,
      locationid,
      manufacturerid,
    } = body || {};

    if (!assetname || !assettag || !serialnumber) {
      return NextResponse.json(
        { error: "assetname, assettag and serialnumber are required" },
        { status: 400 }
      );
    }

    const created = await prisma.asset.create({
      data: {
        assetname,
        assettag,
        serialnumber,
        modelid: modelid ?? null,
        specs: specs ?? null,
        notes: notes ?? null,
        purchaseprice: purchaseprice ?? null,
        purchasedate: purchasedate ? new Date(purchasedate) : null,
        mobile: typeof mobile === "boolean" ? mobile : null,
        requestable: typeof requestable === "boolean" ? requestable : null,
        assetcategorytypeid: assetcategorytypeid ?? null,
        statustypeid: statustypeid ?? null,
        supplierid: supplierid ?? null,
        locationid: locationid ?? null,
        manufacturerid: manufacturerid ?? null,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/asset error:", error);
    return NextResponse.json({ error: "Failed to create asset" }, { status: 500 });
  }
}

// PUT /api/asset
// Body must include assetid; any provided fields will be updated
export async function PUT(req) {
  try {
    const body = await req.json();
    const { assetid, ...data } = body || {};

    if (!assetid) {
      return NextResponse.json(
        { error: "assetid is required to update an asset" },
        { status: 400 }
      );
    }

    // Normalize types
    if (Object.prototype.hasOwnProperty.call(data, "purchasedate") && data.purchasedate) {
      data.purchasedate = new Date(data.purchasedate);
    }
    if (Object.prototype.hasOwnProperty.call(data, "mobile")) {
      data.mobile = typeof data.mobile === "boolean" ? data.mobile : null;
    }
    if (Object.prototype.hasOwnProperty.call(data, "requestable")) {
      data.requestable = typeof data.requestable === "boolean" ? data.requestable : null;
    }

    const updated = await prisma.asset.update({
      where: { assetid },
      data: {
        ...data,
        change_date: new Date(),
      },
    });
    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("PUT /api/asset error:", error);
    return NextResponse.json({ error: "Failed to update asset" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
