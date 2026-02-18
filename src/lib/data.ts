import prisma from "./prisma";
import { cached } from "./cache";

export async function getUsers() {
  return cached("users", () => prisma.user.findMany({}), 2 * 60 * 1000);
}

export async function getAssets() {
  const assets = await prisma.asset.findMany({});
  return assets;
}

export async function getAssetById(id: string) {
  // Validate the id parameter
  if (!id) {
    throw new Error("Invalid ID parameter");
  }

  const asset = await prisma.asset.findUnique({
    where: {
      assetid: id, // Ensure id is converted to an integer if required
    },
  });

  if (!asset) {
    throw new Error(`Asset with ID ${id} not found`);
  }

  return asset;
}

export async function getLocation() {
  return cached("locations", () => prisma.location.findMany({}));
}

export async function getLocationById(id: string) {
  if (!id) {
    throw new Error("Invalid ID parameter");
  }

  const location = await prisma.location.findUnique({
    where: {
      locationid: id,
    },
  });
  if (!location) {
    throw new Error(`Asset with ID ${id} not found`);
  }
  return location;
}

export async function getStatus() {
  return cached("status_types", () => prisma.statusType.findMany({}));
}

export async function getManufacturers() {
  return cached("manufacturers", () => prisma.manufacturer.findMany({}));
}

export async function getManufacturerById(id: string) {
  if (!id) {
    throw new Error("Invalid ID parameter");
  }

  const manufacturer = await prisma.manufacturer.findUnique({
    where: { manufacturerid: id },
  });

  if (!manufacturer) {
    throw new Error(`Manufacturer with ID ${id} not found`);
  }

  return manufacturer;
}

export async function getAccessories() {
  const accessories = await prisma.accessories.findMany({});
  return accessories;
}

export async function getAccessoryById(id: string) {
  if (!id) {
    throw new Error("Invalid ID parameter");
  }

  const accessory = await prisma.accessories.findUnique({
    where: { accessorieid: id },
  });

  if (!accessory) {
    throw new Error(`Accessory with ID ${id} not found`);
  }

  return accessory;
}

export async function getSuppliers() {
  return cached("suppliers", () => prisma.supplier.findMany({}));
}

export async function getSupplierById(id: string) {
  if (!id) {
    throw new Error("Invalid ID parameter");
  }

  const supplier = await prisma.supplier.findUnique({
    where: { supplierid: id },
  });

  if (!supplier) {
    throw new Error(`Supplier with ID ${id} not found`);
  }

  return supplier;
}

export async function getConsumables() {
  const consumables = await prisma.consumable.findMany({});
  return consumables;
}

export async function getConsumableById(id: string) {
  if (!id) {
    throw new Error("Invalid ID parameter");
  }

  const consumable = await prisma.consumable.findUnique({
    where: { consumableid: id },
  });

  if (!consumable) {
    throw new Error(`Consumable with ID ${id} not found`);
  }

  return consumable;
}

export async function getConsumableCategories() {
  const cats = await prisma.consumableCategoryType.findMany({});
  return cats;
}

export async function getAccessoryCategories() {
  const cats = await prisma.accessorieCategoryType.findMany({});
  return cats;
}

export async function getLicences() {
  const licences = await prisma.licence.findMany({});
  return licences;
}

export async function getLicenceById(id: string) {
  if (!id) {
    throw new Error("Invalid ID parameter");
  }

  const licence = await prisma.licence.findUnique({
    where: { licenceid: id },
  });

  if (!licence) {
    throw new Error(`Licence with ID ${id} not found`);
  }

  return licence;
}

export async function getLicenceCategories() {
  const cats = await prisma.licenceCategoryType.findMany({});
  return cats;
}

export async function getModel() {
  return cached("models", () => prisma.model.findMany({}));
}

export async function getCategories() {
  return cached("categories", () => prisma.assetCategoryType.findMany({}));
}

export async function getUserAssets() {
  const accessories = await prisma.userAssets.findMany({});
  return accessories;
}

export async function getUserAccessoires() {
  const res = await prisma.userAccessoires.findMany({});
  return res;
}

export async function updateUserAsset(user: string, asset: string) {
  // DEPRECATED SIGNATURE: update by userAssetsId and new userId
  const res = await prisma.userAssets.update({
    where: { userassetsid: user },
    data: { userid: asset, change_date: new Date() },
  });
  return res;
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: {
      userid: id,
    },
  });
  return user;
}

export async function updateUser(id: string, data: Record<string, unknown>) {
  const user = await prisma.user.update({
    where: {
      userid: id,
    },
    data,
  });
  return user;
}

export async function deleteUser(id: string) {
  await prisma.user.delete({
    where: { userid: id },
  });
}

export async function postData(): Promise<never> {
  // Not used; kept for backward compatibility. Prefer API routes.
  throw new Error("postData is deprecated. Use API routes instead.");
}

// Category Type data functions
export async function getAssetCategoryById(id: string) {
  if (!id) {
    throw new Error("Invalid ID parameter");
  }

  const category = await prisma.assetCategoryType.findUnique({
    where: { assetcategorytypeid: id },
  });

  if (!category) {
    throw new Error(`Asset category with ID ${id} not found`);
  }

  return category;
}

export async function getAccessoryCategoryById(id: string) {
  if (!id) {
    throw new Error("Invalid ID parameter");
  }

  const category = await prisma.accessorieCategoryType.findUnique({
    where: { accessoriecategorytypeid: id },
  });

  if (!category) {
    throw new Error(`Accessory category with ID ${id} not found`);
  }

  return category;
}

export async function getConsumableCategoryById(id: string) {
  if (!id) {
    throw new Error("Invalid ID parameter");
  }

  const category = await prisma.consumableCategoryType.findUnique({
    where: { consumablecategorytypeid: id },
  });

  if (!category) {
    throw new Error(`Consumable category with ID ${id} not found`);
  }

  return category;
}

export async function getLicenceCategoryById(id: string) {
  if (!id) {
    throw new Error("Invalid ID parameter");
  }

  const category = await prisma.licenceCategoryType.findUnique({
    where: { licencecategorytypeid: id },
  });

  if (!category) {
    throw new Error(`Licence category with ID ${id} not found`);
  }

  return category;
}

export async function getModelById(id: string) {
  if (!id) {
    throw new Error("Invalid ID parameter");
  }

  const model = await prisma.model.findUnique({
    where: { modelid: id },
  });

  if (!model) {
    throw new Error(`Model with ID ${id} not found`);
  }

  return model;
}

export async function getStatusById(id: string) {
  if (!id) {
    throw new Error("Invalid ID parameter");
  }

  const status = await prisma.statusType.findUnique({
    where: { statustypeid: id },
  });

  if (!status) {
    throw new Error(`Status with ID ${id} not found`);
  }

  return status;
}
