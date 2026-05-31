/**
 * Microsoft Intune Device Sync
 *
 * Syncs managed devices from Microsoft Intune via the Graph API.
 * Uses app-only authentication (client credentials flow).
 * Auto-creates manufacturers, models, and categories as needed.
 */

import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { decrypt } from "@/lib/encryption";
import { scopeToOrganization } from "@/lib/organization-context";
import { logger } from "@/lib/logger";

const GRAPH_API_TIMEOUT_MS = 30_000;

function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs = GRAPH_API_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}

export interface IntuneSettings {
  enabled: boolean;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  autoSync: boolean;
  autoCreateAssets: boolean;
  autoUpdateAssets: boolean;
}

interface IntuneDevice {
  id: string;
  deviceName: string;
  serialNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  operatingSystem: string | null;
  osVersion: string | null;
  complianceState: string | null;
  deviceType: string | null;
  managedDeviceOwnerType: string | null;
  enrolledDateTime: string | null;
  lastSyncDateTime: string | null;
}

interface GraphResponse {
  value: IntuneDevice[];
  "@odata.nextLink"?: string;
}

export interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ deviceName: string; error: string }>;
}

export async function getIntuneSettings(): Promise<IntuneSettings> {
  const rows = await prisma.system_settings.findMany({
    where: { settingKey: { startsWith: "intune." } },
  });

  const get = (key: string, fallback = ""): string => {
    const row = rows.find((r) => r.settingKey === key);
    if (!row || !row.settingValue) return fallback;
    if (row.isEncrypted) return decrypt(row.settingValue);
    return row.settingValue;
  };

  return {
    enabled: get("intune.enabled") === "true",
    tenantId: get("intune.tenantId"),
    clientId: get("intune.clientId"),
    clientSecret: get("intune.clientSecret"),
    autoSync: get("intune.autoSync") === "true",
    autoCreateAssets: get("intune.autoCreateAssets") !== "false",
    autoUpdateAssets: get("intune.autoUpdateAssets") !== "false",
  };
}

async function getAccessToken(
  tenantId: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
  });

  const res = await fetchWithTimeout(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to get access token: ${res.status} ${err}`);
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function fetchManagedDevices(
  accessToken: string,
): Promise<IntuneDevice[]> {
  const devices: IntuneDevice[] = [];
  let url: string | null =
    "https://graph.microsoft.com/v1.0/deviceManagement/managedDevices?$select=id,deviceName,serialNumber,manufacturer,model,operatingSystem,osVersion,complianceState,deviceType,managedDeviceOwnerType,enrolledDateTime,lastSyncDateTime&$top=1000";

  while (url) {
    const res = await fetchWithTimeout(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Graph API error: ${res.status} ${err}`);
    }

    const data = (await res.json()) as GraphResponse;
    devices.push(...data.value);
    url = data["@odata.nextLink"] ?? null;
  }

  return devices;
}

export async function testIntuneConnection(
  settings?: IntuneSettings,
): Promise<{ success: boolean; message: string; deviceCount?: number }> {
  const cfg = settings ?? (await getIntuneSettings());

  if (!cfg.tenantId || !cfg.clientId || !cfg.clientSecret) {
    return { success: false, message: "Missing credentials" };
  }

  try {
    const token = await getAccessToken(
      cfg.tenantId,
      cfg.clientId,
      cfg.clientSecret,
    );
    const devices = await fetchManagedDevices(token);
    return {
      success: true,
      message: `Connected successfully. Found ${devices.length} managed devices.`,
      deviceCount: devices.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message };
  }
}

const LAPTOP_KEYWORDS = [
  "laptop",
  "notebook",
  "surface pro",
  "surface laptop",
  "surface go",
  "thinkpad",
  "latitude",
  "elitebook",
  "probook",
  "zbook",
  "pavilion",
  "inspiron",
  "xps",
  "spectre",
  "envy",
];

