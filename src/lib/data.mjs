import prisma from "./prisma.js";

export async function getUsers() {
  const users = await prisma.user.findMany({});
  return users;
}

export async function getAssets() {
  const assets = await prisma.asset.findMany({});
  return assets;
}

export async function getAssetById(id) {
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
  const location = await prisma.location.findMany({});
  return location;
}

export async function getLocationById(id) {
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
  const status = await prisma.statusType.findMany({});
  return status;
}

export async function getManufacturers() {
  const manufacturer = await prisma.manufacturer.findMany({});
  return manufacturer;
}

export async function getManufacturerById(id) {
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

export async function getAccessoryById(id) {
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
  const suppliers = await prisma.supplier.findMany({});
  return suppliers;
}

export async function getSupplierById(id) {
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

export async function getConsumableById(id) {
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

export async function getLicenceById(id) {
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
  const model = await prisma.model.findMany({});
  return model;
}

export async function getCategories() {
  const categories = await prisma.assetCategoryType.findMany({});
  return categories;
}

export async function getUserAssets() {
  const accessories = await prisma.userAssets.findMany({});
  return accessories;
}

export async function getUserAccessoires() {
  const res = await prisma.userAccessoires.findMany({});
  return res;
}

export async function updateUserAsset(user, asset) {
  // DEPRECATED SIGNATURE: update by userAssetsId and new userId
  const res = await prisma.userAssets.update({
    where: { userassetsid: user },
    data: { userid: asset, change_date: new Date() },
  });
  return res;
}

export async function getUserById(id) {
  const user = await prisma.user.findUnique({
    where: {
      userid: id,
    },
  });
  return user;
}

export async function updateUser(id, data) {
  const user = await prisma.user.update({
    where: {
      userid: id,
    },
    data,
  });
  return user;
}

export async function deleteUser(id) {
  const user = await prisma.user.delete({
    where: { userid: id },
  });
}

export async function postData(request) {
  // Not used; kept for backward compatibility. Prefer API routes.
  throw new Error("postData is deprecated. Use API routes instead.");
}
