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

export async function getOrgStorage(orgId: string): Promise<StorageProvider> {
  const prisma = (await import("@/lib/prisma")).default;
  const config = await prisma.organizationStorageConfig.findUnique({
    where: { organizationId: orgId, isEnabled: true },
  });

  if (!config) return getStorage();

  const { decrypt } = await import("@/lib/encryption");
  return new S3StorageProvider({
    bucket: config.bucket,
    region: config.region,
    endpoint: config.endpoint,
    accessKey: decrypt(config.accessKey),
    secretKey: decrypt(config.secretKey),
  });
}
