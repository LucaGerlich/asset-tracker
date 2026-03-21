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
  data: unknown,
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
    { status: 400 },
  );
}

// ---------------------------------------------------------------------------
// Reusable field schemas
// ---------------------------------------------------------------------------

const uuidField = z.string().uuid("Must be a valid UUID");
const optionalUuid = z
  .string()
  .uuid("Must be a valid UUID")
  .optional()
  .nullable();
const trimmedString = z.string().trim().min(1, "Required");
const optionalString = z.string().trim().optional().nullable();

// ---------------------------------------------------------------------------
// Authentication schemas
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(50, "Username too long"),
  password: z.string().min(1, "Password is required"),
});

// ---------------------------------------------------------------------------
// User schemas
// ---------------------------------------------------------------------------

export const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email().nullable().optional(),
  firstname: z.string().min(1).max(100),
  lastname: z.string().min(1).max(100),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100)
    .optional(),
  isadmin: z.boolean().default(false),
  canrequest: z.boolean().default(false),
  lan: z.string().max(50).nullable().optional(),
  passwordMode: z.enum(["generate", "manual", "invite"]).default("manual"),
});

export const updateUserSchema = z.object({
  username: z.string().min(3).max(50).optional(),
  email: z.string().email().optional().nullable(),
  firstname: z.string().min(1).max(100).optional(),
  lastname: z.string().min(1).max(100).optional(),
  password: z.string().min(8).max(100).optional(),
  isadmin: z.boolean().optional(),
  canrequest: z.boolean().optional(),
  lan: z.string().max(50).optional().nullable(),
});

// ---------------------------------------------------------------------------
// Asset schemas
// ---------------------------------------------------------------------------

