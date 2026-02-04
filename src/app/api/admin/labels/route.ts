import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      name,
      width,
      height,
      includeQR = true,
      includeLogo = false,
      fields = [],
      layout = "standard",
    } = body || {};

    if (!name || !width || !height) {
      return NextResponse.json(
        { error: "name, width, and height are required" },
        { status: 400 }
      );
    }

    const hasDefault = await prisma.label_templates.findFirst({
      where: { isDefault: true },
      select: { id: true },
    });

    const created = await prisma.label_templates.create({
      data: {
        name,
        width: Number(width),
        height: Number(height),
        includeQR: Boolean(includeQR),
        includeLogo: Boolean(includeLogo),
        layout: layout || "standard",
        fields: JSON.stringify(Array.isArray(fields) ? fields : []),
        isDefault: !hasDefault,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/labels error:", error);
    return NextResponse.json({ error: "Failed to create label template" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
