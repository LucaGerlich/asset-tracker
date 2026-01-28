#!/usr/bin/env node
/**
 * Demo Database Reset Script
 * 
 * This script resets the demo database to a fresh state.
 * Designed to run every 30 minutes via cron or similar scheduler.
 * 
 * Usage:
 *   node scripts/reset-demo-db.mjs
 * 
 * Environment Variables Required:
 *   DATABASE_URL - PostgreSQL connection string
 *   DATABASE_SSL - Set to "true" for cloud databases (auto-detected for Supabase)
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";
import { faker } from "@faker-js/faker";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error("Error: DATABASE_URL environment variable is not set!");
  process.exit(1);
}

// Determine SSL configuration
const isCloudDatabase = process.env.DATABASE_SSL === "true" || 
  process.env.DATABASE_URL?.includes("supabase") ||
  process.env.DATABASE_URL?.includes("pooler.supabase");

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isCloudDatabase ? { rejectUnauthorized: false } : false
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Demo credentials
const DEMO_ADMIN_USERNAME = "demo_admin";
const DEMO_ADMIN_PASSWORD = "demo123";
const DEMO_USER_USERNAME = "demo_user";
const DEMO_USER_PASSWORD = "demo123";

async function clearDatabase() {
  console.log("[RESET] Clearing existing data...");
  
  // Delete in order respecting foreign key constraints
  await prisma.auditLog.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.verificationToken.deleteMany({});
  await prisma.userHistory.deleteMany({});
  await prisma.userAccessoires.deleteMany({});
  await prisma.userAssets.deleteMany({});
  await prisma.licence.deleteMany({});
  await prisma.consumable.deleteMany({});
  await prisma.accessories.deleteMany({});
  await prisma.asset.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.model.deleteMany({});
  await prisma.statusType.deleteMany({});
  await prisma.location.deleteMany({});
  await prisma.manufacturer.deleteMany({});
  await prisma.supplier.deleteMany({});
  await prisma.assetCategoryType.deleteMany({});
  await prisma.accessorieCategoryType.deleteMany({});
  await prisma.consumableCategoryType.deleteMany({});
  await prisma.licenceCategoryType.deleteMany({});
}

async function seedReferenceData() {
  // Status Types
  const statuses = ["Active", "Available", "In Repair", "Retired", "Reserved", "Lost"];
  const statusRecords = [];
  for (const name of statuses) {
    statusRecords.push(await prisma.statusType.create({ data: { statustypename: name } }));
  }

  // Asset Categories
  const assetCategories = ["Laptops", "Desktops", "Monitors", "Phones", "Tablets", "Servers"];
  const assetCatRecords = [];
  for (const name of assetCategories) {
    assetCatRecords.push(await prisma.assetCategoryType.create({ data: { assetcategorytypename: name } }));
  }

  // Accessory Categories
  const accCategories = ["Keyboards", "Mice", "Headsets", "Webcams", "Cables", "Adapters"];
  const accCatRecords = [];
  for (const name of accCategories) {
    accCatRecords.push(await prisma.accessorieCategoryType.create({ data: { accessoriecategorytypename: name } }));
  }

  // Consumable Categories
  const conCategories = ["Ink Cartridges", "Toner", "Paper", "Labels", "Batteries"];
  const conCatRecords = [];
  for (const name of conCategories) {
    conCatRecords.push(await prisma.consumableCategoryType.create({ data: { consumablecategorytypename: name } }));
  }

  // Licence Categories
  const licCategories = ["Operating Systems", "Productivity Software", "Development Tools", "Security Software"];
  const licCatRecords = [];
  for (const name of licCategories) {
    licCatRecords.push(await prisma.licenceCategoryType.create({ data: { licencecategorytypename: name } }));
  }

  // Manufacturers
  const manufacturers = ["Apple", "Dell", "HP", "Lenovo", "Microsoft", "Samsung", "LG", "Logitech", "Cisco"];
  const mfrRecords = [];
  for (const name of manufacturers) {
    mfrRecords.push(await prisma.manufacturer.create({ data: { manufacturername: name, creation_date: new Date() } }));
  }

  // Suppliers
  const supplierData = [
    { name: "TechSupply Inc", firstName: "John", lastName: "Smith" },
    { name: "Office Depot", firstName: "Sarah", lastName: "Johnson" },
    { name: "CDW Corporation", firstName: "Mike", lastName: "Williams" }
  ];
  const supplierRecords = [];
  for (const s of supplierData) {
    supplierRecords.push(await prisma.supplier.create({
      data: {
        suppliername: s.name,
        firstname: s.firstName,
        lastname: s.lastName,
        email: `${s.firstName.toLowerCase()}@example.com`,
        creation_date: new Date()
      }
    }));
  }

  // Locations
  const locationData = [
    { name: "Headquarters", city: "San Francisco", country: "USA" },
    { name: "NYC Office", city: "New York", country: "USA" },
    { name: "London Office", city: "London", country: "UK" }
  ];
  const locationRecords = [];
  for (const loc of locationData) {
    locationRecords.push(await prisma.location.create({
      data: {
        locationname: loc.name,
        city: loc.city,
        country: loc.country,
        creation_date: new Date()
      }
    }));
  }

  // Models
  const modelNames = ["MacBook Pro 14", "ThinkPad X1", "Dell XPS 15", "Surface Pro 9", "iPhone 15"];
  const modelRecords = [];
  for (const name of modelNames) {
    modelRecords.push(await prisma.model.create({
      data: { modelname: name, modelnumber: faker.string.alphanumeric(6).toUpperCase(), creation_date: new Date() }
    }));
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
    models: modelRecords
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
      creation_date: new Date()
    }
  });

  const user = await prisma.user.create({
    data: {
      username: DEMO_USER_USERNAME,
      email: "user@demo.example",
      firstname: "Demo",
      lastname: "User",
      password: hashedUserPw,
      isadmin: false,
      canrequest: true,
      creation_date: new Date()
    }
  });

  // A few more sample users
  const extraUsers = [];
  const sampleUsers = ["Alice", "Bob", "Charlie"];
  for (const name of sampleUsers) {
    const pw = await bcrypt.hash("password123", 12);
    extraUsers.push(await prisma.user.create({
      data: {
        username: name.toLowerCase(),
        email: `${name.toLowerCase()}@demo.example`,
        firstname: name,
        lastname: "Sample",
        password: pw,
        isadmin: false,
        canrequest: true,
        creation_date: new Date()
      }
    }));
  }

  return [admin, user, ...extraUsers];
}

async function seedAssets(refs) {
  const assets = [];
  for (let i = 0; i < 15; i++) {
    assets.push(await prisma.asset.create({
      data: {
        assetname: faker.commerce.productName(),
        assettag: `AST-${String(i + 1001).padStart(5, '0')}`,
        serialnumber: faker.string.alphanumeric(12).toUpperCase(),
        modelid: faker.helpers.arrayElement(refs.models).modelid,
        purchaseprice: faker.number.float({ min: 500, max: 3000, fractionDigits: 2 }),
        purchasedate: faker.date.past({ years: 2 }),
        assetcategorytypeid: faker.helpers.arrayElement(refs.assetCategories).assetcategorytypeid,
        statustypeid: faker.helpers.arrayElement(refs.statuses).statustypeid,
        supplierid: faker.helpers.arrayElement(refs.suppliers).supplierid,
        locationid: faker.helpers.arrayElement(refs.locations).locationid,
        manufacturerid: faker.helpers.arrayElement(refs.manufacturers).manufacturerid,
        creation_date: new Date()
      }
    }));
  }
  return assets;
}

async function seedAccessories(refs) {
  const accessories = [];
  for (let i = 0; i < 10; i++) {
    accessories.push(await prisma.accessories.create({
      data: {
        accessoriename: faker.commerce.productName(),
        accessorietag: `ACC-${String(i + 2001).padStart(5, '0')}`,
        purchaseprice: faker.number.float({ min: 20, max: 200, fractionDigits: 2 }),
        manufacturerid: faker.helpers.arrayElement(refs.manufacturers).manufacturerid,
        statustypeid: faker.helpers.arrayElement(refs.statuses).statustypeid,
        accessoriecategorytypeid: faker.helpers.arrayElement(refs.accCategories).accessoriecategorytypeid,
        locationid: faker.helpers.arrayElement(refs.locations).locationid,
        supplierid: faker.helpers.arrayElement(refs.suppliers).supplierid,
        modelid: faker.helpers.arrayElement(refs.models).modelid,
        creation_date: new Date()
      }
    }));
  }
  return accessories;
}

async function seedConsumables(refs) {
  for (let i = 0; i < 8; i++) {
    await prisma.consumable.create({
      data: {
        consumablename: faker.commerce.productName(),
        consumablecategorytypeid: faker.helpers.arrayElement(refs.conCategories).consumablecategorytypeid,
        manufacturerid: faker.helpers.arrayElement(refs.manufacturers).manufacturerid,
        supplierid: faker.helpers.arrayElement(refs.suppliers).supplierid,
        purchaseprice: faker.number.float({ min: 5, max: 100, fractionDigits: 2 }),
        creation_date: new Date()
      }
    });
  }
}

async function seedLicences(refs, users) {
  for (let i = 0; i < 6; i++) {
    const assignedUser = faker.helpers.arrayElement([...users, null]);
    await prisma.licence.create({
      data: {
        licencekey: faker.helpers.maybe(() => faker.string.alphanumeric(20).toUpperCase(), { probability: 0.6 }),
        licenceduserid: assignedUser?.userid || null,
        purchaseprice: faker.number.float({ min: 50, max: 300, fractionDigits: 2 }),
        expirationdate: faker.date.future({ years: 2 }),
        licencecategorytypeid: faker.helpers.arrayElement(refs.licCategories).licencecategorytypeid,
        manufacturerid: faker.helpers.arrayElement(refs.manufacturers).manufacturerid,
        supplierid: faker.helpers.arrayElement(refs.suppliers).supplierid,
        creation_date: new Date()
      }
    });
  }
}

async function seedAssignments(users, assets, accessories) {
  // Assign some assets to users
  for (let i = 0; i < 5; i++) {
    await prisma.userAssets.create({
      data: {
        userid: faker.helpers.arrayElement(users).userid,
        assetid: assets[i].assetid,
        creation_date: new Date()
      }
    });
  }

  // Assign some accessories to users
  for (let i = 0; i < 4; i++) {
    await prisma.userAccessoires.create({
      data: {
        userid: faker.helpers.arrayElement(users).userid,
        accessorieid: accessories[i].accessorieid,
        creation_date: new Date()
      }
    });
  }
}

async function main() {
  const startTime = Date.now();
  console.log(`\n[RESET] Demo Database Reset Started at ${new Date().toISOString()}`);

  try {
    await clearDatabase();
    console.log("[RESET] Database cleared");

    console.log("[RESET] Seeding reference data...");
    const refs = await seedReferenceData();

    console.log("[RESET] Seeding users...");
    const users = await seedUsers();

    console.log("[RESET] Seeding assets...");
    const assets = await seedAssets(refs);

    console.log("[RESET] Seeding accessories...");
    const accessories = await seedAccessories(refs);

    console.log("[RESET] Seeding consumables...");
    await seedConsumables(refs);

    console.log("[RESET] Seeding licences...");
    await seedLicences(refs, users);

    console.log("[RESET] Seeding assignments...");
    await seedAssignments(users, assets, accessories);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n[RESET] ✅ Demo database reset completed in ${duration}s`);
    console.log(`[RESET] Demo Admin: ${DEMO_ADMIN_USERNAME} / ${DEMO_ADMIN_PASSWORD}`);
    console.log(`[RESET] Demo User:  ${DEMO_USER_USERNAME} / ${DEMO_USER_PASSWORD}\n`);

  } catch (error) {
    console.error("[RESET] ❌ Error during reset:", error);
    throw error;
  }
}

main()
  .then(async () => {
    await pool.end();
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await pool.end();
    await prisma.$disconnect();
    process.exit(1);
  });
