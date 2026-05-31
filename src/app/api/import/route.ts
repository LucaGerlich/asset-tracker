import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePermission, requireNotDemoMode } from "@/lib/api-auth";
import { importJobSchema } from "@/lib/validation-organization";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit-log";
import { triggerWebhook } from "@/lib/webhooks";
import { notifyIntegrations } from "@/lib/integrations/slack-teams";
import { checkAssetLimit, checkUserLimit } from "@/lib/tenant-limits";
import { logger, logCatchError } from "@/lib/logger";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// Entity field mappings for CSV import
const ENTITY_FIELDS: Record<string, string[]> = {
  asset: [
    "assetname",
    "assettag",
    "serialnumber",
    "specs",
    "notes",
    "purchaseprice",
    "purchasedate",
    "mobile",
    "requestable",
  ],
  accessory: [
    "accessoriename",
    "accessorietag",
    "purchaseprice",
    "purchasedate",
    "requestable",
  ],
  consumable: [
    "consumablename",
    "purchaseprice",
    "purchasedate",
    "quantity",
    "minQuantity",
  ],
  licence: [
    "licencekey",
    "licensedtoemail",
    "purchaseprice",
    "purchasedate",
    "expirationdate",
    "notes",
    "requestable",
  ],
  user: ["username", "email", "firstname", "lastname", "isadmin", "canrequest"],
  location: ["locationname", "street", "housenumber", "city", "country"],
};

