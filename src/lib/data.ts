import prisma from "./prisma";
import { cached } from "./cache";
import { getOrganizationContext } from "./organization-context";

/**
 * Build an org-scoped where clause for data queries.
 * Strict scoping — only returns records matching the user's org.
 */
async function orgWhere(): Promise<Record<string, unknown>> {
  try {
    const ctx = await getOrganizationContext();
    const orgId = ctx?.organization?.id;
    if (!orgId) return {};
    return { organizationId: orgId };
  } catch {
    // Outside of a request context (e.g., scripts) — no scoping
    return {};
  }
}

export async function getAssetCount() {
  const where = await orgWhere();
  const key = `asset_count:${JSON.stringify(where)}`;
  return cached(key, () => prisma.asset.count({ where }), 2 * 60 * 1000);
}

export async function getUserCount() {
  const where = await orgWhere();
  const key = `user_count:${JSON.stringify(where)}`;
  return cached(key, () => prisma.user.count({ where }), 2 * 60 * 1000);
}

export async function getAccessoryCount() {
  const where = await orgWhere();
  const key = `accessory_count:${JSON.stringify(where)}`;
  return cached(key, () => prisma.accessories.count({ where }), 2 * 60 * 1000);
}

export async function getAssetStatusDistribution() {
  const where = await orgWhere();
  const key = `asset_status_distribution:${JSON.stringify(where)}`;
  return cached(
    key,
    async () => {
      const assets = await prisma.asset.groupBy({
        by: ["statustypeid"],
        where,
        _count: { assetid: true },
      });
      return assets.map((a) => ({
        statustypeid: a.statustypeid,
        count: a._count.assetid,
      }));
    },
    2 * 60 * 1000,
  );
}

export async function getUsers() {
  return cached(
    "users",
    () =>
      prisma.user.findMany({
        select: {
          userid: true,
          username: true,
          firstname: true,
          lastname: true,
          email: true,
          isadmin: true,
          canrequest: true,
          lan: true,
          creation_date: true,
          change_date: true,
          organizationId: true,
        },
      }),
    2 * 60 * 1000,
  );
}

export async function getAssets() {
  const where = await orgWhere();
  const key = `assets_all:${JSON.stringify(where)}`;
  return cached(key, () => prisma.asset.findMany({ where }), 2 * 60 * 1000);
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
  return cached(
    "locations",
    () =>
      prisma.location.findMany({
        include: {
          parent: { select: { locationid: true, locationname: true } },
          children: { select: { locationid: true, locationname: true } },
        },
      }),
    2 * 60 * 1000,
  );
}

export async function getLocationById(id: string) {
  if (!id) {
    throw new Error("Invalid ID parameter");
  }

  const location = await prisma.location.findUnique({
    where: {
      locationid: id,
    },
    include: {
      parent: { select: { locationid: true, locationname: true } },
      children: { select: { locationid: true, locationname: true } },
    },
  });
  if (!location) {
    throw new Error(`Location with ID ${id} not found`);
  }
  return location;
}

export async function getStatus() {
  return cached(
    "status_types",
    () => prisma.statusType.findMany({}),
    2 * 60 * 1000,
  );
}

export async function getManufacturers() {
  return cached(
    "manufacturers",
    () => prisma.manufacturer.findMany({}),
    2 * 60 * 1000,
  );
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
  const where = await orgWhere();
  const key = `accessories_all:${JSON.stringify(where)}`;
  return cached(
    key,
    () => prisma.accessories.findMany({ where }),
    2 * 60 * 1000,
  );
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
  return cached("suppliers", () => prisma.supplier.findMany({}), 2 * 60 * 1000);
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
  const where = await orgWhere();
  const key = `consumables_all:${JSON.stringify(where)}`;
  return cached(
    key,
    () => prisma.consumable.findMany({ where }),
    2 * 60 * 1000,
  );
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
  return cached(
    "consumable_categories",
    () => prisma.consumableCategoryType.findMany({}),
    2 * 60 * 1000,
  );
}

export async function getAccessoryCategories() {
  return cached(
    "accessory_categories",
    () => prisma.accessorieCategoryType.findMany({}),
    2 * 60 * 1000,
  );
}

export async function getLicences() {
  const where = await orgWhere();
  const key = `licences_all:${JSON.stringify(where)}`;
  return cached(key, () => prisma.licence.findMany({ where }), 2 * 60 * 1000);
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
  return cached(
    "licence_categories",
    () => prisma.licenceCategoryType.findMany({}),
    2 * 60 * 1000,
  );
}

