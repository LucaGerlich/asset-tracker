// Demo Seed Script - Populates database with comprehensive sample data
// Used for Supabase demo deployment with 30-minute reset cycle
// This creates a realistic demo environment showcasing all app features

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const pg = require("pg");
const bcrypt = require("bcryptjs");
const { faker } = require("@faker-js/faker");

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

// Demo user credentials (will be shown on login page)
const DEMO_ADMIN_USERNAME = "demo_admin";
const DEMO_ADMIN_PASSWORD = "demo123";
const DEMO_USER_USERNAME = "demo_user";
const DEMO_USER_PASSWORD = "demo123";

async function clearDatabase() {
  console.log("Clearing existing data...");
  
  // Delete in order respecting foreign key constraints
  // New models first (they may reference existing tables)
  await prisma.webhookDelivery.deleteMany({});
  await prisma.webhook.deleteMany({});
  await prisma.assetReservation.deleteMany({});
  await prisma.stockAlert.deleteMany({});
  await prisma.importJob.deleteMany({});
  await prisma.userRole.deleteMany({});
  await prisma.role.deleteMany({});
  await prisma.department.deleteMany({});
  
  // Original tables
  await prisma.audit_logs.deleteMany({});
  await prisma.sessions.deleteMany({});
  await prisma.accounts.deleteMany({});
  await prisma.verification_tokens.deleteMany({});
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
  
  // Delete organizations last (they're referenced by other tables)
  await prisma.organization.deleteMany({});
  
  console.log("Database cleared!");
}

async function createStatusTypes() {
  console.log("Creating status types...");
  const statuses = ["Active", "Available", "In Repair", "Retired", "Reserved", "Lost"];
  
  const created = [];
  for (const name of statuses) {
    const status = await prisma.statusType.create({
      data: { statustypename: name }
    });
    created.push(status);
  }
  return created;
}

async function createAssetCategories() {
  console.log("Creating asset categories...");
  const categories = ["Laptops", "Desktops", "Monitors", "Phones", "Tablets", "Servers", "Network Equipment", "Printers"];
  
  const created = [];
  for (const name of categories) {
    const cat = await prisma.assetCategoryType.create({
      data: { assetcategorytypename: name }
    });
    created.push(cat);
  }
  return created;
}

async function createAccessoryCategories() {
  console.log("Creating accessory categories...");
  const categories = ["Keyboards", "Mice", "Headsets", "Webcams", "Cables", "Adapters", "Docking Stations", "Bags & Cases"];
  
  const created = [];
  for (const name of categories) {
    const cat = await prisma.accessorieCategoryType.create({
      data: { accessoriecategorytypename: name }
    });
    created.push(cat);
  }
  return created;
}

async function createConsumableCategories() {
  console.log("Creating consumable categories...");
  const categories = ["Ink Cartridges", "Toner", "Paper", "Labels", "Batteries", "Cleaning Supplies"];
  
  const created = [];
  for (const name of categories) {
    const cat = await prisma.consumableCategoryType.create({
      data: { consumablecategorytypename: name }
    });
    created.push(cat);
  }
  return created;
}

async function createLicenceCategories() {
  console.log("Creating licence categories...");
  const categories = ["Operating Systems", "Productivity Software", "Development Tools", "Security Software", "Cloud Services", "Design Software"];
  
  const created = [];
  for (const name of categories) {
    const cat = await prisma.licenceCategoryType.create({
      data: { licencecategorytypename: name }
    });
    created.push(cat);
  }
  return created;
}

async function createManufacturers() {
  console.log("Creating manufacturers...");
  const manufacturers = [
    "Apple", "Dell", "HP", "Lenovo", "Microsoft", "Samsung", "LG", "Logitech",
    "Cisco", "Brother", "Canon", "Sony", "ASUS", "Acer", "Intel"
  ];
  
  const created = [];
  for (const name of manufacturers) {
    const mfr = await prisma.manufacturer.create({
      data: {
        manufacturername: name,
        creation_date: new Date()
      }
    });
    created.push(mfr);
  }
  return created;
}

