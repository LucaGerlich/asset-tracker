import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  requireApiAuth,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const notFound = () =>
  NextResponse.json(
    { error: "Maintenance schedule not found" },
    { status: 404 },
  );

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireApiAuth();

    const { id } = await params;

    // A caller without an organization owns no schedules. Never drop the
    // filter: it would reach every tenant's schedules.
    const orgId = user.organizationId;
    if (!orgId) return notFound();

    const schedule = await prisma.maintenance_schedules.findFirst({
      where: { id, asset: { organizationId: orgId } },
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

    if (!schedule) return notFound();

    return NextResponse.json(schedule);
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
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

    const user = await requireApiAuth();
    await requireWritableOrg(user);

    const { id } = await params;
    const body = await req.json();

    const orgId = user.organizationId;
    if (!orgId) return notFound();

    const existing = await prisma.maintenance_schedules.findFirst({
      where: { id, asset: { organizationId: orgId } },
    });

    if (!existing) return notFound();

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
    if (body.assignedTo !== undefined) {
      // The assignee is emailed on completion: it must be a user of this org.
      if (body.assignedTo) {
        const assignee = await prisma.user.findFirst({
          where: { userid: body.assignedTo, organizationId: orgId },
          select: { userid: true },
        });
        if (!assignee) {
          return NextResponse.json(
            { error: "Assigned user not found" },
            { status: 404 },
          );
        }
      }
      updateData.assignedTo = body.assignedTo || null;
    }
    if (body.estimatedCost !== undefined)
      updateData.estimatedCost = body.estimatedCost;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.assetId !== undefined) {
      // Verify asset exists and belongs to admin's org
      const asset = await prisma.asset.findFirst({
        where: { assetid: body.assetId, organizationId: orgId },
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
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("Error updating maintenance schedule", { error });
    return NextResponse.json(
      { error: "Failed to update maintenance schedule" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const user = await requireApiAuth();
    await requireWritableOrg(user);

    const { id } = await params;

    const orgId = user.organizationId;
    if (!orgId) return notFound();

    const existing = await prisma.maintenance_schedules.findFirst({
      where: { id, asset: { organizationId: orgId } },
    });

    if (!existing) return notFound();

    await prisma.maintenance_schedules.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("Error deleting maintenance schedule", { error });
    return NextResponse.json(
      { error: "Failed to delete maintenance schedule" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
