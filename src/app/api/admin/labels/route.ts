import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApiAdmin, requireNotDemoMode } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    await requireApiAdmin();

    const templates = await prisma.label_templates.findMany({
      orderBy: { name: "asc" },
    });

    return NextResponse.json(templates, { status: 200 });
  } catch (error) {
    logger.error("GET /api/admin/labels error", { error });
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes("Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to fetch label templates" },
      { status: 500 },
    );
  }
}

// POST /api/admin/labels
export async function POST(req: Request) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    await requireApiAdmin();
    const body = await req.json();
    const {
      name,
      width,
      height,
      layout,
      includeQR,
      includeLogo,
      fields,
      isDefault,
    } = body;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    // If setting as default, unset others
    if (isDefault) {
      await prisma.label_templates.updateMany({
        where: { isDefault: true },
        data: { isDefault: false, updatedAt: new Date() },
      });
    }

    const template = await prisma.label_templates.create({
      data: {
        name,
        width: width || 3,
        height: height || 2,
        layout: layout || "standard",
        includeQR: includeQR ?? true,
        includeLogo: includeLogo ?? false,
        fields:
          typeof fields === "string" ? fields : JSON.stringify(fields || []),
        isDefault: isDefault || false,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    logger.error("POST /api/admin/labels error", { error });
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to create label template" },
      { status: 500 },
    );
  }
}
