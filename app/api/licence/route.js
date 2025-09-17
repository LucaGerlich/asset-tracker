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
export async function POST(request) {
  try {
    const body = await request.json();
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
        { error: "licencecategorytypeid, manufacturerid and supplierid are required" },
        { status: 400 },
      );
    }

    const created = await prisma.licence.create({
      data: {
        licencekey: licencekey || null,
        licenceduserid: licenceduserid || null,
        licensedtoemail: licensedtoemail || null,
        purchaseprice: purchaseprice === undefined || purchaseprice === "" ? null : Number(purchaseprice),
        purchasedate: purchasedate ? new Date(purchasedate) : null,
        expirationdate: expirationdate ? new Date(expirationdate) : null,
        notes: notes || null,
        requestable: requestable === undefined || requestable === "" ? null : requestable === true || requestable === "true",
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

export const dynamic = "force-dynamic";