export async function getModel() {
  return cached("models", () => prisma.model.findMany({}), 2 * 60 * 1000);
}

export async function getCategories() {
  return cached(
    "categories",
    () => prisma.assetCategoryType.findMany({}),
    2 * 60 * 1000,
  );
}

export async function getUserAssets() {
  return cached(
    "user_assets_all",
    () =>
      prisma.userAssets.findMany({
        select: {
          userassetsid: true,
          userid: true,
          assetid: true,
          creation_date: true,
          change_date: true,
        },
      }),
    2 * 60 * 1000,
  );
}

export async function getUserAccessoires() {
  return cached(
    "user_accessoires_all",
    () =>
      prisma.userAccessoires.findMany({
        select: {
          useraccessoiresid: true,
          userid: true,
          accessorieid: true,
          creation_date: true,
          change_date: true,
        },
      }),
    2 * 60 * 1000,
  );
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

// Component data functions
export async function getComponents() {
  const where = await orgWhere();
  const key = `components_all:${JSON.stringify(where)}`;
  return cached(
    key,
    () =>
      prisma.component.findMany({
        where,
        include: {
          category: true,
          manufacturer: true,
          supplier: true,
          location: true,
        },
        orderBy: { name: "asc" },
      }),
    2 * 60 * 1000,
  );
}

export async function getComponentById(id: string) {
  if (!id) throw new Error("Invalid ID parameter");
  const component = await prisma.component.findUnique({
    where: { id },
    include: {
      category: true,
      manufacturer: true,
      supplier: true,
      location: true,
      checkouts: {
        orderBy: { checkedOutAt: "desc" },
        include: {
          asset: { select: { assetid: true, assetname: true, assettag: true } },
          checkedOutByUser: {
            select: { userid: true, firstname: true, lastname: true },
          },
        },
      },
    },
  });
  if (!component) throw new Error(`Component with ID ${id} not found`);
  return component;
}

export async function getComponentCategories() {
  return cached(
    "component_categories",
    () => prisma.componentCategory.findMany({ orderBy: { name: "asc" } }),
    2 * 60 * 1000,
  );
}

// EULA Templates
export async function getEulaTemplates() {
  return cached(
    "eula_templates",
    () =>
      prisma.eulaTemplate.findMany({
        orderBy: { createdAt: "desc" },
      }),
    2 * 60 * 1000,
  );
}

export async function getEulaTemplateById(id: string) {
  if (!id) throw new Error("Invalid ID parameter");
  const template = await prisma.eulaTemplate.findUnique({ where: { id } });
  if (!template) throw new Error(`EULA template with ID ${id} not found`);
  return template;
}

// Kits
export async function getKits() {
  const where = await orgWhere();
  const key = `kits_all:${JSON.stringify(where)}`;
  return cached(
    key,
    () =>
      prisma.kit.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: "desc" },
      }),
    2 * 60 * 1000,
  );
}

export async function getKitById(id: string) {
  if (!id) throw new Error("Invalid ID parameter");
  const kit = await prisma.kit.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!kit) throw new Error(`Kit with ID ${id} not found`);
  return kit;
}

// Audit Campaigns
export async function getAuditCampaigns() {
  const where = await orgWhere();
  const key = `audit_campaigns_all:${JSON.stringify(where)}`;
  return cached(
    key,
    () =>
      prisma.auditCampaign.findMany({
        where,
        include: {
          creator: {
            select: { userid: true, firstname: true, lastname: true },
          },
          _count: { select: { entries: true, auditors: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    2 * 60 * 1000,
  );
}

export async function getAuditCampaignById(id: string) {
  if (!id) throw new Error("Invalid ID parameter");
  const campaign = await prisma.auditCampaign.findUnique({
    where: { id },
    include: {
      creator: { select: { userid: true, firstname: true, lastname: true } },
      auditors: {
        include: {
          user: { select: { userid: true, firstname: true, lastname: true } },
        },
      },
      entries: {
        include: {
          asset: { select: { assetid: true, assetname: true, assettag: true } },
          auditor: {
            select: { userid: true, firstname: true, lastname: true },
          },
          location: { select: { locationid: true, locationname: true } },
        },
      },
    },
  });
  if (!campaign) throw new Error(`Audit campaign with ID ${id} not found`);
  return campaign;
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
