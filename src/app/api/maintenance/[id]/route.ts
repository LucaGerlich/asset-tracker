import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApiAuth, requireNotDemoMode } from "@/lib/api-auth";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET: Fetch a single maintenance schedule with its logs
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    await requireApiAuth();
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const { id } = await params;

    const schedule = await prisma.maintenance_schedules.findFirst({
      where: {
        id,
        ...(orgId ? { asset: { organizationId: orgId } } : {}),
      },
      include: {
        asset: {
          select: { assetid: true, assetname: true },
        },
        user: {
          select: { userid: true, firstname: true, lastname: true },
        },
        maintenance_logs: {
          include: {
            user: {
              select: { userid: true, firstname: true, lastname: true },
            },
          },
          orderBy: { completedAt: "desc" },
        },
      },
    });

    if (!schedule) {
      return NextResponse.json(
        { error: "Maintenance schedule not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(schedule);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error fetching maintenance schedule", { error });
    return NextResponse.json(
      { error: "Failed to fetch maintenance schedule" },
      { status: 500 },
    );
  }
}

// PUT: Update a maintenance schedule
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    await requireApiAuth();

    const { id } = await params;
    const body = await req.json();

    const orgCtx2 = await getOrganizationContext();
    const orgId2 = orgCtx2?.organization?.id;

    const existing = await prisma.maintenance_schedules.findFirst({
      where: {
        id,
        ...(orgId2 ? { asset: { organizationId: orgId2 } } : {}),
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Maintenance schedule not found" },
        { status: 404 },
      );
    }

    // Build update data from provided fields
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined)
      updateData.description = body.description;
    if (body.frequency !== undefined) {
      const validFrequencies = [
        "daily",
        "weekly",
        "monthly",
        "quarterly",
        "annually",
      ];
      if (!validFrequencies.includes(body.frequency)) {
        return NextResponse.json(
          {
            error: `Invalid frequency. Must be one of: ${validFrequencies.join(", ")}`,
          },
          { status: 400 },
        );
      }
      updateData.frequency = body.frequency;
    }
    if (body.nextDueDate !== undefined)
      updateData.nextDueDate = new Date(body.nextDueDate);
    if (body.assignedTo !== undefined)
      updateData.assignedTo = body.assignedTo || null;
    if (body.estimatedCost !== undefined)
      updateData.estimatedCost = body.estimatedCost;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.assetId !== undefined) {
      // Verify asset exists if changing it
      const asset = await prisma.asset.findUnique({
        where: { assetid: body.assetId },
      });
      if (!asset) {
        return NextResponse.json({ error: "Asset not found" }, { status: 404 });
      }
      updateData.assetId = body.assetId;
    }

    const schedule = await prisma.maintenance_schedules.update({
      where: { id },
      data: updateData,
      include: {
        asset: {
          select: { assetid: true, assetname: true },
        },
        user: {
          select: { userid: true, firstname: true, lastname: true },
        },
      },
    });

    return NextResponse.json(schedule);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error updating maintenance schedule", { error });
    return NextResponse.json(
      { error: "Failed to update maintenance schedule" },
      { status: 500 },
    );
  }
}

// DELETE: Delete a maintenance schedule
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    await requireApiAuth();
    const orgCtx3 = await getOrganizationContext();
    const orgId3 = orgCtx3?.organization?.id;

    const { id } = await params;

    const existing = await prisma.maintenance_schedules.findFirst({
      where: {
        id,
        ...(orgId3 ? { asset: { organizationId: orgId3 } } : {}),
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Maintenance schedule not found" },
        { status: 404 },
      );
    }

    await prisma.maintenance_schedules.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error deleting maintenance schedule", { error });
    return NextResponse.json(
      { error: "Failed to delete maintenance schedule" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