async function createSuppliers() {
  console.log("Creating suppliers...");
  const suppliers = [
    { name: "TechSupply Inc", firstName: "John", lastName: "Smith", email: "john.smith@techsupply.example" },
    { name: "Office Depot", firstName: "Sarah", lastName: "Johnson", email: "sarah.j@officedepot.example" },
    { name: "CDW Corporation", firstName: "Mike", lastName: "Williams", email: "mike.w@cdw.example" },
    { name: "Insight Enterprises", firstName: "Emily", lastName: "Brown", email: "emily.b@insight.example" },
    { name: "SHI International", firstName: "David", lastName: "Davis", email: "david.d@shi.example" },
    { name: "Connection", firstName: "Lisa", lastName: "Miller", email: "lisa.m@connection.example" }
  ];
  
  const created = [];
  for (const s of suppliers) {
    const supplier = await prisma.supplier.create({
      data: {
        suppliername: s.name,
        firstname: s.firstName,
        lastname: s.lastName,
        email: s.email,
        phonenumber: faker.phone.number(),
        salutation: faker.helpers.arrayElement(["Mr.", "Ms.", "Dr."]),
        creation_date: new Date()
      }
    });
    created.push(supplier);
  }
  return created;
}

async function createLocations() {
  console.log("Creating locations...");
  const locations = [
    { name: "Headquarters", street: "123 Main Street", city: "San Francisco", country: "USA" },
    { name: "Remote Office - NYC", street: "456 Broadway", city: "New York", country: "USA" },
    { name: "European HQ", street: "10 Downing Street", city: "London", country: "UK" },
    { name: "Asia Pacific Office", street: "1-1 Shibuya", city: "Tokyo", country: "Japan" },
    { name: "R&D Center", street: "789 Innovation Drive", city: "Austin", country: "USA" },
    { name: "Warehouse", street: "100 Storage Lane", city: "Phoenix", country: "USA" }
  ];
  
  const created = [];
  for (const loc of locations) {
    const location = await prisma.location.create({
      data: {
        locationname: loc.name,
        street: loc.street,
        housenumber: faker.number.int({ min: 1, max: 500 }).toString(),
        city: loc.city,
        country: loc.country,
        creation_date: new Date()
      }
    });
    created.push(location);
  }
  return created;
}

async function createModels(manufacturers) {
  console.log("Creating models...");
  const modelData = [
    "MacBook Pro 14", "MacBook Air M2", "ThinkPad X1 Carbon", "Dell XPS 15",
    "HP EliteBook 850", "Surface Pro 9", "iPhone 15 Pro", "Galaxy S24",
    "UltraSharp U2723QE", "ThinkVision P27h", "Logitech MX Master 3",
    "Magic Keyboard", "AirPods Pro", "WH-1000XM5", "ROG Swift PG279QM"
  ];
  
  const created = [];
  for (const name of modelData) {
    const model = await prisma.model.create({
      data: {
        modelname: name,
        modelnumber: faker.string.alphanumeric(8).toUpperCase(),
        creation_date: new Date()
      }
    });
    created.push(model);
  }
  return created;
}