export async function GET(_req: NextRequest) {
  try {
    const authUser = await requirePermission("import:execute");

    const jobs = await prisma.importJob.findMany({
      where: {
        userId: authUser.id!,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json(jobs);
  } catch (error) {
    logger.error("Error fetching import jobs", { error });
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to fetch import jobs" },
      { status: 500 },
    );
  }
}

// Create a new import job (CSV processing)
export async function POST(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const authUser = await requirePermission("import:execute");

    const importUser = await prisma.user.findUnique({
      where: { userid: authUser.id! },
      select: { organizationId: true },
    });
    const importOrgId = importUser?.organizationId || null;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const entityType = formData.get("entityType") as string | null;
    const columnMappingRaw = formData.get("columnMapping") as string | null;

    if (!file || !entityType) {
      return NextResponse.json(
        { error: "File and entityType are required" },
        { status: 400 },
      );
    }

    // Parse column mapping if provided (field name → CSV column index)
    let columnMapping: Record<string, number> | null = null;
    if (columnMappingRaw) {
      try {
        columnMapping = JSON.parse(columnMappingRaw);
      } catch {
        return NextResponse.json(
          { error: "Invalid columnMapping JSON" },
          { status: 400 },
        );
      }
    }

    const validatedInput = importJobSchema.parse({
      entityType,
      fileName: file.name,
      fileSize: file.size,
    });

    // Read and parse CSV
    const text = await file.text();
    const lines = text.split("\n").filter((line) => line.trim());

    if (lines.length < 2) {
      return NextResponse.json(
        { error: "CSV must have a header row and at least one data row" },
        { status: 400 },
      );
    }

    const delimiter = detectDelimiter(lines[0]);
    const headers = parseCSVLine(lines[0], delimiter);
    const expectedFields = ENTITY_FIELDS[validatedInput.entityType];

    // Validate that required fields are either mapped or present in headers
    const requiredFields = getRequiredFields(validatedInput.entityType);
    if (columnMapping) {
      const missingRequired = requiredFields.filter(
        (f) => columnMapping![f] === undefined || columnMapping![f] === -1,
      );
      if (missingRequired.length > 0) {
        return NextResponse.json(
          {
            error: `Missing required field mappings: ${missingRequired.join(", ")}`,
            expectedFields,
          },
          { status: 400 },
        );
      }
    } else {
      const missingRequired = requiredFields.filter(
        (f) => !headers.includes(f),
      );
      if (missingRequired.length > 0) {
        return NextResponse.json(
          {
            error: `Missing required fields: ${missingRequired.join(", ")}`,
            expectedFields,
            receivedFields: headers,
          },
          { status: 400 },
        );
      }
    }

    const rowCount = lines.length - 1;
    if (validatedInput.entityType === "asset") {
      const limitCheck = await checkAssetLimit();
      if (!limitCheck.allowed) {
        return NextResponse.json(
          {
            error: `Asset limit reached (${limitCheck.current}/${limitCheck.max}). Upgrade your plan to import more assets.`,
          },
          { status: 403 },
        );
      }
      if (
        limitCheck.max !== -1 &&
        limitCheck.current + rowCount > limitCheck.max
      ) {
        return NextResponse.json(
          {
            error: `Import would exceed asset limit. You have ${limitCheck.max - limitCheck.current} slots remaining but are trying to import ${rowCount} assets.`,
          },
          { status: 403 },
        );
      }
    } else if (validatedInput.entityType === "user") {
      const limitCheck = await checkUserLimit();
      if (!limitCheck.allowed) {
        return NextResponse.json(
          {
            error: `User limit reached (${limitCheck.current}/${limitCheck.max}). Upgrade your plan to import more users.`,
          },
          { status: 403 },
        );
      }
      if (
        limitCheck.max !== -1 &&
        limitCheck.current + rowCount > limitCheck.max
      ) {
        return NextResponse.json(
          {
            error: `Import would exceed user limit. You have ${limitCheck.max - limitCheck.current} slots remaining but are trying to import ${rowCount} users.`,
          },
          { status: 403 },
        );
      }
    }

    const job = await prisma.importJob.create({
      data: {
        userId: authUser.id!,
        entityType: validatedInput.entityType,
        fileName: validatedInput.fileName,
        fileSize: validatedInput.fileSize,
        totalRows: rowCount,
        status: "processing",
        startedAt: new Date(),
      },
    });

    // Fetch default reference records scoped to the importing user's org
    const orgWhere = { organizationId: importOrgId };
    const [
      defaultManufacturer,
      defaultStatus,
      defaultLocation,
      defaultSupplier,
      defaultModel,
      defaultAssetCategory,
      defaultAccessoryCategory,
      defaultConsumableCategory,
      defaultLicenceCategory,
    ] = await Promise.all([
      prisma.manufacturer.findFirst({ where: orgWhere }),
      prisma.statusType.findFirst({ where: orgWhere }),
      prisma.location.findFirst({ where: orgWhere }),
      prisma.supplier.findFirst({ where: orgWhere }),
      prisma.model.findFirst({ where: orgWhere }),
      prisma.assetCategoryType.findFirst({ where: orgWhere }),
      prisma.accessorieCategoryType.findFirst({ where: orgWhere }),
      prisma.consumableCategoryType.findFirst({ where: orgWhere }),
      prisma.licenceCategoryType.findFirst({ where: orgWhere }),
    ]);

    const defaultRefs = {
      manufacturerid: defaultManufacturer?.manufacturerid,
      statustypeid: defaultStatus?.statustypeid,
      locationid: defaultLocation?.locationid,
      supplierid: defaultSupplier?.supplierid,
      modelid: defaultModel?.modelid,
      assetcategorytypeid: defaultAssetCategory?.assetcategorytypeid,
      accessoriecategorytypeid:
        defaultAccessoryCategory?.accessoriecategorytypeid,
      consumablecategorytypeid:
        defaultConsumableCategory?.consumablecategorytypeid,
      licencecategorytypeid: defaultLicenceCategory?.licencecategorytypeid,
    };

    // Process rows (in a real app, this would be done asynchronously)
    const errors: { row: number; error: string }[] = [];
    let successCount = 0;

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i], delimiter);
        const rowData = columnMapping
          ? createRowObjectFromMapping(columnMapping, values)
          : createRowObject(headers, values);

        await createEntity(
          validatedInput.entityType,
          rowData,
          authUser.id!,
          importOrgId,
          defaultRefs,
        );
        successCount++;
      } catch (err) {
        errors.push({
          row: i + 1,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }

      if (i % 10 === 0) {
        await prisma.importJob.update({
          where: { id: job.id },
          data: {
            processedRows: i,
            successCount,
            errorCount: errors.length,
          },
        });
      }
    }

    // Finalize job
    const completedJob = await prisma.importJob.update({
      where: { id: job.id },
      data: {
        processedRows: lines.length - 1,
        successCount,
        errorCount: errors.length,
        status: errors.length === lines.length - 1 ? "failed" : "completed",
        errors: errors.length > 0 ? errors : null,
        completedAt: new Date(),
      },
    });

    await createAuditLog({
      userId: authUser.id!,
      action: AUDIT_ACTIONS.CREATE,
      entity: "ImportJob",
      entityId: job.id,
      details: {
        entityType: validatedInput.entityType,
        fileName: validatedInput.fileName,
        totalRows: lines.length - 1,
        successCount,
        errorCount: errors.length,
      },
    });

    // Trigger webhook
    const webhookEvent =
      errors.length === lines.length - 1 ? "import.failed" : "import.completed";
    await triggerWebhook(webhookEvent, {
      jobId: job.id,
      entityType: validatedInput.entityType,
      totalRows: lines.length - 1,
      successCount,
      errorCount: errors.length,
    });
    notifyIntegrations(webhookEvent, {
      entityType: validatedInput.entityType,
      successCount,
      errorCount: errors.length,
      totalRows: lines.length - 1,
    }).catch(logCatchError("Integration notification failed"));

    return NextResponse.json(completedJob, { status: 201 });
  } catch (error) {
    logger.error("Error processing import", { error });
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to process import" },
      { status: 500 },
    );
  }
}

