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
      fieldType,
      entityType,
      isRequired = false,
      options,
    } = body || {};

    if (!name || !fieldType || !entityType) {
      return NextResponse.json(
        { error: "name, fieldType, and entityType are required" },
        { status: 400 }
      );
    }

    const maxOrder = await prisma.custom_field_definitions.aggregate({
      where: { entityType },
      _max: { displayOrder: true },
    });

    const created = await prisma.custom_field_definitions.create({
      data: {
        name,
        fieldType,
        entityType,
        isRequired: Boolean(isRequired),
        options: Array.isArray(options) ? JSON.stringify(options) : null,
        displayOrder: (maxOrder._max.displayOrder ?? 0) + 1,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/custom-fields error:", error);
    return NextResponse.json({ error: "Failed to create custom field" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
