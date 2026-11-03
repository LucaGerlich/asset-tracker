import type { StorageProvider } from "./types";
import { LocalStorageProvider } from "./local";
import { S3StorageProvider } from "./s3";

export type { StorageProvider } from "./types";
export type { S3Config } from "./s3";

// S3StorageProvider is imported statically so the bundler always traces and
// emits it (a dynamic import with webpackIgnore left it absent at runtime on
// Vercel — "Cannot find module .../chunks/s3"). The AWS SDK itself is still
// lazy-loaded inside the provider, so this carries no eager startup cost.
// Azure remains a dynamic import because @azure/storage-blob is an optional,
// uninstalled dependency that must not be resolved at build time.

let instance: StorageProvider | null = null;
let initPromise: Promise<StorageProvider> | null = null;

async function createProvider(): Promise<StorageProvider> {
  const provider = (process.env.STORAGE_PROVIDER || "local").toLowerCase();

  switch (provider) {
    case "s3":
      return new S3StorageProvider();
    case "azure": {
      // @ts-ignore -- optional dependency, only needed when STORAGE_PROVIDER=azure
      const { AzureStorageProvider } = await import(
        /* webpackIgnore: true */ "./azure"
      );
      return new AzureStorageProvider();
    }
    case "local":
    default:
      return new LocalStorageProvider();
  }
}

export async function getStorage(): Promise<StorageProvider> {
  if (instance) return instance;
  if (!initPromise) {
    initPromise = createProvider().then((p) => {
      instance = p;
      return p;
    });
  }
  return initPromise;
}

/**
 * A successful endpoint validation (which includes a DNS lookup) is reused for
 * a few minutes per organization and endpoint, instead of resolving DNS on
 * every storage call. Failures are never cached, and a changed endpoint is a
 * different key, so it is always validated. DNS rebinding between validation
 * and use is a separate, open hardening item.
 */
export const ORG_STORAGE_VALIDATION_TTL_MS = 5 * 60 * 1000;
const validatedEndpoints = new Map<string, number>();

/** Test helper: forget every cached validation. */
export function resetOrgStorageValidationCache(): void {
  validatedEndpoints.clear();
}

export async function getOrgStorage(orgId: string): Promise<StorageProvider> {
  const prisma = (await import("@/lib/prisma")).default;
  const config = await prisma.organizationStorageConfig.findUnique({
    where: { organizationId: orgId, isEnabled: true },
  });

  if (!config) return getStorage();

  // Endpoints stored before save-time validation existed (or whose DNS changed
  // since) may point at internal hosts. Fail closed: falling back to the
  // default provider would put this org's files in the shared bucket.
  const cacheKey = `${orgId}|${config.endpoint}`;
  const now = Date.now();
  const validUntil = validatedEndpoints.get(cacheKey);
  if (validUntil === undefined || validUntil <= now) {
    const { validateStorageEndpoint } = await import("@/lib/url-validation");
    const endpointCheck = await validateStorageEndpoint(config.endpoint);
    if (!endpointCheck.valid) {
      validatedEndpoints.delete(cacheKey);
      const { logger } = await import("@/lib/logger");
      logger.error("Org storage endpoint rejected by SSRF validation", {
        organizationId: orgId,
        endpoint: config.endpoint,
        reason: endpointCheck.error,
      });
      throw new Error("Organization storage endpoint failed validation");
    }
    for (const [key, expiry] of validatedEndpoints) {
      if (expiry <= now) validatedEndpoints.delete(key);
    }
    validatedEndpoints.set(cacheKey, now + ORG_STORAGE_VALIDATION_TTL_MS);
  }

  const { decrypt } = await import("@/lib/encryption");
  return new S3StorageProvider({
    bucket: config.bucket,
    region: config.region,
    endpoint: config.endpoint,
    accessKey: decrypt(config.accessKey),
    secretKey: decrypt(config.secretKey),
  });
}