export async function OPTIONS(req: NextRequest) {
  const entityType = req.nextUrl.searchParams.get("entityType");

  if (!entityType || !ENTITY_FIELDS[entityType]) {
    return NextResponse.json({
      availableEntities: Object.keys(ENTITY_FIELDS),
      entityFields: ENTITY_FIELDS,
    });
  }

  return NextResponse.json({
    entityType,
    fields: ENTITY_FIELDS[entityType],
    requiredFields: getRequiredFields(entityType),
  });
}

/** Detect delimiter from the first line (comma, semicolon, or tab) */
function detectDelimiter(line: string): string {
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && char in counts) {
      counts[char]++;
    }
  }
  let best = ",";
  let bestCount = 0;
  for (const [delim, count] of Object.entries(counts)) {
    if (count > bestCount) {
      best = delim;
      bestCount = count;
    }
  }
  return best;
}

function parseCSVLine(line: string, delimiter = ","): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function createRowObject(
  headers: string[],
  values: string[],
): Record<string, string> {
  const obj: Record<string, string> = {};
  headers.forEach((header, index) => {
    if (values[index] !== undefined) {
      obj[header.toLowerCase()] = values[index];
    }
  });
  return obj;
}

/** Build a row object using explicit column mapping (field name → column index) */
function createRowObjectFromMapping(
  mapping: Record<string, number>,
  values: string[],
): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [field, colIndex] of Object.entries(mapping)) {
    if (colIndex >= 0 && values[colIndex] !== undefined) {
      obj[field] = values[colIndex];
    }
  }
  return obj;
}

function getRequiredFields(entityType: string): string[] {
  const required: Record<string, string[]> = {
    asset: ["assetname", "assettag", "serialnumber"],
    accessory: ["accessoriename", "accessorietag"],
    consumable: ["consumablename"],
    licence: [],
    user: ["username", "firstname", "lastname"],
    location: ["locationname"],
  };
  return required[entityType] || [];
}

