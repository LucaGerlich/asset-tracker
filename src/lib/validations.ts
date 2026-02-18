import { z } from "zod";
import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Validation helper
// ---------------------------------------------------------------------------

/**
 * Validate request body against a Zod schema.
 * Returns parsed data on success, or a NextResponse with 400 status and
 * field-level error messages on failure.
 *
 * Usage:
 *   const data = validateBody(schema, body);
 *   if (data instanceof NextResponse) return data;
 *   // data is now the parsed & typed result
 */
export function validateBody<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): z.infer<T> | NextResponse {
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }

  const fieldErrors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join(".") || "_root";
    if (!fieldErrors[path]) fieldErrors[path] = [];
    fieldErrors[path].push(issue.message);
  }

  return NextResponse.json(
    { error: "Validation failed", fields: fieldErrors },
    { status: 400 }
  );
}

// ---------------------------------------------------------------------------
// Reusable field schemas
// ---------------------------------------------------------------------------

const uuidField = z.string().uuid("Must be a valid UUID");
const optionalUuid = z.string().uuid("Must be a valid UUID").optional().nullable();
const trimmedString = z.string().trim().min(1, "Required");
const optionalString = z.string().trim().optional().nullable();

// ---------------------------------------------------------------------------
// Asset schemas
// ---------------------------------------------------------------------------

export const createAssetSchema = z.object({
  assetname: trimmedString,
  assettag: trimmedString,
  serialnumber: trimmedString,
  modelid: optionalUuid,
  specs: optionalString,
  notes: optionalString,
  purchaseprice: z.coerce.number().nonnegative("Must be >= 0").optional().nullable(),
  purchasedate: z.string().datetime({ offset: true }).optional().nullable()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable()),
  mobile: z.boolean().optional().nullable(),
  requestable: z.boolean().optional().nullable(),
  assetcategorytypeid: optionalUuid,
  statustypeid: optionalUuid,
  supplierid: optionalUuid,
  locationid: optionalUuid,
  manufacturerid: optionalUuid,
  warrantyMonths: z.coerce.number().int().nonnegative().optional().nullable(),
  warrantyExpires: z.string().optional().nullable(),
});

export const updateAssetSchema = z.object({
  assetid: uuidField,
  assetname: trimmedString.optional(),
  assettag: trimmedString.optional(),
  serialnumber: trimmedString.optional(),
  modelid: optionalUuid,
  specs: optionalString,
  notes: optionalString,
  purchaseprice: z.coerce.number().nonnegative().optional().nullable(),
  purchasedate: z.string().optional().nullable(),
  mobile: z.boolean().optional().nullable(),
  requestable: z.boolean().optional().nullable(),
  assetcategorytypeid: optionalUuid,
  statustypeid: optionalUuid,
  supplierid: optionalUuid,
  locationid: optionalUuid,
  manufacturerid: optionalUuid,
  warrantyMonths: z.coerce.number().int().nonnegative().optional().nullable(),
  warrantyExpires: z.string().optional().nullable(),
});

// ---------------------------------------------------------------------------
// Consumable checkout schema
// ---------------------------------------------------------------------------

export const consumableCheckoutSchema = z.object({
  consumableId: uuidField,
  userId: uuidField,
  quantity: z.number().int().positive("Must be a positive integer").default(1),
  notes: optionalString,
});

// ---------------------------------------------------------------------------
// Approval schemas
// ---------------------------------------------------------------------------

export const createApprovalSchema = z.object({
  entityType: z.enum(["reservation", "asset_request", "transfer"], {
    message: "Must be reservation, asset_request, or transfer",
  }),
  entityId: uuidField,
  notes: optionalString,
});

export const resolveApprovalSchema = z.object({
  action: z.enum(["approve", "reject"], {
    message: "Must be approve or reject",
  }),
  notes: optionalString,
});

// ---------------------------------------------------------------------------
// Transfer schema
// ---------------------------------------------------------------------------

export const createTransferSchema = z.object({
  assetId: uuidField,
  transferType: z.enum(["user", "location", "organization"], {
    message: "Must be user, location, or organization",
  }),
  fromUserId: optionalUuid,
  toUserId: optionalUuid,
  fromLocationId: optionalUuid,
  toLocationId: optionalUuid,
  fromOrgId: optionalUuid,
  toOrgId: optionalUuid,
  reason: optionalString,
});

// ---------------------------------------------------------------------------
// Automation rule schema
// ---------------------------------------------------------------------------

export const createAutomationRuleSchema = z.object({
  name: trimmedString,
  description: optionalString,
  trigger: z.enum([
    "warranty_expiring",
    "maintenance_due",
    "asset_status_change",
    "license_expiring",
    "stock_low",
  ]),
  conditions: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
  actions: z.union([z.string(), z.array(z.unknown()), z.record(z.string(), z.unknown())]).optional(),
  isActive: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// User management schema
// ---------------------------------------------------------------------------

export const createUserSchema = z.object({
  firstname: trimmedString,
  lastname: trimmedString,
  email: z.string().email("Must be a valid email address"),
  username: z.string().trim().min(2, "Must be at least 2 characters").optional().nullable(),
  isadmin: z.boolean().optional(),
  canrequest: z.boolean().optional(),
});
