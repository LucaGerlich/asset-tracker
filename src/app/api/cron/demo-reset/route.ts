import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { faker } from "@faker-js/faker";
import { logger } from "@/lib/logger";

const DEMO_ADMIN_USERNAME = "demo_admin";
const DEMO_ADMIN_PASSWORD = "demo123";
const DEMO_USER_USERNAME = "demo_user";
const DEMO_USER_PASSWORD = "demo123";

async function clearDatabase() {
  // Junction / leaf tables first, then entities, then reference data
  await prisma.webhookDelivery.deleteMany({});
  await prisma.webhook.deleteMany({});
  await prisma.dashboardWidget.deleteMany({});
  await prisma.teamInvitation.deleteMany({});
  await prisma.approvalRequest.deleteMany({});
  await prisma.automationRule.deleteMany({});
  await prisma.importJob.deleteMany({});
  await prisma.stockAlert.deleteMany({});
  await prisma.notification_queue.deleteMany({});
  await prisma.notification_preferences.deleteMany({});
  await prisma.saved_filters.deleteMany({});
  await prisma.custom_field_values.deleteMany({});
  await prisma.custom_field_definitions.deleteMany({});
  await prisma.ticket_comments.deleteMany({});
  await prisma.tickets.deleteMany({});
  await prisma.label_templates.deleteMany({});
  await prisma.email_templates.deleteMany({});
  await prisma.depreciation_settings.deleteMany({});
  await prisma.audit_logs.deleteMany({});
  await prisma.assetCheckout.deleteMany({});
  await prisma.assetTransfer.deleteMany({});
  await prisma.assetReservation.deleteMany({});
  await prisma.maintenance_logs.deleteMany({});
  await prisma.maintenance_schedules.deleteMany({});
  await prisma.asset_attachments.deleteMany({});
  await prisma.consumable_checkouts.deleteMany({});
  await prisma.userHistory.deleteMany({});
  await prisma.userAccessoires.deleteMany({});
  await prisma.userAssets.deleteMany({});
  await prisma.user_preferences.deleteMany({});
  await prisma.userRole.deleteMany({});
  await prisma.sessions.deleteMany({});
  await prisma.accounts.deleteMany({});
  await prisma.verification.deleteMany({});
  await prisma.licence.deleteMany({});
  await prisma.consumable.deleteMany({});
  await prisma.accessories.deleteMany({});
  await prisma.asset.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.role.deleteMany({});
  await prisma.department.deleteMany({});
  await prisma.organization.deleteMany({});
  await prisma.model.deleteMany({});
  await prisma.statusType.deleteMany({});
  await prisma.location.deleteMany({});
  await prisma.manufacturer.deleteMany({});
  await prisma.supplier.deleteMany({});
  await prisma.system_settings.deleteMany({});
  await prisma.assetCategoryType.deleteMany({});
  await prisma.accessorieCategoryType.deleteMany({});
  await prisma.consumableCategoryType.deleteMany({});
  await prisma.licenceCategoryType.deleteMany({});
}

