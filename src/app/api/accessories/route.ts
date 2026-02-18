import { NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { Prisma } from "@prisma/client";
import { getOrganizationContext, scopeToOrganization } from "@/lib/organization-context";
import {
  parsePaginationParams,
  buildPrismaArgs,
  buildPaginatedResponse,
} from "@/lib/pagination";

const ACCESSORY_SORT_FIELDS = ["accessoriename", "creation_date"];

// GET /api/accessories
// Pagination: ?page=1&pageSize=25&sortBy=accessoriename&sortOrder=asc&search=keyword
export async function GET(req) {
  try {
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const searchParams = req.nextUrl.searchParams;

    // If no `page` param, return all results for backward compatibility
    if (!searchParams.has("page")) {
      const where = scopeToOrganization({}, orgId);
      const items = await prisma.accessories.findMany({ where });
      return NextResponse.json(items, { status: 200 });
    }

    // Paginated path
    const params = parsePaginationParams(searchParams);
    const prismaArgs = buildPrismaArgs(params, ACCESSORY_SORT_FIELDS);

    const where: Record<string, unknown> = scopeToOrganization({}, orgId);

    // Search filter (accessoriename)
    if (params.search) {
      where.accessoriename = { contains: params.search, mode: "insensitive" };
    }

    const [items, total] = await Promise.all([
      prisma.accessories.findMany({ where, ...prismaArgs }),
      prisma.accessories.count({ where }),
    ]);

    return NextResponse.json(
      buildPaginatedResponse(items, total, params),
      { status: 200 },
    );
  } catch (e) {
    console.error("GET /api/accessories error:", e);
    return NextResponse.json({ error: "Failed to fetch accessories" }, { status: 500 });
  }
}

// POST /api/accessories
export async function POST(req) {
  try {
    const body = await req.json();
    const {
      accessoriename,
      accessorietag,
      manufacturerid,
      statustypeid,
      accessoriecategorytypeid,
      locationid,
      supplierid,
      modelid,
      purchaseprice,
      purchasedate,
      requestable,
    } = body || {};

    if (
      !accessoriename ||
      !accessorietag ||
      !manufacturerid ||
      !statustypeid ||
      !accessoriecategorytypeid ||
      !locationid ||
      !supplierid ||
      !modelid
    ) {
      return NextResponse.json(
        {
          error:
            "accessoriename, accessorietag, manufacturerid, statustypeid, accessoriecategorytypeid, locationid, supplierid and modelid are required",
        },
        { status: 400 }
      );
    }

    const created = await prisma.accessories.create({
      data: {
        accessoriename,
        accessorietag,
        manufacturerid,
        statustypeid,
        accessoriecategorytypeid,
        locationid,
        supplierid,
        modelid,
        purchaseprice:
          purchaseprice === undefined || purchaseprice === null || purchaseprice === ""
            ? null
            : Number(purchaseprice),
        purchasedate: purchasedate ? new Date(purchasedate) : null,
        requestable: typeof requestable === "boolean" ? requestable : null,
        creation_date: new Date(),
      } as Prisma.accessoriesUncheckedCreateInput,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error("POST /api/accessories error:", e);
    return NextResponse.json({ error: "Failed to create accessory" }, { status: 500 });
  }
}

// PUT /api/accessories
export async function PUT(req) {
  try {
    const body = await req.json();
    const {
      accessorieid,
      accessoriename,
      accessorietag,
      manufacturerid,
      statustypeid,
      accessoriecategorytypeid,
      locationid,
      supplierid,
      modelid,
      purchaseprice,
      purchasedate,
      requestable,
    } = body || {};

    if (!accessorieid) {
      return NextResponse.json({ error: "accessorieid is required" }, { status: 400 });
    }

    const updated = await prisma.accessories.update({
      where: { accessorieid },
      data: {
        accessoriename,
        accessorietag,
        manufacturerid,
        statustypeid,
        accessoriecategorytypeid,
        locationid,
        supplierid,
        modelid,
        purchaseprice:
          purchaseprice === undefined || purchaseprice === null || purchaseprice === ""
            ? null
            : Number(purchaseprice),
        purchasedate: purchasedate ? new Date(purchasedate) : null,
        requestable: typeof requestable === "boolean" ? requestable : null,
        change_date: new Date(),
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    console.error("PUT /api/accessories error:", e);
    return NextResponse.json({ error: "Failed to update accessory" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