async function createDemoUsers(organization, departments) {
  console.log("Creating demo users...");
  
  const hashedAdminPassword = await bcrypt.hash(DEMO_ADMIN_PASSWORD, 12);
  const hashedUserPassword = await bcrypt.hash(DEMO_USER_PASSWORD, 12);
  
  const users = [];
  
  // Find department IDs
  const engineeringDept = departments.find(d => d.name === "Engineering");
  const marketingDept = departments.find(d => d.name === "Marketing");
  const salesDept = departments.find(d => d.name === "Sales");
  const hrDept = departments.find(d => d.name === "Human Resources");
  
  // Demo Admin
  const admin = await prisma.user.create({
    data: {
      username: DEMO_ADMIN_USERNAME,
      email: "admin@demo.example",
      firstname: "Demo",
      lastname: "Admin",
      password: hashedAdminPassword,
      isadmin: true,
      canrequest: true,
      lan: "LAN001",
      organizationId: organization.id,
      creation_date: new Date()
    }
  });
  users.push(admin);
  
  // Demo User (non-admin)
  const user = await prisma.user.create({
    data: {
      username: DEMO_USER_USERNAME,
      email: "user@demo.example",
      firstname: "Demo",
      lastname: "User",
      password: hashedUserPassword,
      isadmin: false,
      canrequest: true,
      lan: "LAN002",
      organizationId: organization.id,
      departmentId: engineeringDept?.id,
      creation_date: new Date()
    }
  });
  users.push(user);
  
  // Additional sample users with departments
  const additionalUsers = [
    { firstName: "Alice", lastName: "Engineering", dept: engineeringDept },
    { firstName: "Bob", lastName: "Marketing", dept: marketingDept },
    { firstName: "Charlie", lastName: "Sales", dept: salesDept },
    { firstName: "Diana", lastName: "HR", dept: hrDept },
    { firstName: "Eve", lastName: "Finance", dept: null },
    { firstName: "Frank", lastName: "Operations", dept: null }
  ];
  
  for (const u of additionalUsers) {
    const hashedPw = await bcrypt.hash("password123", 12);
    const created = await prisma.user.create({
      data: {
        username: u.firstName.toLowerCase() + "_" + u.lastName.toLowerCase(),
        email: `${u.firstName.toLowerCase()}@demo.example`,
        firstname: u.firstName,
        lastname: u.lastName,
        password: hashedPw,
        isadmin: false,
        canrequest: true,
        lan: "LAN" + faker.string.numeric(3),
        organizationId: organization.id,
        departmentId: u.dept?.id || null,
        creation_date: new Date()
      }
    });
    users.push(created);
  }
  
  return users;
}

async function createAssets(statuses, categories, locations, manufacturers, suppliers, models) {
  console.log("Creating assets...");
  
  const assetNames = [
    "Engineering Laptop", "Marketing MacBook", "Sales Surface", "HR Desktop",
    "Finance Workstation", "Executive MacBook Pro", "Dev Machine", "QA Station",
    "Conference Room Display", "Reception Monitor", "Server Room Equipment",
    "Network Switch", "Firewall Appliance", "Backup Server", "Development Server"
  ];
  
  const assets = [];
  for (let i = 0; i < 25; i++) {
    const name = i < assetNames.length ? assetNames[i] : faker.commerce.productName();
    const asset = await prisma.asset.create({
      data: {
        assetname: name,
        assettag: `AST-${String(i + 1001).padStart(5, '0')}`,
        serialnumber: faker.string.alphanumeric(12).toUpperCase(),
        modelid: faker.helpers.arrayElement(models).modelid,
        specs: faker.helpers.arrayElement([
          "16GB RAM, 512GB SSD, Intel i7",
          "32GB RAM, 1TB SSD, Apple M2 Pro",
          "8GB RAM, 256GB SSD, Intel i5",
          "64GB RAM, 2TB SSD, AMD Ryzen 9",
          null
        ]),
        notes: faker.helpers.arrayElement([
          "Primary work device",
          "Backup machine",
          "Shared equipment",
          "New purchase",
          null
        ]),
        purchaseprice: faker.number.float({ min: 500, max: 3500, fractionDigits: 2 }),
        purchasedate: faker.date.past({ years: 3 }),
        mobile: faker.datatype.boolean(),
        requestable: faker.datatype.boolean(),
        assetcategorytypeid: faker.helpers.arrayElement(categories).assetcategorytypeid,
        statustypeid: faker.helpers.arrayElement(statuses).statustypeid,
        supplierid: faker.helpers.arrayElement(suppliers).supplierid,
        locationid: faker.helpers.arrayElement(locations).locationid,
        manufacturerid: faker.helpers.arrayElement(manufacturers).manufacturerid,
        creation_date: new Date()
      }
    });
    assets.push(asset);
  }
  return assets;
}