export const createAssetSchema = z.object({
  assetname: trimmedString.max(255),
  assettag: trimmedString.max(50),
  serialnumber: trimmedString.max(100),
  modelid: optionalUuid,
  specs: optionalString,
  notes: optionalString,
  purchaseprice: z.coerce
    .number()
    .nonnegative("Must be >= 0")
    .optional()
    .nullable(),
  purchasedate: z
    .string()
    .datetime({ offset: true })
    .optional()
    .nullable()
    .or(
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .nullable(),
    ),
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
  assetname: trimmedString.max(255).optional(),
  assettag: trimmedString.max(50).optional(),
  serialnumber: trimmedString.max(100).optional(),
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
// Accessory schemas
// ---------------------------------------------------------------------------

export const createAccessorySchema = z.object({
  accessoriename: z.string().min(1).max(255),
  accessorietag: z.string().min(1).max(50),
  purchaseprice: z.number().positive().nullable().optional(),
  purchasedate: z.string().datetime().nullable().optional(),
  requestable: z.boolean().nullable().optional(),
  manufacturerid: z.string().uuid(),
  statustypeid: z.string().uuid(),
  accessoriecategorytypeid: z.string().uuid(),
  locationid: z.string().uuid(),
  supplierid: z.string().uuid(),
  modelid: z.string().uuid(),
});

export const updateAccessorySchema = createAccessorySchema.partial();

// ---------------------------------------------------------------------------
// License schemas
// ---------------------------------------------------------------------------

export const createLicenseSchema = z.object({
  licencekey: z.string().max(255).nullable().optional(),
  licenceduserid: z.string().uuid().nullable().optional(),
  licensedtoemail: z.string().email().nullable().optional(),
  purchaseprice: z.number().positive().nullable().optional(),
  purchasedate: z.string().datetime().nullable().optional(),
  expirationdate: z.string().datetime().nullable().optional(),
  notes: z.string().nullable().optional(),
  requestable: z.boolean().nullable().optional(),
  licencecategorytypeid: z.string().uuid(),
  manufacturerid: z.string().uuid(),
  supplierid: z.string().uuid(),
});

export const updateLicenseSchema = createLicenseSchema.partial();

// ---------------------------------------------------------------------------
// Consumable schemas
// ---------------------------------------------------------------------------

export const createConsumableSchema = z.object({
  consumablename: z.string().min(1).max(255),
  consumablecategorytypeid: z.string().uuid(),
  manufacturerid: z.string().uuid(),
  supplierid: z.string().uuid(),
  purchaseprice: z.number().positive().nullable().optional(),
  purchasedate: z.string().datetime().nullable().optional(),
  minQuantity: z.number().int().nonnegative().nullable().optional(),
  quantity: z.number().int().nonnegative().nullable().optional(),
});

export const updateConsumableSchema = createConsumableSchema.partial();

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
// Manufacturer schemas
// ---------------------------------------------------------------------------

export const createManufacturerSchema = z.object({
  manufacturername: z.string().min(1).max(255),
});

export const updateManufacturerSchema = createManufacturerSchema.partial();

// ---------------------------------------------------------------------------
// Supplier schemas
// ---------------------------------------------------------------------------

export const createSupplierSchema = z.object({
  suppliername: z.string().min(1).max(255),
  lastname: z.string().max(255).nullable().optional(),
  firstname: z.string().max(255).nullable().optional(),
  salutation: z.string().max(50).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phonenumber: z.string().max(50).nullable().optional(),
});

export const updateSupplierSchema = createSupplierSchema.partial();

// ---------------------------------------------------------------------------
// Location schemas
// ---------------------------------------------------------------------------

export const createLocationSchema = z.object({
  locationname: z.string().min(1).max(255),
  street: z.string().max(255).nullable().optional(),
  housenumber: z.string().max(50).nullable().optional(),
  city: z.string().max(255).nullable().optional(),
  country: z.string().max(255).nullable().optional(),
});

export const updateLocationSchema = createLocationSchema.partial();

// ---------------------------------------------------------------------------
// Category Type schemas
// ---------------------------------------------------------------------------

export const createAssetCategoryTypeSchema = z.object({
  assetcategorytypename: z.string().min(1).max(255),
});

export const updateAssetCategoryTypeSchema =
  createAssetCategoryTypeSchema.partial();

export const createAccessoryCategoryTypeSchema = z.object({
  accessoriecategorytypename: z.string().min(1).max(255),
});

export const updateAccessoryCategoryTypeSchema =
  createAccessoryCategoryTypeSchema.partial();

export const createConsumableCategoryTypeSchema = z.object({
  consumablecategorytypename: z.string().min(1).max(255),
});

export const updateConsumableCategoryTypeSchema =
  createConsumableCategoryTypeSchema.partial();

export const createLicenceCategoryTypeSchema = z.object({
  licencecategorytypename: z.string().min(1).max(255),
});

export const updateLicenceCategoryTypeSchema =
  createLicenceCategoryTypeSchema.partial();

// ---------------------------------------------------------------------------
// Model schemas
// ---------------------------------------------------------------------------

export const createModelSchema = z.object({
  modelname: z.string().min(1).max(255),
  modelnumber: z.string().max(255).nullable().optional(),
});

export const updateModelSchema = createModelSchema.partial();

// ---------------------------------------------------------------------------
// Status Type schemas
// ---------------------------------------------------------------------------

export const createStatusTypeSchema = z.object({
  statustypename: z.string().min(1).max(255),
});

export const updateStatusTypeSchema = createStatusTypeSchema.partial();

// ---------------------------------------------------------------------------
// Generic UUID validation
// ---------------------------------------------------------------------------

export const uuidSchema = z.string().uuid();

// ---------------------------------------------------------------------------
// Pagination schemas
// ---------------------------------------------------------------------------

export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
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
  conditions: z
    .union([z.string(), z.record(z.string(), z.unknown())])
    .optional(),
  actions: z
    .union([
      z.string(),
      z.array(z.unknown()),
      z.record(z.string(), z.unknown()),
    ])
    .optional(),
  isActive: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Component schemas
// ---------------------------------------------------------------------------

export const createComponentSchema = z.object({
  name: trimmedString,
  serialNumber: optionalString,
  categoryId: uuidField,
  totalQuantity: z.number().int().nonnegative("Must be >= 0").default(0),
  purchasePrice: z.coerce
    .number()
    .nonnegative("Must be >= 0")
    .optional()
    .nullable(),
  purchaseDate: z.string().optional().nullable(),
  minQuantity: z.number().int().nonnegative().default(0),
  manufacturerId: optionalUuid,
  supplierId: optionalUuid,
  locationId: optionalUuid,
});

export const updateComponentSchema = createComponentSchema.partial();

export const componentCheckoutSchema = z.object({
  componentId: uuidField,
  assetId: uuidField,
  quantity: z.number().int().positive("Must be a positive integer").default(1),
  notes: optionalString,
});

export const componentCheckinSchema = z.object({
  checkoutId: uuidField,
  quantity: z.number().int().positive("Must be a positive integer").optional(),
  notes: optionalString,
});

export const createComponentCategorySchema = z.object({
  name: trimmedString,
});

export const updateComponentCategorySchema =
  createComponentCategorySchema.partial();

// ---------------------------------------------------------------------------
// Asset checkout schemas
// ---------------------------------------------------------------------------

export const assetCheckoutSchema = z
  .object({
    assetId: uuidField,
    checkedOutToType: z
      .enum(["user", "location", "asset"], {
        message: "Must be user, location, or asset",
      })
      .default("user"),
    checkedOutTo: optionalUuid,
    checkedOutToLocationId: optionalUuid,
    checkedOutToAssetId: optionalUuid,
    expectedReturn: z.string().optional().nullable(),
    notes: optionalString,
  })
  .refine(
    (data) => {
      if (data.checkedOutToType === "user") return !!data.checkedOutTo;
      if (data.checkedOutToType === "location")
        return !!data.checkedOutToLocationId;
      if (data.checkedOutToType === "asset") return !!data.checkedOutToAssetId;
      return false;
    },
    { message: "Target ID is required for the selected checkout type" },
  );

export const assetCheckinSchema = z.object({
  checkoutId: uuidField,
  notes: optionalString,
});

// ---------------------------------------------------------------------------
// Licence seat schemas
// ---------------------------------------------------------------------------

export const assignLicenceSeatSchema = z.object({
  licenceId: uuidField,
  userId: uuidField,
  notes: optionalString,
});

export const unassignLicenceSeatSchema = z.object({
  assignmentId: uuidField,
});

// ---------------------------------------------------------------------------
// EULA Templates
// ---------------------------------------------------------------------------

export const createEulaTemplateSchema = z.object({
  name: trimmedString,
  content: z.string().min(1, "EULA content is required"),
  version: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

export const updateEulaTemplateSchema = createEulaTemplateSchema.partial();

// ---------------------------------------------------------------------------
// Bulk Checkout
// ---------------------------------------------------------------------------

export const bulkCheckoutSchema = z
  .object({
    assetIds: z.array(uuidField).min(1, "At least one asset is required"),
    checkedOutToType: z.enum(["user", "location", "asset"]).default("user"),
    checkedOutTo: optionalUuid,
    checkedOutToLocationId: optionalUuid,
    checkedOutToAssetId: optionalUuid,
    expectedReturn: z.string().optional().nullable(),
    notes: optionalString,
  })
  .refine(
    (data) => {
      if (data.checkedOutToType === "user") return !!data.checkedOutTo;
      if (data.checkedOutToType === "location")
        return !!data.checkedOutToLocationId;
      if (data.checkedOutToType === "asset") return !!data.checkedOutToAssetId;
      return false;
    },
    { message: "Target ID is required for the selected checkout type" },
  );

// ---------------------------------------------------------------------------
// Predefined Kits
// ---------------------------------------------------------------------------

export const createKitSchema = z.object({
  name: trimmedString,
  description: optionalString,
  isActive: z.boolean().optional(),
  items: z
    .array(
      z.object({
        entityType: z.enum([
          "asset_category",
          "accessory",
          "licence",
          "component",
        ]),
        entityId: uuidField,
        quantity: z.number().int().positive().default(1),
        isRequired: z.boolean().default(true),
        notes: optionalString,
      }),
    )
    .optional(),
});

export const updateKitSchema = createKitSchema.partial();

export const kitCheckoutSchema = z.object({
  kitId: uuidField,
  userId: uuidField,
  notes: optionalString,
});

// ---------------------------------------------------------------------------
// Audit Campaigns
// ---------------------------------------------------------------------------

export const createAuditCampaignSchema = z.object({
  name: trimmedString,
  description: optionalString,
  dueDate: z.string().optional().nullable(),
  scopeType: z.enum(["all", "location", "category"]).default("all"),
  scopeId: optionalUuid,
  auditorIds: z.array(uuidField).optional(),
});

export const updateAuditCampaignSchema = createAuditCampaignSchema.partial();

export const auditScanSchema = z.object({
  assetId: uuidField,
  locationId: optionalUuid,
  status: z.enum(["found", "missing", "moved"]).default("found"),
  notes: optionalString,
});