async function seedReferenceData() {
  const statuses = [
    "Active",
    "Available",
    "In Repair",
    "Retired",
    "Reserved",
    "Lost",
  ];
  const statusRecords = [];
  for (const name of statuses) {
    statusRecords.push(
      await prisma.statusType.create({ data: { statustypename: name } }),
    );
  }

  const assetCategories = [
    "Laptops",
    "Desktops",
    "Monitors",
    "Phones",
    "Tablets",
    "Servers",
  ];
  const assetCatRecords = [];
  for (const name of assetCategories) {
    assetCatRecords.push(
      await prisma.assetCategoryType.create({
        data: { assetcategorytypename: name },
      }),
    );
  }

  const accCategories = [
    "Keyboards",
    "Mice",
    "Headsets",
    "Webcams",
    "Cables",
    "Adapters",
  ];
  const accCatRecords = [];
  for (const name of accCategories) {
    accCatRecords.push(
      await prisma.accessorieCategoryType.create({
        data: { accessoriecategorytypename: name },
      }),
    );
  }

  const conCategories = [
    "Ink Cartridges",
    "Toner",
    "Paper",
    "Labels",
    "Batteries",
  ];
  const conCatRecords = [];
  for (const name of conCategories) {
    conCatRecords.push(
      await prisma.consumableCategoryType.create({
        data: { consumablecategorytypename: name },
      }),
    );
  }

  const licCategories = [
    "Operating Systems",
    "Productivity Software",
    "Development Tools",
    "Security Software",
  ];
  const licCatRecords = [];
  for (const name of licCategories) {
    licCatRecords.push(
      await prisma.licenceCategoryType.create({
        data: { licencecategorytypename: name },
      }),
    );
  }

  const manufacturers = [
    "Apple",
    "Dell",
    "HP",
    "Lenovo",
    "Microsoft",
    "Samsung",
    "LG",
    "Logitech",
    "Cisco",
  ];
  const mfrRecords = [];
  for (const name of manufacturers) {
    mfrRecords.push(
      await prisma.manufacturer.create({
        data: { manufacturername: name, creation_date: new Date() },
      }),
    );
  }

  const supplierData = [
    { name: "TechSupply Inc", firstName: "John", lastName: "Smith" },
    { name: "Office Depot", firstName: "Sarah", lastName: "Johnson" },
    { name: "CDW Corporation", firstName: "Mike", lastName: "Williams" },
  ];
  const supplierRecords = [];
  for (const s of supplierData) {
    supplierRecords.push(
      await prisma.supplier.create({
        data: {
          suppliername: s.name,
          firstname: s.firstName,
          lastname: s.lastName,
          email: `${s.firstName.toLowerCase()}@example.com`,
          creation_date: new Date(),
        },
      }),
    );
  }

  const locationData = [
    { name: "Headquarters", city: "San Francisco", country: "USA" },
    { name: "NYC Office", city: "New York", country: "USA" },
    { name: "London Office", city: "London", country: "UK" },
  ];
  const locationRecords = [];
  for (const loc of locationData) {
    locationRecords.push(
      await prisma.location.create({
        data: {
          locationname: loc.name,
          city: loc.city,
          country: loc.country,
          creation_date: new Date(),
        },
      }),
    );
  }

  const modelNames = [
    "MacBook Pro 14",
    "ThinkPad X1",
    "Dell XPS 15",
    "Surface Pro 9",
    "iPhone 15",
  ];
  const modelRecords = [];
  for (const name of modelNames) {
    modelRecords.push(
      await prisma.model.create({
        data: {
          modelname: name,
          modelnumber: faker.string.alphanumeric(6).toUpperCase(),
          creation_date: new Date(),
        },
      }),
    );
  }

  return {
    statuses: statusRecords,
    assetCategories: assetCatRecords,
    accCategories: accCatRecords,
    conCategories: conCatRecords,
    licCategories: licCatRecords,
    manufacturers: mfrRecords,
    suppliers: supplierRecords,
    locations: locationRecords,
    models: modelRecords,
  };
}

async function seedUsers() {
  const hashedAdminPw = await bcrypt.hash(DEMO_ADMIN_PASSWORD, 12);
  const hashedUserPw = await bcrypt.hash(DEMO_USER_PASSWORD, 12);

  const admin = await prisma.user.create({
    data: {
      username: DEMO_ADMIN_USERNAME,
      email: "admin@demo.example",
      firstname: "Demo",
      lastname: "Admin",
      password: hashedAdminPw,
      isadmin: true,
      canrequest: true,
      creation_date: new Date(),
    },
  });
  await createCredentialAccount(admin.userid, hashedAdminPw);

  const user = await prisma.user.create({
    data: {
      username: DEMO_USER_USERNAME,
      email: "user@demo.example",
      firstname: "Demo",
      lastname: "User",
      password: hashedUserPw,
      isadmin: false,
      canrequest: true,
      creation_date: new Date(),
    },
  });
  await createCredentialAccount(user.userid, hashedUserPw);

  const extraUsers = [];
  const sampleUsers = ["Alice", "Bob", "Charlie"];
  for (const name of sampleUsers) {
    const pw = await bcrypt.hash("password123", 12);
    const created = await prisma.user.create({
      data: {
        username: name.toLowerCase(),
        email: `${name.toLowerCase()}@demo.example`,
        firstname: name,
        lastname: "Sample",
        password: pw,
        isadmin: false,
        canrequest: true,
        creation_date: new Date(),
      },
    });
    await createCredentialAccount(created.userid, pw);
    extraUsers.push(created);
  }

  return [admin, user, ...extraUsers];
}