export function mapDeviceCategory(
  operatingSystem: string | null,
  deviceType: string | null,
  modelName: string | null,
): string {
  const os = (operatingSystem ?? "").toLowerCase();
  const dt = (deviceType ?? "").toLowerCase();
  const model = (modelName ?? "").toLowerCase();

  // iOS devices — precise by deviceType
  if (os === "ios" || os.includes("iphone") || os.includes("ipad")) {
    if (dt === "iphone" || os.includes("iphone")) return "iPhone";
    if (dt === "ipad" || os.includes("ipad")) return "iPad";
    if (dt === "ipod") return "iPod";
    return "iOS Device";
  }

  // macOS
  if (os === "macos" || dt === "mac" || dt === "macmdm") return "Mac";

  // Windows — infer laptop vs desktop from model name
  if (os === "windows" || os.includes("windows")) {
    if (dt === "surfacehub") return "Surface Hub";
    if (dt === "hololens") return "HoloLens";
    if (LAPTOP_KEYWORDS.some((kw) => model.includes(kw))) {
      return "Windows Laptop";
    }
    if (dt === "desktop") return "Windows Desktop";
    return "Windows Device";
  }

  if (os === "android" || os.includes("android")) {
    if (dt === "androidenterprise" || dt === "androidforwork") {
      return "Android Enterprise";
    }
    return "Android Device";
  }

  // Linux / ChromeOS
  if (os === "linux" || os.includes("linux")) return "Linux Device";
  if (os === "chromeos" || os.includes("chrome")) return "Chromebook";

  return "Other Device";
}

async function getOrCreateManufacturer(name: string): Promise<string> {
  const normalized = name.trim();
  if (!normalized) return "";

  const existing = await prisma.manufacturer.findFirst({
    where: { manufacturername: { equals: normalized, mode: "insensitive" } },
    select: { manufacturerid: true },
  });

  if (existing) return existing.manufacturerid;

  const created = await prisma.manufacturer.create({
    data: {
      manufacturername: normalized,
      creation_date: new Date(),
    } as Prisma.manufacturerUncheckedCreateInput,
  });
  return created.manufacturerid;
}

async function getOrCreateModel(name: string): Promise<string> {
  const normalized = name.trim();
  if (!normalized) return "";

  const existing = await prisma.model.findFirst({
    where: { modelname: { equals: normalized, mode: "insensitive" } },
    select: { modelid: true },
  });

  if (existing) return existing.modelid;

  const created = await prisma.model.create({
    data: {
      modelname: normalized,
      creation_date: new Date(),
    } as Prisma.modelUncheckedCreateInput,
  });
  return created.modelid;
}

async function getOrCreateCategory(name: string): Promise<string> {
  const existing = await prisma.assetCategoryType.findFirst({
    where: {
      assetcategorytypename: { equals: name, mode: "insensitive" },
    },
    select: { assetcategorytypeid: true },
  });

  if (existing) return existing.assetcategorytypeid;

  const created = await prisma.assetCategoryType.create({
    data: { assetcategorytypename: name },
  });
  return created.assetcategorytypeid;
}

