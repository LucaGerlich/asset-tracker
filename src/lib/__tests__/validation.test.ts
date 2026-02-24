import { describe, it, expect } from "vitest";
import {
  createAssetSchema,
  updateAssetSchema,
  createUserSchema,
  updateUserSchema,
  createAccessorySchema,
  createLicenseSchema,
  createConsumableSchema,
  createManufacturerSchema,
  createSupplierSchema,
  createLocationSchema,
  createStatusTypeSchema,
  createModelSchema,
  loginSchema,
  uuidSchema,
  paginationSchema,
} from "../validation";

const uuid = "550e8400-e29b-41d4-a716-446655440000";

describe("createAssetSchema", () => {
  const validAsset = {
    assetname: "MacBook Pro",
    assettag: "ASSET-001",
    serialnumber: "SN-ABC-123",
  };

  it("accepts valid asset data with required fields", () => {
    const result = createAssetSchema.safeParse(validAsset);
    expect(result.success).toBe(true);
  });

  it("rejects missing assetname", () => {
    const { assetname, ...rest } = validAsset;
    const result = createAssetSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects empty assetname", () => {
    const result = createAssetSchema.safeParse({
      ...validAsset,
      assetname: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing serialnumber", () => {
    const { serialnumber, ...rest } = validAsset;
    const result = createAssetSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects assetname exceeding max length", () => {
    const result = createAssetSchema.safeParse({
      ...validAsset,
      assetname: "x".repeat(256),
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional fields (purchaseprice, notes, modelid)", () => {
    const result = createAssetSchema.safeParse({
      ...validAsset,
      purchaseprice: 999.99,
      notes: "Some notes",
      modelid: uuid,
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative purchaseprice", () => {
    const result = createAssetSchema.safeParse({
      ...validAsset,
      purchaseprice: -100,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid UUID for modelid", () => {
    const result = createAssetSchema.safeParse({
      ...validAsset,
      modelid: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateAssetSchema", () => {
  it("accepts partial asset data", () => {
    const result = updateAssetSchema.safeParse({ assetname: "Updated" });
    expect(result.success).toBe(true);
  });

  it("accepts empty object", () => {
    const result = updateAssetSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe("createUserSchema", () => {
  const validUser = {
    username: "testuser",
    password: "SecurePass123!",
    email: "test@example.com",
    firstname: "Test",
    lastname: "User",
  };

  it("accepts valid user data", () => {
    const result = createUserSchema.safeParse(validUser);
    expect(result.success).toBe(true);
  });

  it("rejects invalid email format", () => {
    const result = createUserSchema.safeParse({
      ...validUser,
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejects username too short (< 3 chars)", () => {
    const result = createUserSchema.safeParse({
      ...validUser,
      username: "ab",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password too short (< 8 chars)", () => {
    const result = createUserSchema.safeParse({
      ...validUser,
      password: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing firstname", () => {
    const { firstname, ...rest } = validUser;
    const result = createUserSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing lastname", () => {
    const { lastname, ...rest } = validUser;
    const result = createUserSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("accepts optional fields with defaults", () => {
    const result = createUserSchema.safeParse(validUser);
    if (result.success) {
      expect(result.data.isadmin).toBe(false);
      expect(result.data.canrequest).toBe(false);
    }
  });

  it("allows null email", () => {
    const result = createUserSchema.safeParse({
      ...validUser,
      email: null,
    });
    expect(result.success).toBe(true);
  });
});

describe("updateUserSchema", () => {
  it("accepts partial user data", () => {
    const result = updateUserSchema.safeParse({ firstname: "Updated" });
    expect(result.success).toBe(true);
  });
});

describe("createAccessorySchema", () => {
  const validAccessory = {
    accessoriename: "USB Keyboard",
    accessorietag: "ACC-001",
    manufacturerid: uuid,
    statustypeid: uuid,
    accessoriecategorytypeid: uuid,
    locationid: uuid,
    supplierid: uuid,
    modelid: uuid,
  };

  it("accepts valid accessory data", () => {
    const result = createAccessorySchema.safeParse(validAccessory);
    expect(result.success).toBe(true);
  });

  it("rejects missing accessoriename", () => {
    const { accessoriename, ...rest } = validAccessory;
    const result = createAccessorySchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing required UUID fields", () => {
    const result = createAccessorySchema.safeParse({
      accessoriename: "Keyboard",
      accessorietag: "ACC-001",
    });
    expect(result.success).toBe(false);
  });
});

describe("createLicenseSchema", () => {
  const validLicense = {
    licencecategorytypeid: uuid,
    manufacturerid: uuid,
    supplierid: uuid,
  };

  it("accepts valid license data with required fields", () => {
    const result = createLicenseSchema.safeParse(validLicense);
    expect(result.success).toBe(true);
  });

  it("rejects missing required categorytype", () => {
    const { licencecategorytypeid, ...rest } = validLicense;
    const result = createLicenseSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("accepts optional licencekey", () => {
    const result = createLicenseSchema.safeParse({
      ...validLicense,
      licencekey: "ABC-DEF-GHI",
    });
    expect(result.success).toBe(true);
  });
});

describe("createConsumableSchema", () => {
  const validConsumable = {
    consumablename: "Printer Toner",
    consumablecategorytypeid: uuid,
    manufacturerid: uuid,
    supplierid: uuid,
  };

  it("accepts valid consumable data", () => {
    const result = createConsumableSchema.safeParse(validConsumable);
    expect(result.success).toBe(true);
  });

  it("rejects missing consumablename", () => {
    const { consumablename, ...rest } = validConsumable;
    const result = createConsumableSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("accepts optional quantity fields", () => {
    const result = createConsumableSchema.safeParse({
      ...validConsumable,
      quantity: 100,
      minQuantity: 10,
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative quantity", () => {
    const result = createConsumableSchema.safeParse({
      ...validConsumable,
      quantity: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe("createManufacturerSchema", () => {
  it("accepts valid manufacturer", () => {
    const result = createManufacturerSchema.safeParse({
      manufacturername: "Apple",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createManufacturerSchema.safeParse({
      manufacturername: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("createSupplierSchema", () => {
  it("accepts valid supplier with required name", () => {
    const result = createSupplierSchema.safeParse({
      suppliername: "Tech Supply Co",
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional contact fields", () => {
    const result = createSupplierSchema.safeParse({
      suppliername: "Tech Supply Co",
      email: "info@techsupply.com",
      phonenumber: "+1234567890",
      firstname: "John",
      lastname: "Doe",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email format", () => {
    const result = createSupplierSchema.safeParse({
      suppliername: "Tech Supply Co",
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });
});

describe("createLocationSchema", () => {
  it("accepts valid location with name only", () => {
    const result = createLocationSchema.safeParse({
      locationname: "Main Office",
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional address fields", () => {
    const result = createLocationSchema.safeParse({
      locationname: "Main Office",
      street: "123 Main St",
      city: "Berlin",
      country: "Germany",
    });
    expect(result.success).toBe(true);
  });
});

describe("createStatusTypeSchema", () => {
  it("accepts valid status type", () => {
    const result = createStatusTypeSchema.safeParse({
      statustypename: "Active",
    });
    expect(result.success).toBe(true);
  });
});

describe("createModelSchema", () => {
  it("accepts valid model with name", () => {
    const result = createModelSchema.safeParse({ modelname: "MacBook Pro 16" });
    expect(result.success).toBe(true);
  });

  it("accepts optional modelnumber", () => {
    const result = createModelSchema.safeParse({
      modelname: "MacBook Pro 16",
      modelnumber: "A2485",
    });
    expect(result.success).toBe(true);
  });
});

describe("loginSchema", () => {
  it("accepts valid login credentials", () => {
    const result = loginSchema.safeParse({
      username: "testuser",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects username too short", () => {
    const result = loginSchema.safeParse({ username: "ab", password: "pass" });
    expect(result.success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({
      username: "testuser",
      password: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("uuidSchema", () => {
  it("accepts a valid UUID", () => {
    expect(uuidSchema.safeParse(uuid).success).toBe(true);
  });

  it("rejects an invalid UUID", () => {
    expect(uuidSchema.safeParse("not-a-uuid").success).toBe(false);
  });
});

describe("paginationSchema", () => {
  it("applies defaults", () => {
    const result = paginationSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    }
  });

  it("rejects page less than 1", () => {
    const result = paginationSchema.safeParse({ page: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects limit over 100", () => {
    const result = paginationSchema.safeParse({ limit: 101 });
    expect(result.success).toBe(false);
  });
});