// BetterAuth verifies passwords against accounts.password — every demo user needs
// a credential row or login fails after each reset.
async function createCredentialAccount(userId: string, hashedPassword: string) {
  await prisma.accounts.create({
    data: {
      userId,
      providerId: "credential",
      accountId: userId,
      password: hashedPassword,
    },
  });
}

interface SeedRefs {
  statuses: { statustypeid: string }[];
  assetCategories: { assetcategorytypeid: string }[];
  accCategories: { accessoriecategorytypeid: string }[];
  conCategories: { consumablecategorytypeid: string }[];
  licCategories: { licencecategorytypeid: string }[];
  manufacturers: { manufacturerid: string }[];
  suppliers: { supplierid: string }[];
  locations: { locationid: string }[];
  models: { modelid: string }[];
}

async function seedAssets(refs: SeedRefs) {
  const assets = [];
  for (let i = 0; i < 15; i++) {
    assets.push(
      await prisma.asset.create({
        data: {
          assetname: faker.commerce.productName(),
          assettag: `AST-${String(i + 1001).padStart(5, "0")}`,
          serialnumber: faker.string.alphanumeric(12).toUpperCase(),
          modelid: faker.helpers.arrayElement(refs.models).modelid,
          purchaseprice: faker.number.float({
            min: 500,
            max: 3000,
            fractionDigits: 2,
          }),
          purchasedate: faker.date.past({ years: 2 }),
          assetcategorytypeid: faker.helpers.arrayElement(refs.assetCategories)
            .assetcategorytypeid,
          statustypeid: faker.helpers.arrayElement(refs.statuses).statustypeid,
          supplierid: faker.helpers.arrayElement(refs.suppliers).supplierid,
          locationid: faker.helpers.arrayElement(refs.locations).locationid,
          manufacturerid: faker.helpers.arrayElement(refs.manufacturers)
            .manufacturerid,
          creation_date: new Date(),
        },
      }),
    );
  }
  return assets;
}

async function seedAccessories(refs: SeedRefs) {
  const accessories = [];
  for (let i = 0; i < 10; i++) {
    accessories.push(
      await prisma.accessories.create({
        data: {
          accessoriename: faker.commerce.productName(),
          accessorietag: `ACC-${String(i + 2001).padStart(5, "0")}`,
          purchaseprice: faker.number.float({
            min: 20,
            max: 200,
            fractionDigits: 2,
          }),
          manufacturerid: faker.helpers.arrayElement(refs.manufacturers)
            .manufacturerid,
          statustypeid: faker.helpers.arrayElement(refs.statuses).statustypeid,
          accessoriecategorytypeid: faker.helpers.arrayElement(
            refs.accCategories,
          ).accessoriecategorytypeid,
          locationid: faker.helpers.arrayElement(refs.locations).locationid,
          supplierid: faker.helpers.arrayElement(refs.suppliers).supplierid,
          modelid: faker.helpers.arrayElement(refs.models).modelid,
          creation_date: new Date(),
        },
      }),
    );
  }
  return accessories;
}

