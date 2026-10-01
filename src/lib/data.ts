import prisma from "./prisma";
import { cached } from "./cache";
import { getOrganizationContext } from "./organization-context";

/**
 * Strict org-scoped where clause — throws when org context is missing.
 * Use this for entity data that MUST be scoped to the user's organization
 * (assets, accessories, consumables, licences, users, components, kits,
 * audit campaigns, etc.).
 */
async function strictOrgWhere(): Promise<{ organizationId: string }> {
  const ctx = await getOrganizationContext();
  const orgId = ctx?.organization?.id;
  if (!orgId) {
    throw new Error("Organization context required");
  }
  return { organizationId: orgId };
}

export async function getAssetCount() {
  const where = await strictOrgWhere();
  const key = `asset_count:${JSON.stringify(where)}`;
  return cached(key, () => prisma.asset.count({ where }), 2 * 60 * 1000);
}

export async function getUserCount() {
  const where = await strictOrgWhere();
  const key = `user_count:${JSON.stringify(where)}`;
  return cached(key, () => prisma.user.count({ where }), 2 * 60 * 1000);
}

export async function getAccessoryCount() {
  const where = await strictOrgWhere();
  const key = `accessory_count:${JSON.stringify(where)}`;
  return cached(key, () => prisma.accessories.count({ where }), 2 * 60 * 1000);
}

export async function getAccessoryStatusDistribution() {
  const where = await strictOrgWhere();
  const key = `accessory_status_distribution:${JSON.stringify(where)}`;
  return cached(
    key,
    async () => {
      const items = await prisma.accessories.groupBy({
        by: ["statustypeid"],
        where,
        _count: { accessorieid: true },
      });
      return items.map((a) => ({
        statustypeid: a.statustypeid,
        count: a._count.accessorieid,
      }));
    },
    2 * 60 * 1000,
  );
}

