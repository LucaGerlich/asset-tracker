import type { StorageProvider } from "./types";
import { LocalStorageProvider } from "./local";

export type { StorageProvider } from "./types";
export type { S3Config } from "./s3";

let instance: StorageProvider | null = null;
let initPromise: Promise<StorageProvider> | null = null;

async function createProvider(): Promise<StorageProvider> {
  const provider = (process.env.STORAGE_PROVIDER || "local").toLowerCase();

  switch (provider) {
    case "s3": {
      // @ts-ignore -- optional dependency, only needed when STORAGE_PROVIDER=s3
      const { S3StorageProvider } = await import(
        /* webpackIgnore: true */ "./s3"
      );
      return new S3StorageProvider();
    }
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
  // @ts-ignore -- optional dependency
  const { S3StorageProvider } = await import(/* webpackIgnore: true */ "./s3");
  return new S3StorageProvider({
    bucket: config.bucket,
    region: config.region,
    endpoint: config.endpoint,
    accessKey: decrypt(config.accessKey),
    secretKey: decrypt(config.secretKey),
  });
}
