import { z } from "zod";

/**
 * Authentication schemas
 */
export const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(50, "Username too long"),
  password: z.string().min(1, "Password is required"),
});

/**
 * User schemas
 */
export const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email().nullable().optional(),
  firstname: z.string().min(1).max(100),
  lastname: z.string().min(1).max(100),
  password: z.string().min(8, "Password must be at least 8 characters").max(100),
  isadmin: z.boolean().default(false),
  canrequest: z.boolean().default(false),
  lan: z.string().max(50).nullable().optional(),
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

/**
 * Asset schemas
 */
export const createAssetSchema = z.object({
  assetname: z.string().min(1).max(255),
  assettag: z.string().min(1).max(50),
  serialnumber: z.string().min(1).max(100),
  modelid: z.string().uuid().nullable().optional(),
  specs: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  purchaseprice: z.number().positive().nullable().optional(),
  purchasedate: z.string().datetime().nullable().optional(),
  mobile: z.boolean().nullable().optional(),
  requestable: z.boolean().nullable().optional(),
  assetcategorytypeid: z.string().uuid().nullable().optional(),
  statustypeid: z.string().uuid().nullable().optional(),
  supplierid: z.string().uuid().nullable().optional(),
  locationid: z.string().uuid().nullable().optional(),
  manufacturerid: z.string().uuid().nullable().optional(),
});

export const updateAssetSchema = createAssetSchema.partial();

/**
 * Accessory schemas
 */
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

/**
 * License schemas
 */
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

/**
 * Manufacturer schemas
 */
export const createManufacturerSchema = z.object({
  manufacturername: z.string().min(1).max(255),
});

export const updateManufacturerSchema = createManufacturerSchema.partial();

/**
 * Supplier schemas
 */
export const createSupplierSchema = z.object({
  suppliername: z.string().min(1).max(255),
  lastname: z.string().max(255).nullable().optional(),
  firstname: z.string().max(255).nullable().optional(),
  salutation: z.string().max(50).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phonenumber: z.string().max(50).nullable().optional(),
});

export const updateSupplierSchema = createSupplierSchema.partial();

/**
 * Location schemas
 */
export const createLocationSchema = z.object({
  locationname: z.string().min(1).max(255),
  street: z.string().max(255).nullable().optional(),
  housenumber: z.string().max(50).nullable().optional(),
  city: z.string().max(255).nullable().optional(),
  country: z.string().max(255).nullable().optional(),
});

export const updateLocationSchema = createLocationSchema.partial();

/**
 * Category Type schemas
 */
export const createAssetCategoryTypeSchema = z.object({
  assetcategorytypename: z.string().min(1).max(255),
});

export const updateAssetCategoryTypeSchema = createAssetCategoryTypeSchema.partial();

export const createAccessoryCategoryTypeSchema = z.object({
  accessoriecategorytypename: z.string().min(1).max(255),
});

export const updateAccessoryCategoryTypeSchema = createAccessoryCategoryTypeSchema.partial();

export const createConsumableCategoryTypeSchema = z.object({
  consumablecategorytypename: z.string().min(1).max(255),
});

export const updateConsumableCategoryTypeSchema = createConsumableCategoryTypeSchema.partial();

export const createLicenceCategoryTypeSchema = z.object({
  licencecategorytypename: z.string().min(1).max(255),
});

export const updateLicenceCategoryTypeSchema = createLicenceCategoryTypeSchema.partial();

/**
 * Model schemas
 */
export const createModelSchema = z.object({
  modelname: z.string().min(1).max(255),
  modelnumber: z.string().max(255).nullable().optional(),
});

export const updateModelSchema = createModelSchema.partial();

/**
 * Status Type schemas
 */
export const createStatusTypeSchema = z.object({
  statustypename: z.string().min(1).max(255),
});

export const updateStatusTypeSchema = createStatusTypeSchema.partial();

/**
 * Generic UUID validation
 */
export const uuidSchema = z.string().uuid();

/**
 * Pagination schemas
 */
export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});
