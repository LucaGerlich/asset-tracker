import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";

// GET /api/asset/checkout?assetId=<uuid>
export async function GET(req: Request) {
  try {
    await requireApiAuth();

    const url = new URL(req.url);
    const assetId = url.searchParams.get("assetId");

    if (!assetId) {
      return NextResponse.json(
        { error: "assetId query parameter is required" },
        { status: 400 },
      );
    }

    const checkouts = await prisma.assetCheckout.findMany({
      where: { assetId },
      include: {
        checkedOutToUser: {
          select: { userid: true, firstname: true, lastname: true },
        },
        checkedOutByUser: {
          select: { userid: true, firstname: true, lastname: true },
        },
      },
      orderBy: { checkoutDate: "desc" },
    });

    return NextResponse.json(checkouts, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("GET /api/asset/checkout error:", message);
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (message.includes("Forbidden")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to fetch checkouts" },
      { status: 500 },
    );
  }
}

// POST /api/asset/checkout
// Body: { assetId, checkedOutTo, expectedReturn?, notes? }
export async function POST(req: Request) {
  try {
    const user = await requireApiAuth();

    const body = await req.json();
    const { assetId, checkedOutTo, expectedReturn, notes } = body || {};

    if (!assetId || !checkedOutTo) {
      return NextResponse.json(
        { error: "assetId and checkedOutTo are required" },
        { status: 400 },
      );
    }

    // Validate asset exists
    const asset = await prisma.asset.findUnique({
      where: { assetid: assetId },
    });

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    const checkout = await prisma.assetCheckout.create({
      data: {
        assetId,
        checkedOutTo,
        checkedOutBy: user.id as string,
        expectedReturn: expectedReturn ? new Date(expectedReturn) : null,
        notes: notes || null,
        status: "checked_out",
      },
    });

    return NextResponse.json(checkout, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("POST /api/asset/checkout error:", message);
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (message.includes("Forbidden")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to create checkout" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
