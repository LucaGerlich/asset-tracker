import { NextResponse } from "next/server";
import prisma from "../../../lib/prisma";

// GET /api/supplier
export async function GET() {
  try {
    const items = await prisma.supplier.findMany({});
    return NextResponse.json(items, { status: 200 });
  } catch (e) {
    console.error("GET /api/supplier error:", e);
    return NextResponse.json({ error: "Failed to fetch suppliers" }, { status: 500 });
  }
}

// POST /api/supplier
export async function POST(req) {
  try {
    const body = await req.json();
    const { suppliername, firstname, lastname, salutation, email, phonenumber } = body || {};

    if (!suppliername) {
      return NextResponse.json(
        { error: "suppliername is required" },
        { status: 400 }
      );
    }

    const created = await prisma.supplier.create({
      data: {
        suppliername,
        firstname: firstname ?? null,
        lastname: lastname ?? null,
        salutation: salutation ?? null,
        email: email ?? null,
        phonenumber: phonenumber ?? null,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error("POST /api/supplier error:", e);
    return NextResponse.json({ error: "Failed to create supplier" }, { status: 500 });
  }
}

// PUT /api/supplier
export async function PUT(req) {
  try {
    const body = await req.json();
    const { supplierid, suppliername, firstname, lastname, salutation, email, phonenumber } =
      body || {};

    if (!supplierid) {
      return NextResponse.json({ error: "supplierid is required" }, { status: 400 });
    }

    const updated = await prisma.supplier.update({
      where: { supplierid },
      data: {
        suppliername,
        firstname: firstname ?? null,
        lastname: lastname ?? null,
        salutation: salutation ?? null,
        email: email ?? null,
        phonenumber: phonenumber ?? null,
        change_date: new Date(),
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    console.error("PUT /api/supplier error:", e);
    return NextResponse.json({ error: "Failed to update supplier" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