async function createAccessories(statuses, categories, locations, manufacturers, suppliers, models) {
  console.log("Creating accessories...");
  
  const accessoryNames = [
    "Wireless Mouse", "Mechanical Keyboard", "USB-C Hub", "Webcam HD",
    "Noise-Canceling Headset", "Monitor Stand", "Laptop Bag", "USB Dongle",
    "HDMI Cable", "Power Adapter", "Docking Station", "Ergonomic Mousepad"
  ];
  
  const accessories = [];
  for (let i = 0; i < 20; i++) {
    const name = i < accessoryNames.length ? accessoryNames[i] : faker.commerce.productName();
    const accessory = await prisma.accessories.create({
      data: {
        accessoriename: name,
        accessorietag: `ACC-${String(i + 2001).padStart(5, '0')}`,
        purchaseprice: faker.number.float({ min: 20, max: 300, fractionDigits: 2 }),
        purchasedate: faker.date.past({ years: 2 }),
        requestable: faker.datatype.boolean(),
        manufacturerid: faker.helpers.arrayElement(manufacturers).manufacturerid,
        statustypeid: faker.helpers.arrayElement(statuses).statustypeid,
        accessoriecategorytypeid: faker.helpers.arrayElement(categories).accessoriecategorytypeid,
        locationid: faker.helpers.arrayElement(locations).locationid,
        supplierid: faker.helpers.arrayElement(suppliers).supplierid,
        modelid: faker.helpers.arrayElement(models).modelid,
        creation_date: new Date()
      }
    });
    accessories.push(accessory);
  }
  return accessories;
}

async function createConsumables(consumableCategories, manufacturers, suppliers) {
  console.log("Creating consumables...");
  
  const consumableNames = [
    "Black Ink Cartridge", "Color Ink Cartridge", "Toner Black HP",
    "A4 Paper 500 Sheets", "Label Roll", "AA Batteries Pack",
    "Screen Cleaner", "Compressed Air", "Thermal Paste"
  ];
  
  const consumables = [];
  for (let i = 0; i < 15; i++) {
    const name = i < consumableNames.length ? consumableNames[i] : faker.commerce.productName();
    const consumable = await prisma.consumable.create({
      data: {
        consumablename: name,
        consumablecategorytypeid: faker.helpers.arrayElement(consumableCategories).consumablecategorytypeid,
        manufacturerid: faker.helpers.arrayElement(manufacturers).manufacturerid,
        supplierid: faker.helpers.arrayElement(suppliers).supplierid,
        purchaseprice: faker.number.float({ min: 5, max: 150, fractionDigits: 2 }),
        purchasedate: faker.date.past({ years: 1 }),
        creation_date: new Date()
      }
    });
    consumables.push(consumable);
  }
  return consumables;
}

async function createLicences(licenceCategories, manufacturers, suppliers, users) {
  console.log("Creating licences...");
  
  const licenceNames = [
    { name: "Microsoft 365 Business", key: "XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" },
    { name: "Windows 11 Pro", key: "WXXXX-XXXXX-XXXXX-XXXXX-XXXXX" },
    { name: "Adobe Creative Cloud", key: null },
    { name: "JetBrains All Products Pack", key: "JBXXX-XXXXX-XXXXX" },
    { name: "Slack Business+", key: null },
    { name: "Zoom Pro", key: null },
    { name: "GitHub Enterprise", key: "GHENT-XXXXX-XXXXX" },
    { name: "Figma Professional", key: null },
    { name: "Norton Security Premium", key: "NORTN-XXXXX-XXXXX-XXXXX" },
    { name: "AutoCAD 2024", key: "ACAD-XXXXX-XXXXX" }
  ];
  
  const licences = [];
  for (let i = 0; i < licenceNames.length; i++) {
    const lic = licenceNames[i];
    const assignedUser = faker.helpers.arrayElement([...users, null]);
    const licence = await prisma.licence.create({
      data: {
        licencekey: lic.key,
        licenceduserid: assignedUser?.userid || null,
        licensedtoemail: assignedUser?.email || null,
        purchaseprice: faker.number.float({ min: 50, max: 500, fractionDigits: 2 }),
        purchasedate: faker.date.past({ years: 2 }),
        expirationdate: faker.date.future({ years: 2 }),
        notes: faker.helpers.arrayElement([
          "Annual subscription",
          "Perpetual license",
          "Volume license",
          null
        ]),
        requestable: faker.datatype.boolean(),
        licencecategorytypeid: faker.helpers.arrayElement(licenceCategories).licencecategorytypeid,
        manufacturerid: faker.helpers.arrayElement(manufacturers).manufacturerid,
        supplierid: faker.helpers.arrayElement(suppliers).supplierid,
        creation_date: new Date()
      }
    });
    licences.push(licence);
  }
  return licences;
}

