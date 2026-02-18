import { NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { Prisma } from "@prisma/client";
import { getOrganizationContext, scopeToOrganization } from "@/lib/organization-context";
import {
  parsePaginationParams,
  buildPrismaArgs,
  buildPaginatedResponse,
} from "@/lib/pagination";
import { validateBody, createAssetSchema, updateAssetSchema } from "@/lib/validations";

const ASSET_SORT_FIELDS = [
  "assetname",
  "assettag",
  "serialnumber",
  "creation_date",
  "change_date",
  "purchaseprice",
];

// GET /api/asset
// Optional query: ?id=<assetid>
// Pagination: ?page=1&pageSize=25&sortBy=assetname&sortOrder=asc&search=keyword&statusId=<id>
export async function GET(req) {
  try {
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const searchParams = req.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (id) {
      const asset = await prisma.asset.findUnique({ where: { assetid: id } });
      if (!asset) {
        return NextResponse.json(
          { error: `Asset with id ${id} not found` },
          { status: 404 }
        );
      }
      return NextResponse.json(asset, { status: 200 });
    }

    // If no `page` param, return all results for backward compatibility
    if (!searchParams.has("page")) {
      const where = scopeToOrganization({}, orgId);
      const assets = await prisma.asset.findMany({ where });
      return NextResponse.json(assets, { status: 200 });
    }

    // Paginated path
    const params = parsePaginationParams(searchParams);
    const prismaArgs = buildPrismaArgs(params, ASSET_SORT_FIELDS);

    const where: Record<string, unknown> = scopeToOrganization({}, orgId);

    // Status filter
    const statusId = searchParams.get("statusId");
    if (statusId) {
      where.statustypeid = statusId;
    }

    // Search filter (assetname, assettag, serialnumber)
    if (params.search) {
      where.OR = [
        { assetname: { contains: params.search, mode: "insensitive" } },
        { assettag: { contains: params.search, mode: "insensitive" } },
        { serialnumber: { contains: params.search, mode: "insensitive" } },
      ];
    }

    const [assets, total] = await Promise.all([
      prisma.asset.findMany({ where, ...prismaArgs }),
      prisma.asset.count({ where }),
    ]);

    return NextResponse.json(
      buildPaginatedResponse(assets, total, params),
      { status: 200 },
    );
  } catch (error) {
    console.error("GET /api/asset error:", error);
    return NextResponse.json({ error: "Failed to fetch assets" }, { status: 500 });
  }
}

// POST /api/asset
export async function POST(req) {
  try {
    const body = await req.json();
    const d = validateBody(createAssetSchema, body);
    if (d instanceof NextResponse) return d;

    const created = await prisma.asset.create({
      data: {
        assetname: d.assetname,
        assettag: d.assettag,
        serialnumber: d.serialnumber,
        modelid: d.modelid ?? null,
        specs: d.specs ?? null,
        notes: d.notes ?? null,
        purchaseprice: d.purchaseprice ?? null,
        purchasedate: d.purchasedate ? new Date(d.purchasedate) : null,
        mobile: d.mobile ?? null,
        requestable: d.requestable ?? null,
        assetcategorytypeid: d.assetcategorytypeid ?? null,
        statustypeid: d.statustypeid ?? null,
        supplierid: d.supplierid ?? null,
        locationid: d.locationid ?? null,
        manufacturerid: d.manufacturerid ?? null,
        warrantyMonths: d.warrantyMonths ?? null,
        warrantyExpires: d.warrantyExpires ? new Date(d.warrantyExpires) : null,
        creation_date: new Date(),
      } as Prisma.assetUncheckedCreateInput,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/asset error:", error);
    return NextResponse.json({ error: "Failed to create asset" }, { status: 500 });
  }
}

// PUT /api/asset
// Body must include assetid; any provided fields will be updated
export async function PUT(req) {
  try {
    const body = await req.json();
    const validated = validateBody(updateAssetSchema, body);
    if (validated instanceof NextResponse) return validated;

    const { assetid, ...data } = validated;

    // Normalize date types
    const updateData: Record<string, unknown> = { ...data };
    if (updateData.purchasedate) {
      updateData.purchasedate = new Date(updateData.purchasedate as string);
    }
    if (updateData.warrantyExpires) {
      updateData.warrantyExpires = new Date(updateData.warrantyExpires as string);
    }

    const updated = await prisma.asset.update({
      where: { assetid },
      data: {
        ...updateData,
        change_date: new Date(),
      },
    });
    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("PUT /api/asset error:", error);
    return NextResponse.json({ error: "Failed to update asset" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