async function createEntity(
  entityType: string,
  data: Record<string, string>,
  userId: string,
  organizationId: string | null,
  defaultRefs: Record<string, string | undefined>,
): Promise<void> {
  const now = new Date();

  switch (entityType) {
    case "asset":
      await prisma.asset.create({
        data: {
          assetname: data.assetname,
          assettag: data.assettag,
          serialnumber: data.serialnumber,
          specs: data.specs || null,
          notes: data.notes || null,
          purchaseprice: data.purchaseprice
            ? parseFloat(data.purchaseprice)
            : null,
          purchasedate: data.purchasedate ? new Date(data.purchasedate) : null,
          mobile: data.mobile ? data.mobile.toLowerCase() === "true" : null,
          requestable: data.requestable
            ? data.requestable.toLowerCase() === "true"
            : null,
          creation_date: now,
          organizationId,
        },
      });
      break;

    case "accessory": {
      const accManufacturer = data.manufacturerid || defaultRefs.manufacturerid;
      const accStatus = data.statustypeid || defaultRefs.statustypeid;
      const accCategory =
        data.accessoriecategorytypeid || defaultRefs.accessoriecategorytypeid;
      const accLocation = data.locationid || defaultRefs.locationid;
      const accSupplier = data.supplierid || defaultRefs.supplierid;
      const accModel = data.modelid || defaultRefs.modelid;
      if (
        !accManufacturer ||
        !accStatus ||
        !accCategory ||
        !accLocation ||
        !accSupplier ||
        !accModel
      ) {
        throw new Error(
          "Missing required reference data for accessory import. Ensure manufacturer, status type, accessory category, location, supplier, and model records exist.",
        );
      }
      await prisma.accessories.create({
        data: {
          accessoriename: data.accessoriename,
          accessorietag: data.accessorietag || `ACC-${Date.now()}`,
          purchaseprice: data.purchaseprice
            ? parseFloat(data.purchaseprice)
            : null,
          purchasedate: data.purchasedate ? new Date(data.purchasedate) : null,
          requestable: data.requestable === "true" || data.requestable === "1",
          creation_date: now,
          manufacturerid: accManufacturer,
          statustypeid: accStatus,
          accessoriecategorytypeid: accCategory,
          locationid: accLocation,
          supplierid: accSupplier,
          modelid: accModel,
          organizationId,
        },
      });
      break;
    }

    case "consumable": {
      const conManufacturer = data.manufacturerid || defaultRefs.manufacturerid;
      const conCategory =
        data.consumablecategorytypeid || defaultRefs.consumablecategorytypeid;
      const conSupplier = data.supplierid || defaultRefs.supplierid;
      if (!conManufacturer || !conCategory || !conSupplier) {
        throw new Error(
          "Missing required reference data for consumable import. Ensure manufacturer, consumable category, and supplier records exist.",
        );
      }
      await prisma.consumable.create({
        data: {
          consumablename: data.consumablename,
          purchaseprice: data.purchaseprice
            ? parseFloat(data.purchaseprice)
            : null,
          purchasedate: data.purchasedate ? new Date(data.purchasedate) : null,
          quantity: data.quantity ? parseInt(data.quantity, 10) : 0,
          minQuantity: data.minquantity ? parseInt(data.minquantity, 10) : 0,
          creation_date: now,
          consumablecategorytypeid: conCategory,
          manufacturerid: conManufacturer,
          supplierid: conSupplier,
          organizationId,
        },
      });
      break;
    }

    case "licence": {
      const licManufacturer = data.manufacturerid || defaultRefs.manufacturerid;
      const licCategory =
        data.licencecategorytypeid || defaultRefs.licencecategorytypeid;
      const licSupplier = data.supplierid || defaultRefs.supplierid;
      if (!licManufacturer || !licCategory || !licSupplier) {
        throw new Error(
          "Missing required reference data for licence import. Ensure manufacturer, licence category, and supplier records exist.",
        );
      }
      await prisma.licence.create({
        data: {
          licencekey: data.licencekey || null,
          licensedtoemail: data.licensedtoemail || null,
          purchaseprice: data.purchaseprice
            ? parseFloat(data.purchaseprice)
            : null,
          purchasedate: data.purchasedate ? new Date(data.purchasedate) : null,
          expirationdate: data.expirationdate
            ? new Date(data.expirationdate)
            : null,
          notes: data.notes || null,
          requestable: data.requestable === "true" || data.requestable === "1",
          seatCount: data.seatcount ? parseInt(data.seatcount, 10) : 1,
          creation_date: now,
          licencecategorytypeid: licCategory,
          manufacturerid: licManufacturer,
          supplierid: licSupplier,
          organizationId,
        },
      });
      break;
    }

    case "user": {
      const randomPassword = await bcrypt.hash(
        crypto.randomBytes(32).toString("hex"),
        10,
      );
      const newUser = await prisma.user.create({
        data: {
          username: data.username || null,
          email: data.email || null,
          firstname: data.firstname,
          lastname: data.lastname,
          password: randomPassword,
          isadmin: data.isadmin === "true" || data.isadmin === "1",
          canrequest: data.canrequest !== "false" && data.canrequest !== "0",
          creation_date: now,
          organizationId,
        },
      });
      // Mirror to accounts.password — imported users still need a credential row
      // for the BetterAuth password-reset flow to find them.
      await prisma.accounts
        .create({
          data: {
            userId: newUser.userid,
            providerId: "credential",
            accountId: newUser.userid,
            password: randomPassword,
          },
        })
        .catch(logCatchError("BetterAuth credential sync failed"));
      break;
    }

    case "location":
      await prisma.location.create({
        data: {
          locationname: data.locationname,
          street: data.street || null,
          housenumber: data.housenumber || null,
          city: data.city || null,
          country: data.country || null,
          creation_date: now,
        },
      });
      break;

    default:
      throw new Error(`Import not implemented for entity type: ${entityType}`);
  }
}

export const dynamic = "force-dynamic";