async function createUserAssets(users, assets) {
  console.log("Creating user-asset assignments...");
  
  // Assign some assets to users
  const assignmentsCount = Math.min(10, Math.floor(assets.length * 0.4));
  const assignedAssets = faker.helpers.arrayElements(assets, assignmentsCount);
  
  for (const asset of assignedAssets) {
    const user = faker.helpers.arrayElement(users);
    await prisma.userAssets.create({
      data: {
        userid: user.userid,
        assetid: asset.assetid,
        creation_date: new Date()
      }
    });
  }
}

async function createUserAccessoires(users, accessories) {
  console.log("Creating user-accessory assignments...");
  
  // Assign some accessories to users
  const assignmentsCount = Math.min(8, Math.floor(accessories.length * 0.4));
  const assignedAccessories = faker.helpers.arrayElements(accessories, assignmentsCount);
  
  for (const accessory of assignedAccessories) {
    const user = faker.helpers.arrayElement(users);
    await prisma.userAccessoires.create({
      data: {
        userid: user.userid,
        accessorieid: accessory.accessorieid,
        creation_date: new Date()
      }
    });
  }
}

async function createUserHistory(users, assets) {
  console.log("Creating user history records...");
  
  const actions = ["Created", "Updated", "Checked Out", "Checked In", "Assigned", "Unassigned"];
  
  // Create some history entries
  for (let i = 0; i < 20; i++) {
    const user = faker.helpers.arrayElement(users);
    const asset = faker.helpers.arrayElement(assets);
    const action = faker.helpers.arrayElement(actions);
    
    await prisma.userHistory.create({
      data: {
        referenceid: asset.assetid,
        referencetable: "asset",
        userid: user.userid,
        actionname: action,
        updatedate: faker.date.recent({ days: 30 }),
        checkedout: action === "Checked Out" ? faker.date.recent({ days: 30 }) : null,
        checkedin: action === "Checked In" ? faker.date.recent({ days: 15 }) : null,
        creation_date: new Date()
      }
    });
  }
}

// Create default organization for multi-tenancy
async function createDefaultOrganization() {
  console.log("Creating default organization...");
  
  const org = await prisma.organization.create({
    data: {
      name: "Demo Organization",
      slug: "demo-org",
      description: "Default organization for demo purposes",
      isActive: true,
      settings: {
        theme: "light",
        defaultCurrency: "USD",
        allowAssetRequests: true
      }
    }
  });
  
  return org;
}

// Create default departments
async function createDepartments(organization) {
  console.log("Creating departments...");
  
  const departments = [];
  
  const engineering = await prisma.department.create({
    data: {
      name: "Engineering",
      description: "Software engineering and development",
      organizationId: organization.id
    }
  });
  departments.push(engineering);
  
  const marketing = await prisma.department.create({
    data: {
      name: "Marketing",
      description: "Marketing and communications",
      organizationId: organization.id
    }
  });
  departments.push(marketing);
  
  const sales = await prisma.department.create({
    data: {
      name: "Sales",
      description: "Sales and business development",
      organizationId: organization.id
    }
  });
  departments.push(sales);
  
  const hr = await prisma.department.create({
    data: {
      name: "Human Resources",
      description: "HR and people operations",
      organizationId: organization.id
    }
  });
  departments.push(hr);
  
  return departments;
}

