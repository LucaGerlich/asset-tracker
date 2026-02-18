import prisma from "../../../../lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requirePermission } from "@/lib/api-auth";
import { getOrganizationContext } from "@/lib/organization-context";
import { createAssetSchema } from "@/lib/validation";
import { triggerWebhook } from "@/lib/webhooks";

const assetSchema = createAssetSchema.extend({
  purchaseprice: z.number().nonnegative().nullable().optional(),
}).strict();

const normalizeDateInput = (value: unknown) => {
  if (value === null || value === undefined) return value;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T00:00:00.000Z`;
  }
  return trimmed;
};

const normalizeNumberInput = (value: unknown) => {
  if (value === "" || value === null || value === undefined) return undefined;
  if (typeof value === "number") return value;
  const num = Number(value);
  return Number.isNaN(num) ? value : num;
};

// Create asset via POST /api/asset/addAsset
export async function POST(req) {
  try {
    await requirePermission('asset:create');
    const body = await req.json();

    const normalized = {
      ...body,
      purchaseprice: normalizeNumberInput(body?.purchaseprice),
      purchasedate: normalizeDateInput(body?.purchasedate),
    };

    const validationResult = assetSchema.safeParse(normalized);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ error: "Validation failed", details: validationResult.error.issues }),
        { status: 400 }
      );
    }

    const { assetname, assettag, serialnumber, ...rest } = validationResult.data;

    // Get organization context for the creating admin
    const orgContext = await getOrganizationContext();

    const created = await prisma.asset.create({
      data: {
        assetname,
        assettag,
        serialnumber,
        modelid: rest.modelid ?? null,
        specs: rest.specs ?? null,
        notes: rest.notes ?? null,
        purchaseprice: rest.purchaseprice ?? null,
        purchasedate: rest.purchasedate ? new Date(rest.purchasedate) : null,
        mobile: typeof rest.mobile === "boolean" ? rest.mobile : null,
        requestable: typeof rest.requestable === "boolean" ? rest.requestable : null,
        assetcategorytypeid: rest.assetcategorytypeid ?? null,
        statustypeid: rest.statustypeid ?? null,
        supplierid: rest.supplierid ?? null,
        locationid: rest.locationid ?? null,
        manufacturerid: rest.manufacturerid ?? null,
        creation_date: new Date(),
        organizationId: orgContext?.organization?.id || null,
      } as Prisma.assetUncheckedCreateInput,
    });

    triggerWebhook('asset.created', { assetId: created.assetid, assetName: created.assetname, assetTag: created.assettag }, created.organizationId).catch(() => {});

    return new Response(JSON.stringify(created), { status: 201 });
  } catch (error) {
    console.error("Error creating asset:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith("Forbidden")) {
      return new Response(JSON.stringify({ error: error.message }), { status: 403 });
    }
    return new Response(JSON.stringify({ error: "Error creating asset" }), {
      status: 500,
    });
  }
}
