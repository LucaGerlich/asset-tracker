import prisma from "@/lib/prisma";

const DEFAULT_STATUS_TYPES = [
  { name: "Active", color: "#22c55e", isDefault: true },
  { name: "Available", color: "#3b82f6", isDefault: false },
  { name: "Pending", color: "#f59e0b", isDefault: false },
  { name: "Archived", color: "#6b7280", isDefault: false },
  { name: "Out for Repair", color: "#ef4444", isDefault: false },
  { name: "Lost/Stolen", color: "#dc2626", isDefault: false },
  { name: "Retired", color: "#9ca3af", isDefault: false },
  { name: "Reserved", color: "#8b5cf6", isDefault: false },
  { name: "In Transit", color: "#06b6d4", isDefault: false },
  { name: "Disposed", color: "#374151", isDefault: false },
];

const DEFAULT_ASSET_CATEGORIES = [
  "Laptop",
  "Desktop",
  "Smartphone",
  "Tablet",
  "Display",
  "Phone",
  "Printer",
  "Server",
  "Network Equipment",
  "Storage Device",
  "Audio/Video Equipment",
  "Furniture",
  "Vehicle",
  "Other",
];

const DEFAULT_ACCESSORY_CATEGORIES = [
  "Keyboard",
  "Mouse",
  "Headset",
  "Webcam",
  "Cable",
  "Adapter",
  "Docking Station",
  "Bag/Case",
  "Charger",
  "Stand/Mount",
  "USB Drive",
  "Other",
];

const DEFAULT_CONSUMABLE_CATEGORIES = [
  "Ink Cartridge",
  "Toner",
  "Paper",
  "Label",
  "Battery",
  "Cleaning Supply",
  "Cable Tie/Velcro",
  "Thermal Paste",
  "Other",
];

const DEFAULT_LICENCE_CATEGORIES = [
  "Operating System",
  "Productivity Software",
  "Development Tools",
  "Security Software",
  "Cloud Service",
  "Design Software",
  "Communication Software",
  "Database Software",
  "Other",
];

/**
 * Seed default status types, categories for a newly created organization.
 * Called during registration to give new orgs a usable starting set.
 */
export async function seedOrgDefaults(organizationId: string): Promise<void> {
  await prisma.statusType.createMany({
    data: DEFAULT_STATUS_TYPES.map((st) => ({
      statustypename: st.name,
      color: st.color,
      isDefault: st.isDefault,
      organizationId,
    })),
  });

  await prisma.assetCategoryType.createMany({
    data: DEFAULT_ASSET_CATEGORIES.map((name) => ({
      assetcategorytypename: name,
      organizationId,
    })),
  });

  await prisma.accessorieCategoryType.createMany({
    data: DEFAULT_ACCESSORY_CATEGORIES.map((name) => ({
      accessoriecategorytypename: name,
      organizationId,
    })),
  });

  await prisma.consumableCategoryType.createMany({
    data: DEFAULT_CONSUMABLE_CATEGORIES.map((name) => ({
      consumablecategorytypename: name,
      organizationId,
    })),
  });

  await prisma.licenceCategoryType.createMany({
    data: DEFAULT_LICENCE_CATEGORIES.map((name) => ({
      licencecategorytypename: name,
      organizationId,
    })),
  });
}
