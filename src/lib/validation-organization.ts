import { z } from 'zod';

/**
 * Organization validation schemas
 */
export const organizationSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  slug: z.string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  description: z.string().optional().nullable(),
  settings: z.record(z.string(), z.unknown()).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const updateOrganizationSchema = organizationSchema.partial();

export type OrganizationInput = z.infer<typeof organizationSchema>;

/**
 * Department validation schemas
 */
export const departmentSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().optional().nullable(),
  organizationId: z.string().uuid(),
  parentId: z.string().uuid().optional().nullable(),
});

export const updateDepartmentSchema = departmentSchema.partial().omit({ organizationId: true });

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

export const updateRoleSchema = roleSchema.partial();

export type RoleInput = z.infer<typeof roleSchema>;

/**
 * Webhook validation schemas
 */
export const webhookSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  url: z.string().url("Must be a valid URL").max(500),
  secret: z.string().max(255).optional().nullable(),
  events: z.array(z.string()).min(1, "At least one event is required"),
  isActive: z.boolean().default(true),
  retryAttempts: z.number().int().min(0).max(5).default(3),
});

export const updateWebhookSchema = webhookSchema.partial();

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
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled', 'completed']).optional(),
  notes: z.string().optional().nullable(),
});

export type AssetReservationInput = z.infer<typeof assetReservationSchema>;

/**
 * Stock Alert validation schemas
 */
export const stockAlertSchema = z.object({
  consumableId: z.string().uuid(),
  minThreshold: z.number().int().min(0).default(10),
  criticalThreshold: z.number().int().min(0).default(5),
  emailNotify: z.boolean().default(true),
  webhookNotify: z.boolean().default(false),
});

export const updateStockAlertSchema = stockAlertSchema.partial().omit({ consumableId: true });

export type StockAlertInput = z.infer<typeof stockAlertSchema>;

/**
 * Import Job validation
 */
export const importJobSchema = z.object({
  entityType: z.enum(['asset', 'accessory', 'consumable', 'licence', 'user', 'location']),
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive(),
});

export type ImportJobInput = z.infer<typeof importJobSchema>;
