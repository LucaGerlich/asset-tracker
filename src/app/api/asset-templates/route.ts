import { type NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import {
  requirePermission,
  requireNotDemoMode,
  requireApiAdmin,
} from "@/lib/api-auth";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";
import { logger } from "@/lib/logger";

// GET /api/asset-templates
// List all active templates scoped to the user's organization
export async function GET(req: NextRequest) {
  try {
    await requirePermission("asset:view");
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const where = scopeToOrganization({ isActive: true }, orgId);

    const templates = await prisma.assetTemplate.findMany({
      where,
      orderBy: { name: "asc" },
    });

    return NextResponse.json(templates, { status: 200 });
  } catch (error) {
    logger.error("GET /api/asset-templates error", { error });
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to fetch asset templates" },
      { status: 500 },
    );
  }
}

// POST /api/asset-templates
// Create a new asset template (admin only)
export async function POST(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const user = await requireApiAdmin();
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const body = await req.json();

    if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json(
        { error: "Template name is required" },
        { status: 400 },
      );
    }

    if (body.name.length > 200) {
      return NextResponse.json(
        { error: "Template name must be 200 characters or less" },
        { status: 400 },
      );
    }

    const created = await prisma.assetTemplate.create({
      data: {
        name: body.name.trim(),
        description: body.description || null,
        assetcategorytypeid: body.assetcategorytypeid || null,
        manufacturerid: body.manufacturerid || null,
        modelid: body.modelid || null,
        statustypeid: body.statustypeid || null,
        locationid: body.locationid || null,
        supplierid: body.supplierid || null,
        defaultSpecs: body.defaultSpecs || null,
        defaultNotes: body.defaultNotes || null,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
        organizationId: orgId || null,
        createdBy: user.id || null,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    logger.error("POST /api/asset-templates error", { error });
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to create asset template" },
      { status: 500 },
    );
  }
}

// PUT /api/asset-templates
// Update an existing template (admin only)
// Body must include id
export async function PUT(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    await requireApiAdmin();
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const body = await req.json();
    const { id, ...data } = body || {};

    if (!id) {
      return NextResponse.json(
        { error: "Template id is required" },
        { status: 400 },
      );
    }

    // Verify template belongs to user's organization
    const existing = await prisma.assetTemplate.findFirst({
      where: scopeToOrganization({ id }, orgId),
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Asset template not found" },
        { status: 404 },
      );
    }

    if (data.name !== undefined) {
      if (typeof data.name !== "string" || !data.name.trim()) {
        return NextResponse.json(
          { error: "Template name cannot be empty" },
          { status: 400 },
        );
      }
      if (data.name.length > 200) {
        return NextResponse.json(
          { error: "Template name must be 200 characters or less" },
          { status: 400 },
        );
      }
      data.name = data.name.trim();
    }

    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      "name",
      "description",
      "assetcategorytypeid",
      "manufacturerid",
      "modelid",
      "statustypeid",
      "locationid",
      "supplierid",
      "defaultSpecs",
      "defaultNotes",
      "isActive",
    ];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    const updated = await prisma.assetTemplate.update({
      where: { id: existing.id },
      data: updateData,
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    logger.error("PUT /api/asset-templates error", { error });
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to update asset template" },
      { status: 500 },
    );
  }
}

// DELETE /api/asset-templates
// Delete a template (admin only)
// Body must include id
export async function DELETE(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    await requireApiAdmin();
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const body = await req.json();
    const { id } = body || {};

    if (!id) {
      return NextResponse.json(
        { error: "Template id is required" },
        { status: 400 },
      );
    }

    // Verify template belongs to user's organization
    const existing = await prisma.assetTemplate.findFirst({
      where: scopeToOrganization({ id }, orgId),
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Asset template not found" },
        { status: 404 },
      );
    }

    await prisma.assetTemplate.delete({
      where: { id: existing.id },
    });

    return NextResponse.json(
      { message: "Asset template deleted successfully" },
      { status: 200 },
    );
  } catch (error) {
    logger.error("DELETE /api/asset-templates error", { error });
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to delete asset template" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
