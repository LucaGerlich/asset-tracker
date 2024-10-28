import prisma from "./prisma";

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

export async function getAccessories() {
  const accessories = await prisma.accessories.findMany({});
  return accessories;
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

export async function updateUserAsset(user, asset) {
  const res = await prisma.userAssets.update({
    where: { assetid: user },
    data: { userid: asset },
  });
  return res;
}

export async function getUserById(id) {
  const user = await prisma.user.findUnique({
    where: {
      id: parseInt(id),
    },
  });
  return user;
}

export async function updateUser(id, data) {
  const user = await prisma.user.update({
    where: {
      id: parseInt(id),
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
  const res = await request.json();
  const { title, content } = res;
  const result = await prisma.user.create({
    user: {},
  });

  return NextResponse.json({ result });
}