// Create default roles for RBAC
async function createDefaultRoles(organization) {
  console.log("Creating default roles...");
  
  const roles = [];
  
  // Admin role (system role, all permissions)
  const adminRole = await prisma.role.create({
    data: {
      name: "Administrator",
      description: "Full system access",
      isSystem: true,
      organizationId: null, // Global role
      permissions: [
        "asset:view", "asset:create", "asset:edit", "asset:delete", "asset:assign",
        "user:view", "user:create", "user:edit", "user:delete",
        "accessory:view", "accessory:create", "accessory:edit", "accessory:delete",
        "license:view", "license:create", "license:edit", "license:delete", "license:assign",
        "consumable:view", "consumable:create", "consumable:edit", "consumable:delete",
        "org:view", "org:manage", "dept:view", "dept:manage",
        "reservation:view", "reservation:create", "reservation:approve",
        "settings:view", "settings:edit",
        "report:view", "report:export",
        "audit:view", "webhook:view", "webhook:manage", "import:execute"
      ]
    }
  });
  roles.push(adminRole);
  
  // Asset Manager role
  const managerRole = await prisma.role.create({
    data: {
      name: "Asset Manager",
      description: "Can manage assets and assignments",
      isSystem: true,
      organizationId: null,
      permissions: [
        "asset:view", "asset:create", "asset:edit", "asset:assign",
        "accessory:view", "accessory:create", "accessory:edit",
        "license:view", "license:assign",
        "consumable:view",
        "reservation:view", "reservation:approve",
        "report:view", "report:export"
      ]
    }
  });
  roles.push(managerRole);
  
  // Standard User role
  const userRole = await prisma.role.create({
    data: {
      name: "Standard User",
      description: "View-only access with request capabilities",
      isSystem: true,
      organizationId: null,
      permissions: [
        "asset:view",
        "accessory:view",
        "license:view",
        "consumable:view",
        "reservation:view", "reservation:create",
        "report:view"
      ]
    }
  });
  roles.push(userRole);
  
  return roles;
}

async function main() {
  console.log("🚀 Starting Demo Database Seed...\n");
  
  try {
    await clearDatabase();
    
    // Create multi-tenancy foundation
    const organization = await createDefaultOrganization();
    const departments = await createDepartments(organization);
    const roles = await createDefaultRoles(organization);
    
    // Create reference data
    const statuses = await createStatusTypes();
    const assetCategories = await createAssetCategories();
    const accessoryCategories = await createAccessoryCategories();
    const consumableCategories = await createConsumableCategories();
    const licenceCategories = await createLicenceCategories();
    const manufacturers = await createManufacturers();
    const suppliers = await createSuppliers();
    const locations = await createLocations();
    const models = await createModels(manufacturers);
    
    // Create main data
    const users = await createDemoUsers(organization, departments);
    const assets = await createAssets(statuses, assetCategories, locations, manufacturers, suppliers, models);
    const accessories = await createAccessories(statuses, accessoryCategories, locations, manufacturers, suppliers, models);
    await createConsumables(consumableCategories, manufacturers, suppliers);
    await createLicences(licenceCategories, manufacturers, suppliers, users);
    
    // Create relationships
    await createUserAssets(users, assets);
    await createUserAccessoires(users, accessories);
    await createUserHistory(users, assets);
    
    console.log("\n✅ Demo database seeded successfully!");
    console.log("\n📋 Demo Credentials:");
    console.log(`   Admin: ${DEMO_ADMIN_USERNAME} / ${DEMO_ADMIN_PASSWORD}`);
    console.log(`   User:  ${DEMO_USER_USERNAME} / ${DEMO_USER_PASSWORD}`);
    console.log("\n📊 Summary:");
    console.log(`   - ${users.length} users created`);
    console.log(`   - ${organization.name} organization created`);
    console.log(`   - ${departments.length} departments created`);
    console.log(`   - ${roles.length} roles created`);
    console.log(`   - ${assets.length} assets created`);
    console.log(`   - ${accessories.length} accessories created`);
    console.log(`   - ${statuses.length} status types`);
    console.log(`   - ${locations.length} locations`);
    console.log(`   - ${manufacturers.length} manufacturers`);
    console.log(`   - ${suppliers.length} suppliers`);
    
  } catch (error) {
    console.error("❌ Error seeding database:", error);
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
