import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
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
      isRequired,
      options,
      displayOrder,
    } = body || {};

    const updated = await prisma.custom_field_definitions.update({
      where: { id: params.id },
      data: {
        name: name ?? undefined,
        fieldType: fieldType ?? undefined,
        entityType: entityType ?? undefined,
        isRequired: isRequired !== undefined ? Boolean(isRequired) : undefined,
        options: options !== undefined ? (Array.isArray(options) ? JSON.stringify(options) : null) : undefined,
        displayOrder: displayOrder !== undefined ? Number(displayOrder) : undefined,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("PUT /api/admin/custom-fields/[id] error:", error);
    return NextResponse.json({ error: "Failed to update custom field" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { isActive } = body || {};

    if (typeof isActive !== "boolean") {
      return NextResponse.json({ error: "isActive must be boolean" }, { status: 400 });
    }

    const updated = await prisma.custom_field_definitions.update({
      where: { id: params.id },
      data: { isActive, updatedAt: new Date() },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("PATCH /api/admin/custom-fields/[id] error:", error);
    return NextResponse.json({ error: "Failed to update custom field" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await prisma.custom_field_definitions.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("DELETE /api/admin/custom-fields/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete custom field" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
