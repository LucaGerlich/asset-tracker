import fs from "fs";
import path from "path";

export interface GDPRSettings {
  auditLogRetentionDays: number;
  deletedUserRetentionDays: number;
  exportRetentionDays: number;
  updatedAt: string | null;
}

const SETTINGS_FILE = path.join(process.cwd(), "data", "gdpr-settings.json");

const DEFAULT_SETTINGS: GDPRSettings = {
  auditLogRetentionDays: 365,
  deletedUserRetentionDays: 90,
  exportRetentionDays: 30,
  updatedAt: null,
};

function ensureDataDir(): void {
  const dir = path.dirname(SETTINGS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getGDPRSettings(): GDPRSettings {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) {
      return { ...DEFAULT_SETTINGS };
    }
    const raw = fs.readFileSync(SETTINGS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<GDPRSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveGDPRSettings(
  settings: Pick<GDPRSettings, "auditLogRetentionDays" | "deletedUserRetentionDays" | "exportRetentionDays">
): GDPRSettings {
  ensureDataDir();
  const updated: GDPRSettings = {
    auditLogRetentionDays: settings.auditLogRetentionDays,
    deletedUserRetentionDays: settings.deletedUserRetentionDays,
    exportRetentionDays: settings.exportRetentionDays,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), "utf-8");
  return updated;
}
