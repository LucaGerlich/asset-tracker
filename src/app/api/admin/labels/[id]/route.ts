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
      width,
      height,
      includeQR,
      includeLogo,
      fields,
      layout,
    } = body || {};

    const updated = await prisma.label_templates.update({
      where: { id: params.id },
      data: {
        name: name ?? undefined,
        width: width !== undefined ? Number(width) : undefined,
        height: height !== undefined ? Number(height) : undefined,
        includeQR: includeQR !== undefined ? Boolean(includeQR) : undefined,
        includeLogo: includeLogo !== undefined ? Boolean(includeLogo) : undefined,
        layout: layout ?? undefined,
        fields: fields !== undefined ? JSON.stringify(Array.isArray(fields) ? fields : []) : undefined,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("PUT /api/admin/labels/[id] error:", error);
    return NextResponse.json({ error: "Failed to update label template" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const template = await prisma.label_templates.findUnique({
      where: { id: params.id },
      select: { id: true, isDefault: true },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    await prisma.label_templates.delete({ where: { id: params.id } });

    if (template.isDefault) {
      const nextTemplate = await prisma.label_templates.findFirst({
        orderBy: { createdAt: "asc" },
      });
      if (nextTemplate) {
        await prisma.label_templates.update({
          where: { id: nextTemplate.id },
          data: { isDefault: true, updatedAt: new Date() },
        });
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("DELETE /api/admin/labels/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete label template" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