export async function getAssetStatusDistribution() {
  const where = await strictOrgWhere();
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
  const where = await strictOrgWhere();
  const key = `users:${JSON.stringify(where)}`;
  return cached(
    key,
    () =>
      prisma.user.findMany({
        where,
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
  const where = await strictOrgWhere();
  const key = `assets_all:${JSON.stringify(where)}`;
  return cached(key, () => prisma.asset.findMany({ where }), 2 * 60 * 1000);
}

export async function getAssetById(id: string) {
  if (!id) {
    throw new Error("Invalid ID parameter");
  }

  const asset = await prisma.asset.findFirst({
    where: {
      assetid: id,
      ...(await strictOrgWhere()),
    },
  });

  if (!asset) {
    throw new Error(`Asset with ID ${id} not found`);
  }

  return asset;
}

export async function getLocation() {
  const where = await strictOrgWhere();
  const key = `locations:${JSON.stringify(where)}`;
  return cached(
    key,
    () =>
      prisma.location.findMany({
        where,
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

  const location = await prisma.location.findFirst({
    where: {
      locationid: id,
      ...(await strictOrgWhere()),
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
  const where = await strictOrgWhere();
  const key = `status_types:${JSON.stringify(where)}`;
  return cached(
    key,
    () => prisma.statusType.findMany({ where }),
    2 * 60 * 1000,
  );
}

export async function getManufacturers() {
  const where = await strictOrgWhere();
  const key = `manufacturers:${JSON.stringify(where)}`;
  return cached(
    key,
    () => prisma.manufacturer.findMany({ where }),
    2 * 60 * 1000,
  );
}

export async function getManufacturerById(id: string) {
  if (!id) {
    throw new Error("Invalid ID parameter");
  }

  const manufacturer = await prisma.manufacturer.findFirst({
    where: { manufacturerid: id, ...(await strictOrgWhere()) },
  });

  if (!manufacturer) {
    throw new Error(`Manufacturer with ID ${id} not found`);
  }

  return manufacturer;
}

export async function getAccessories() {
  const where = await strictOrgWhere();
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

  const accessory = await prisma.accessories.findFirst({
    where: { accessorieid: id, ...(await strictOrgWhere()) },
  });

  if (!accessory) {
    throw new Error(`Accessory with ID ${id} not found`);
  }

  return accessory;
}

export async function getSuppliers() {
  const where = await strictOrgWhere();
  const key = `suppliers:${JSON.stringify(where)}`;
  return cached(key, () => prisma.supplier.findMany({ where }), 2 * 60 * 1000);
}

export async function getSupplierById(id: string) {
  if (!id) {
    throw new Error("Invalid ID parameter");
  }

  const supplier = await prisma.supplier.findFirst({
    where: { supplierid: id, ...(await strictOrgWhere()) },
  });

  if (!supplier) {
    throw new Error(`Supplier with ID ${id} not found`);
  }

  return supplier;
}

export async function getConsumables() {
  const where = await strictOrgWhere();
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

  const consumable = await prisma.consumable.findFirst({
    where: { consumableid: id, ...(await strictOrgWhere()) },
  });

  if (!consumable) {
    throw new Error(`Consumable with ID ${id} not found`);
  }

  return consumable;
}

export async function getConsumableCategories() {
  const where = await strictOrgWhere();
  const key = `consumable_categories:${JSON.stringify(where)}`;
  return cached(
    key,
    () => prisma.consumableCategoryType.findMany({ where }),
    2 * 60 * 1000,
  );
}

export async function getAccessoryCategories() {
  const where = await strictOrgWhere();
  const key = `accessory_categories:${JSON.stringify(where)}`;
  return cached(
    key,
    () => prisma.accessorieCategoryType.findMany({ where }),
    2 * 60 * 1000,
  );
}

export async function getLicences() {
  const where = await strictOrgWhere();
  const key = `licences_all:${JSON.stringify(where)}`;
  return cached(key, () => prisma.licence.findMany({ where }), 2 * 60 * 1000);
}

export async function getLicenceById(id: string) {
  if (!id) {
    throw new Error("Invalid ID parameter");
  }

  const licence = await prisma.licence.findFirst({
    where: { licenceid: id, ...(await strictOrgWhere()) },
  });

  if (!licence) {
    throw new Error(`Licence with ID ${id} not found`);
  }

  return licence;
}

export async function getLicenceCategories() {
  const where = await strictOrgWhere();
  const key = `licence_categories:${JSON.stringify(where)}`;
  return cached(
    key,
    () => prisma.licenceCategoryType.findMany({ where }),
    2 * 60 * 1000,
  );
}

export async function getModel() {
  const where = await strictOrgWhere();
  const key = `models:${JSON.stringify(where)}`;
  return cached(key, () => prisma.model.findMany({ where }), 2 * 60 * 1000);
}

export async function getCategories() {
  const where = await strictOrgWhere();
  const key = `categories:${JSON.stringify(where)}`;
  return cached(
    key,
    () => prisma.assetCategoryType.findMany({ where }),
    2 * 60 * 1000,
  );
}

export async function getUserAssets() {
  const { organizationId } = await strictOrgWhere();
  const key = `user_assets_all:${organizationId}`;
  return cached(
    key,
    () =>
      prisma.userAssets.findMany({
        // userAssets has no organizationId column; scope via the asset relation.
        where: { asset: { organizationId } },
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
  const { organizationId } = await strictOrgWhere();
  const key = `user_accessoires_all:${organizationId}`;
  return cached(
    key,
    () =>
      prisma.userAccessoires.findMany({
        // No organizationId column; scope via the accessories relation.
        where: { accessories: { organizationId } },
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
  if (!id) {
    throw new Error("Invalid ID parameter");
  }

  const user = await prisma.user.findFirst({
    where: {
      userid: id,
      ...(await strictOrgWhere()),
    },
  });

  if (!user) {
    throw new Error(`User with ID ${id} not found`);
  }

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

// Category Type data functions
export async function getAssetCategoryById(id: string) {
  if (!id) {
    throw new Error("Invalid ID parameter");
  }

  const category = await prisma.assetCategoryType.findFirst({
    where: { assetcategorytypeid: id, ...(await strictOrgWhere()) },
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

  const category = await prisma.accessorieCategoryType.findFirst({
    where: { accessoriecategorytypeid: id, ...(await strictOrgWhere()) },
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

  const category = await prisma.consumableCategoryType.findFirst({
    where: { consumablecategorytypeid: id, ...(await strictOrgWhere()) },
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

  const category = await prisma.licenceCategoryType.findFirst({
    where: { licencecategorytypeid: id, ...(await strictOrgWhere()) },
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

  const model = await prisma.model.findFirst({
    where: { modelid: id, ...(await strictOrgWhere()) },
  });

  if (!model) {
    throw new Error(`Model with ID ${id} not found`);
  }

  return model;
}

// Component data functions
export async function getComponents() {
  const where = await strictOrgWhere();
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
  const component = await prisma.component.findFirst({
    where: { id, ...(await strictOrgWhere()) },
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
  const where = await strictOrgWhere();
  const key = `component_categories:${JSON.stringify(where)}`;
  return cached(
    key,
    () =>
      prisma.componentCategory.findMany({
        where,
        orderBy: { name: "asc" },
      }),
    2 * 60 * 1000,
  );
}

export async function getComponentCategoryById(id: string) {
  if (!id) {
    throw new Error("Invalid ID parameter");
  }

  const category = await prisma.componentCategory.findFirst({
    where: { id, ...(await strictOrgWhere()) },
  });

  if (!category) {
    throw new Error(`Component category with ID ${id} not found`);
  }

  return category;
}

// EULA Templates
export async function getEulaTemplates() {
  const where = await strictOrgWhere();
  const key = `eula_templates:${JSON.stringify(where)}`;
  return cached(
    key,
    () =>
      prisma.eulaTemplate.findMany({
        where,
        orderBy: { createdAt: "desc" },
      }),
    2 * 60 * 1000,
  );
}

export async function getEulaTemplateById(id: string) {
  if (!id) throw new Error("Invalid ID parameter");
  const template = await prisma.eulaTemplate.findFirst({
    where: { id, ...(await strictOrgWhere()) },
  });
  if (!template) throw new Error(`EULA template with ID ${id} not found`);
  return template;
}

// Kits
export async function getKits() {
  const where = await strictOrgWhere();
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
  const kit = await prisma.kit.findFirst({
    where: { id, ...(await strictOrgWhere()) },
    include: { items: true },
  });
  if (!kit) throw new Error(`Kit with ID ${id} not found`);
  return kit;
}

// Audit Campaigns
export async function getAuditCampaigns() {
  const where = await strictOrgWhere();
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
  const campaign = await prisma.auditCampaign.findFirst({
    where: { id, ...(await strictOrgWhere()) },
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

  const status = await prisma.statusType.findFirst({
    where: { statustypeid: id, ...(await strictOrgWhere()) },
  });

  if (!status) {
    throw new Error(`Status with ID ${id} not found`);
  }

  return status;
}

/**
 * Fetch audit history for any entity type. Returns the most recent 50 entries
 * with user info, sorted newest-first.
 */
export async function getEntityHistory(entity: string, entityId: string) {
  const { organizationId } = await strictOrgWhere();
  return prisma.audit_logs.findMany({
    // audit_logs has no organizationId column; scope via the acting user's org.
    where: { entity, entityId, user: { organizationId } },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      user: {
        select: {
          userid: true,
          username: true,
          firstname: true,
          lastname: true,
        },
      },
    },
  });
}
