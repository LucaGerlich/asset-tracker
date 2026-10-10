import { z } from "zod";

/**
 * Organization validation schemas
 */
export const organizationSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  description: z.string().optional().nullable(),
  settings: z.record(z.string(), z.unknown()).optional().nullable(),
});

/**
 * Update payload for an org admin. It deliberately has no `isActive`: the
 * active flag drives tenant suspension and must only change through
 * `organizationAdminUpdateSchema`. Unknown keys are stripped by `z.object`.
 */
export const updateOrganizationSchema = organizationSchema.partial();

/** Update payload for a platform super-admin: may also (de)activate an org. */
export const organizationAdminUpdateSchema = updateOrganizationSchema.extend({
  isActive: z.boolean().optional(),
});

export type OrganizationInput = z.infer<typeof organizationSchema>;
export type OrganizationAdminUpdateInput = z.infer<
  typeof organizationAdminUpdateSchema
>;

/**
 * Department validation schemas
 */
export const departmentSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().optional().nullable(),
  // Never used to pick the org: a department is created in the caller's org.
  // Accepted for existing clients; when present it must match the caller's org.
  organizationId: z.string().uuid().optional(),
  parentId: z.string().uuid().optional().nullable(),
});

export const updateDepartmentSchema = departmentSchema
  .partial()
  .omit({ organizationId: true });

export type DepartmentInput = z.infer<typeof departmentSchema>;

/**
 * Role validation schemas
 */
export const roleSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().optional().nullable(),
  permissions: z.array(z.string()),
  organizationId: z.string().uuid().optional().nullable(),
});

/**
 * Update payload for a role. `organizationId` is not accepted: a role belongs
 * to the org that created it and can never be moved to another org or made
 * global through an update (z.object strips the unknown key).
 */
export const updateRoleSchema = roleSchema
  .partial()
  .omit({ organizationId: true });

export type RoleInput = z.infer<typeof roleSchema>;

/**
 * Webhook validation schemas
 */
const webhookRetryAttempts = z.number().int().min(0).max(5);

/**
 * Webhook fields without create defaults. zod 4's `.partial()` re-applies
 * `.default()`, so update schemas must be derived from a default-free base:
 * otherwise a PUT with only `{ name }` would silently re-enable the webhook.
 */
const webhookFields = z.object({
  name: z.string().min(1, "Name is required").max(100),
  url: z.string().url("Must be a valid URL").max(500),
  secret: z.string().max(255).optional().nullable(),
  events: z.array(z.string()).min(1, "At least one event is required"),
  isActive: z.boolean(),
  retryAttempts: webhookRetryAttempts,
});

export const webhookSchema = webhookFields.extend({
  isActive: z.boolean().default(true),
  retryAttempts: webhookRetryAttempts.default(3),
});

export const updateWebhookSchema = webhookFields.partial();

export type WebhookInput = z.infer<typeof webhookSchema>;

/**
 * Asset Reservation validation schemas
 */
export const assetReservationSchema = z.object({
  assetId: z.string().uuid(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  notes: z.string().optional().nullable(),
});

export const updateReservationSchema = z.object({
  status: z
    .enum(["pending", "approved", "rejected", "cancelled", "completed"])
    .optional(),
  notes: z.string().optional().nullable(),
});

export type AssetReservationInput = z.infer<typeof assetReservationSchema>;

/**
 * Stock Alert validation schemas
 */
const stockThreshold = z.number().int().min(0);

/** Default-free base for the update schema, see `webhookFields`. */
const stockAlertFields = z.object({
  consumableId: z.string().uuid(),
  minThreshold: stockThreshold,
  criticalThreshold: stockThreshold,
  emailNotify: z.boolean(),
  webhookNotify: z.boolean(),
});

export const stockAlertSchema = stockAlertFields.extend({
  minThreshold: stockThreshold.default(10),
  criticalThreshold: stockThreshold.default(5),
  emailNotify: z.boolean().default(true),
  webhookNotify: z.boolean().default(false),
});

export const updateStockAlertSchema = stockAlertFields
  .partial()
  .omit({ consumableId: true });

export type StockAlertInput = z.infer<typeof stockAlertSchema>;

/**
 * Import Job validation
 */
export const importJobSchema = z.object({
  entityType: z.enum([
    "asset",
    "accessory",
    "consumable",
    "licence",
    "user",
    "location",
  ]),
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive(),
});

export type ImportJobInput = z.infer<typeof importJobSchema>;
