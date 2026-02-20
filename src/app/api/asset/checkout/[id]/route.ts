import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";

// GET /api/asset/checkout/[id]
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireApiAuth();

    const { id } = await params;

    const checkout = await prisma.assetCheckout.findUnique({
      where: { id },
      include: {
        checkedOutToUser: {
          select: { userid: true, firstname: true, lastname: true },
        },
        checkedOutByUser: {
          select: { userid: true, firstname: true, lastname: true },
        },
      },
    });

    if (!checkout) {
      return NextResponse.json(
        { error: "Checkout not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(checkout, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("GET /api/asset/checkout/[id] error:", message);
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (message.includes("Forbidden")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to fetch checkout" },
      { status: 500 },
    );
  }
}

// PUT /api/asset/checkout/[id] — Check-in (return asset)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireApiAuth();

    const { id } = await params;

    const existing = await prisma.assetCheckout.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Checkout not found" },
        { status: 404 },
      );
    }

    const updated = await prisma.assetCheckout.update({
      where: { id },
      data: {
        returnDate: new Date(),
        status: "returned",
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("PUT /api/asset/checkout/[id] error:", message);
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (message.includes("Forbidden")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to check in asset" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
