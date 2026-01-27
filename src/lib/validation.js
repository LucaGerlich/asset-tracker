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
  email: z.string().email().optional().nullable(),
  firstname: z.string().min(1).max(100),
  lastname: z.string().min(1).max(100),
  password: z.string().min(8, "Password must be at least 8 characters").max(100),
  isadmin: z.boolean().default(false),
  canrequest: z.boolean().default(false),
  lan: z.string().max(50).optional().nullable(),
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
  modelid: z.string().uuid().optional().nullable(),
  specs: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  purchaseprice: z.number().positive().optional().nullable(),
  purchasedate: z.string().datetime().optional().nullable(),
  mobile: z.boolean().optional().nullable(),
  requestable: z.boolean().optional().nullable(),
  assetcategorytypeid: z.string().uuid().optional().nullable(),
  statustypeid: z.string().uuid().optional().nullable(),
  supplierid: z.string().uuid().optional().nullable(),
  locationid: z.string().uuid().optional().nullable(),
  manufacturerid: z.string().uuid().optional().nullable(),
});

export const updateAssetSchema = createAssetSchema.partial();

/**
 * Accessory schemas
 */
export const createAccessorySchema = z.object({
  accessoriename: z.string().min(1).max(255),
  accessorietag: z.string().min(1).max(50),
  purchaseprice: z.number().positive().optional().nullable(),
  purchasedate: z.string().datetime().optional().nullable(),
  requestable: z.boolean().optional().nullable(),
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
  licencekey: z.string().max(255).optional().nullable(),
  licenceduserid: z.string().uuid().optional().nullable(),
  licensedtoemail: z.string().email().optional().nullable(),
  purchaseprice: z.number().positive().optional().nullable(),
  purchasedate: z.string().datetime().optional().nullable(),
  expirationdate: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
  requestable: z.boolean().optional().nullable(),
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
  lastname: z.string().max(255).optional().nullable(),
  firstname: z.string().max(255).optional().nullable(),
  salutation: z.string().max(50).optional().nullable(),
  email: z.string().email().optional().nullable(),
  phonenumber: z.string().max(50).optional().nullable(),
});

export const updateSupplierSchema = createSupplierSchema.partial();

/**
 * Location schemas
 */
export const createLocationSchema = z.object({
  locationname: z.string().min(1).max(255),
  street: z.string().max(255).optional().nullable(),
  housenumber: z.string().max(50).optional().nullable(),
  city: z.string().max(255).optional().nullable(),
  country: z.string().max(255).optional().nullable(),
});

export const updateLocationSchema = createLocationSchema.partial();

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