async function seedConsumables(refs: SeedRefs) {
  for (let i = 0; i < 8; i++) {
    await prisma.consumable.create({
      data: {
        consumablename: faker.commerce.productName(),
        consumablecategorytypeid: faker.helpers.arrayElement(refs.conCategories)
          .consumablecategorytypeid,
        manufacturerid: faker.helpers.arrayElement(refs.manufacturers)
          .manufacturerid,
        supplierid: faker.helpers.arrayElement(refs.suppliers).supplierid,
        purchaseprice: faker.number.float({
          min: 5,
          max: 100,
          fractionDigits: 2,
        }),
        creation_date: new Date(),
      },
    });
  }
}

async function seedLicences(refs: SeedRefs, users: { userid: string }[]) {
  for (let i = 0; i < 6; i++) {
    const assignedUser = faker.helpers.arrayElement([...users, null]);
    await prisma.licence.create({
      data: {
        licencekey: faker.helpers.maybe(
          () => faker.string.alphanumeric(20).toUpperCase(),
          { probability: 0.6 },
        ),
        licenceduserid: assignedUser?.userid || null,
        purchaseprice: faker.number.float({
          min: 50,
          max: 300,
          fractionDigits: 2,
        }),
        expirationdate: faker.date.future({ years: 2 }),
        licencecategorytypeid: faker.helpers.arrayElement(refs.licCategories)
          .licencecategorytypeid,
        manufacturerid: faker.helpers.arrayElement(refs.manufacturers)
          .manufacturerid,
        supplierid: faker.helpers.arrayElement(refs.suppliers).supplierid,
        creation_date: new Date(),
      },
    });
  }
}

async function seedAssignments(
  users: { userid: string }[],
  assets: { assetid: string }[],
  accessories: { accessorieid: string }[],
) {
  for (let i = 0; i < 5; i++) {
    await prisma.userAssets.create({
      data: {
        userid: faker.helpers.arrayElement(users).userid,
        assetid: assets[i].assetid,
        creation_date: new Date(),
      },
    });
  }

  for (let i = 0; i < 4; i++) {
    await prisma.userAccessoires.create({
      data: {
        userid: faker.helpers.arrayElement(users).userid,
        accessorieid: accessories[i].accessorieid,
        creation_date: new Date(),
      },
    });
  }
}

/**
 * Cron endpoint for resetting the demo database to a fresh state.
 * Secured by CRON_SECRET header (for external cron services like Vercel Cron).
 * Only runs when DEMO_MODE is enabled as a safety guard.
 *
 * Usage: GET /api/cron/demo-reset
 * Header: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.DEMO_MODE !== "true") {
    return NextResponse.json(
      { error: "Demo reset is only available in demo mode" },
      { status: 403 },
    );
  }

  // Extra safety: never allow demo reset when DEMO_ALLOW_RESET is not explicitly set
  if (process.env.DEMO_ALLOW_RESET !== "true") {
    logger.warn(
      "Demo reset blocked: DEMO_ALLOW_RESET is not set. Set DEMO_ALLOW_RESET=true to enable.",
    );
    return NextResponse.json(
      { error: "Demo reset is disabled. Set DEMO_ALLOW_RESET=true to enable." },
      { status: 403 },
    );
  }

  const startTime = Date.now();

  try {
    logger.info("Demo database reset started");

    await clearDatabase();
    logger.info("Demo reset: database cleared");

    const refs = await seedReferenceData();
    logger.info("Demo reset: reference data seeded");

    const users = await seedUsers();
    logger.info("Demo reset: users seeded");

    const assets = await seedAssets(refs);
    const accessories = await seedAccessories(refs);
    await seedConsumables(refs);
    await seedLicences(refs, users);
    await seedAssignments(users, assets, accessories);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`Demo database reset completed in ${duration}s`);

    return NextResponse.json(
      {
        success: true,
        resetAt: new Date().toISOString(),
        duration: `${duration}s`,
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error("Demo database reset failed", { error });
    return NextResponse.json(
      { error: "Failed to reset demo database" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;
