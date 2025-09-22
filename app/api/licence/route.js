import { NextResponse } from "next/server";
import prisma from "../../lib/prisma";

// GET /api/licence
export async function GET() {
  try {
    const items = await prisma.licence.findMany({});
    return NextResponse.json(items, { status: 200 });
  } catch (e) {
    console.error("GET /api/licence error:", e);
    return NextResponse.json({ error: "Failed to fetch licences" }, { status: 500 });
  }
}

// POST /api/licence
export async function POST(req) {
  try {
    const body = await req.json();
    const {
      licencekey,
      licenceduserid,
      licensedtoemail,
      purchaseprice,
      purchasedate,
      expirationdate,
      notes,
      requestable,
      licencecategorytypeid,
      manufacturerid,
      supplierid,
    } = body || {};

    if (!licencecategorytypeid || !manufacturerid || !supplierid) {
      return NextResponse.json(
        {
          error: "licencecategorytypeid, manufacturerid and supplierid are required",
        },
        { status: 400 }
      );
    }

    const created = await prisma.licence.create({
      data: {
        licencekey: licencekey ?? null,
        licenceduserid: licenceduserid ?? null,
        licensedtoemail: licensedtoemail ?? null,
        purchaseprice:
          purchaseprice === undefined || purchaseprice === null || purchaseprice === ""
            ? null
            : Number(purchaseprice),
        purchasedate: purchasedate ? new Date(purchasedate) : null,
        expirationdate: expirationdate ? new Date(expirationdate) : null,
        notes: notes ?? null,
        requestable: typeof requestable === "boolean" ? requestable : null,
        licencecategorytypeid,
        manufacturerid,
        supplierid,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error("POST /api/licence error:", e);
    return NextResponse.json({ error: "Failed to create licence" }, { status: 500 });
  }
}

// PUT /api/licence
export async function PUT(req) {
  try {
    const body = await req.json();
    const {
      licenceid,
      licencekey,
      licenceduserid,
      licensedtoemail,
      purchaseprice,
      purchasedate,
      expirationdate,
      notes,
      requestable,
      licencecategorytypeid,
      manufacturerid,
      supplierid,
    } = body || {};

    if (!licenceid) {
      return NextResponse.json({ error: "licenceid is required" }, { status: 400 });
    }

    const updated = await prisma.licence.update({
      where: { licenceid },
      data: {
        licencekey: licencekey ?? null,
        licenceduserid: licenceduserid ?? null,
        licensedtoemail: licensedtoemail ?? null,
        purchaseprice:
          purchaseprice === undefined || purchaseprice === null || purchaseprice === ""
            ? null
            : Number(purchaseprice),
        purchasedate: purchasedate ? new Date(purchasedate) : null,
        expirationdate: expirationdate ? new Date(expirationdate) : null,
        notes: notes ?? null,
        requestable: typeof requestable === "boolean" ? requestable : null,
        licencecategorytypeid,
        manufacturerid,
        supplierid,
        change_date: new Date(),
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    console.error("PUT /api/licence error:", e);
    return NextResponse.json({ error: "Failed to update licence" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
