import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  requirePermission,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { hasPermission } from "@/lib/rbac";
import { assetReservationSchema } from "@/lib/validation-organization";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit-log";
import { triggerWebhook } from "@/lib/webhooks";
import { logger } from "@/lib/logger";
import { z } from "zod";
import {
  parsePaginationParams,
  buildPrismaArgs,
  buildPaginatedResponse,
} from "@/lib/pagination";

const RESERVATION_SORT_FIELDS = ["startDate", "endDate", "status", "createdAt"];

export async function GET(req: NextRequest) {
  try {
    const authUser = await requirePermission("reservation:view");

    const searchParams = req.nextUrl.searchParams;
    const assetId = searchParams.get("assetId");
    const userId = searchParams.get("userId");
    const status = searchParams.get("status");

    // Tenant isolation: AssetReservation has no organizationId column, so scope
    // through the asset relation (like /api/asset/reservations).
    const where: Record<string, unknown> = {
      asset: { organizationId: authUser.organizationId ?? null },
    };

    if (assetId) where.assetId = assetId;
    if (userId) where.userId = userId;
    if (status) where.status = status;

    // Non-admin users without reservation:approve can only see their own reservations
    const canApprove =
      authUser.isAdmin ||
      (authUser.id
        ? await hasPermission(authUser.id, "reservation:approve")
        : false);
    if (!canApprove) {
      where.userId = authUser.id!;
    }

    const include = {
      asset: {
        select: { assetid: true, assetname: true, assettag: true },
      },
      user: {
        select: { userid: true, firstname: true, lastname: true, email: true },
      },
    };

    // If no `page` param, return all results for backward compatibility
    if (!searchParams.has("page")) {
      const reservations = await prisma.assetReservation.findMany({
        where,
        include,
        orderBy: { startDate: "desc" },
      });
      return NextResponse.json(reservations);
    }

    // Paginated path
    const params = parsePaginationParams(searchParams);
    const prismaArgs = buildPrismaArgs(params, RESERVATION_SORT_FIELDS);

    // Search filter
    if (params.search) {
      where.OR = [{ notes: { contains: params.search, mode: "insensitive" } }];
    }

    const [reservations, total] = await Promise.all([
      prisma.assetReservation.findMany({ where, include, ...prismaArgs }),
      prisma.assetReservation.count({ where }),
    ]);

    return NextResponse.json(
      buildPaginatedResponse(reservations, total, params),
      { status: 200 },
    );
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("Error fetching reservations", { error });
    return NextResponse.json(
      { error: "Failed to fetch reservations" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const authUser = await requirePermission("reservation:create");
    await requireWritableOrg(authUser);

    const body = await req.json();
    const validated = assetReservationSchema.parse(body);

    // Verify the asset belongs to the caller's organization and is requestable
    const asset = await prisma.asset.findFirst({
      where: {
        assetid: validated.assetId,
        organizationId: authUser.organizationId ?? null,
      },
    });

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    if (asset.requestable === false) {
      return NextResponse.json(
        { error: "Asset is not available for reservation" },
        { status: 400 },
      );
    }

    const startDate = new Date(validated.startDate);
    const endDate = new Date(validated.endDate);

    if (startDate >= endDate) {
      return NextResponse.json(
        { error: "End date must be after start date" },
        { status: 400 },
      );
    }

    const overlapping = await prisma.assetReservation.findFirst({
      where: {
        assetId: validated.assetId,
        status: { in: ["pending", "approved"] },
        OR: [
          {
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
        ],
      },
    });

    if (overlapping) {
      return NextResponse.json(
        { error: "Asset is already reserved for this time period" },
        { status: 400 },
      );
    }

    const reservation = await prisma.assetReservation.create({
      data: {
        assetId: validated.assetId,
        userId: authUser.id!,
        startDate,
        endDate,
        notes: validated.notes,
        status: "pending",
      },
      include: {
        asset: { select: { assetname: true, assettag: true } },
        user: { select: { firstname: true, lastname: true } },
      },
    });

    await createAuditLog({
      userId: authUser.id!,
      action: AUDIT_ACTIONS.REQUEST,
      entity: "AssetReservation",
      entityId: reservation.id,
      details: {
        assetId: validated.assetId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    });

    await triggerWebhook(
      "asset.reserved",
      {
        reservation,
        asset: reservation.asset,
        user: reservation.user,
      },
      asset.organizationId,
    );

    return NextResponse.json(reservation, { status: 201 });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("Error creating reservation", { error });
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to create reservation" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