export async function syncIntuneDevices(
  organizationId: string | null | undefined,
  triggeredBy: string,
): Promise<SyncResult> {
  const startTime = Date.now();
  const settings = await getIntuneSettings();

  if (!settings.enabled) {
    throw new Error("Intune sync is not enabled");
  }

  const token = await getAccessToken(
    settings.tenantId,
    settings.clientId,
    settings.clientSecret,
  );

  const devices = await fetchManagedDevices(token);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: Array<{ deviceName: string; error: string }> = [];

  // Cache for auto-created entities to avoid repeated DB lookups
  const manufacturerCache = new Map<string, string>();
  const modelCache = new Map<string, string>();
  const categoryCache = new Map<string, string>();

  for (const device of devices) {
    try {
      // 1. Match by externalId (Intune device ID)
      let existingAsset = await prisma.asset.findFirst({
        where: scopeToOrganization(
          { externalId: device.id, externalSource: "intune" },
          organizationId,
        ),
        select: { assetid: true },
      });

      // 2. Fallback: match by serial number
      if (!existingAsset && device.serialNumber) {
        existingAsset = await prisma.asset.findFirst({
          where: scopeToOrganization(
            { serialnumber: device.serialNumber },
            organizationId,
          ),
          select: { assetid: true },
        });
      }

      // Resolve manufacturer
      let manufacturerId: string | null = null;
      if (device.manufacturer) {
        const cached = manufacturerCache.get(device.manufacturer);
        if (cached) {
          manufacturerId = cached;
        } else {
          manufacturerId = await getOrCreateManufacturer(device.manufacturer);
          if (manufacturerId) {
            manufacturerCache.set(device.manufacturer, manufacturerId);
          }
        }
      }

      // Resolve model
      let modelId: string | null = null;
      if (device.model) {
        const cached = modelCache.get(device.model);
        if (cached) {
          modelId = cached;
        } else {
          modelId = await getOrCreateModel(device.model);
          if (modelId) {
            modelCache.set(device.model, modelId);
          }
        }
      }

      // Resolve category
      const categoryName = mapDeviceCategory(
        device.operatingSystem,
        device.deviceType,
        device.model,
      );
      let categoryId: string | null = null;
      const cachedCat = categoryCache.get(categoryName);
      if (cachedCat) {
        categoryId = cachedCat;
      } else {
        categoryId = await getOrCreateCategory(categoryName);
        if (categoryId) {
          categoryCache.set(categoryName, categoryId);
        }
      }

      const specs = [device.operatingSystem, device.osVersion]
        .filter(Boolean)
        .join(" ");

      if (existingAsset) {
        if (!settings.autoUpdateAssets) {
          skipped++;
          continue;
        }

        await prisma.asset.update({
          where: { assetid: existingAsset.assetid },
          data: {
            assetname: device.deviceName,
            externalId: device.id,
            externalSource: "intune",
            specs: specs || undefined,
            manufacturerid: manufacturerId || undefined,
            modelid: modelId || undefined,
            assetcategorytypeid: categoryId || undefined,
            change_date: new Date(),
          },
        });
        updated++;
      } else {
        if (!settings.autoCreateAssets) {
          skipped++;
          continue;
        }

        const serialNumber =
          device.serialNumber || `INT-${device.id.slice(0, 8)}`;
        const assetTag = `INT-${serialNumber}`;

        await prisma.asset.create({
          data: {
            assetname: device.deviceName,
            assettag: assetTag,
            serialnumber: serialNumber,
            externalId: device.id,
            externalSource: "intune",
            specs: specs || null,
            manufacturerid: manufacturerId || null,
            modelid: modelId || null,
            assetcategorytypeid: categoryId || null,
            organizationId: organizationId || null,
            creation_date: new Date(),
            purchasedate: device.enrolledDateTime
              ? new Date(device.enrolledDateTime)
              : null,
            notes: device.managedDeviceOwnerType
              ? `Owner: ${device.managedDeviceOwnerType}`
              : null,
          },
        });
        created++;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push({ deviceName: device.deviceName, error: message });
    }
  }

  const durationMs = Date.now() - startTime;
  const status =
    errors.length === 0
      ? "success"
      : errors.length === devices.length
        ? "failed"
        : "partial";

  await prisma.intuneSyncLog.create({
    data: {
      organizationId: organizationId || null,
      status,
      devicesCreated: created,
      devicesUpdated: updated,
      devicesSkipped: skipped,
      errors: errors.length > 0 ? errors : undefined,
      triggeredBy,
      durationMs,
    },
  });

  logger.info("Intune sync complete", {
    status,
    created,
    updated,
    skipped,
    errorCount: errors.length,
    durationMs,
  });

  return { created, updated, skipped, errors };
}
