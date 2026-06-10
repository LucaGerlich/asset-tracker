import { NextResponse } from "next/server";
import { requireApiAdmin, requireNotDemoMode } from "@/lib/api-auth";
import { getOrganizationContext } from "@/lib/organization-context";
import { S3StorageProvider } from "@/lib/storage/s3";
import { decrypt } from "@/lib/encryption";
import prisma from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    await requireApiAdmin();

    const body = await req.json();
    const { endpoint, bucket, region, accessKey, secretKey } = body as {
      endpoint: string;
      bucket: string;
      region?: string;
      accessKey?: string;
      secretKey?: string;
    };

    if (!endpoint || !bucket) {
      return NextResponse.json(
        { success: false, error: "endpoint and bucket are required" },
        { status: 400 },
      );
    }

    // If credentials not provided, use the stored org config
    let resolvedAccessKey = accessKey;
    let resolvedSecretKey = secretKey;
    if (!resolvedAccessKey || !resolvedSecretKey) {
      const orgCtx = await getOrganizationContext();
      const orgId = orgCtx?.organization?.id;
      if (!orgId) {
        return NextResponse.json({
          success: false,
          error: "No credentials provided and no org config found",
        });
      }
      const config = await prisma.organizationStorageConfig.findUnique({
        where: { organizationId: orgId },
      });
      if (!config) {
        return NextResponse.json({
          success: false,
          error: "No credentials provided and no stored config found",
        });
      }
      resolvedAccessKey = decrypt(config.accessKey);
      resolvedSecretKey = decrypt(config.secretKey);
    }

    const provider = new S3StorageProvider({
      bucket,
      region: region || "auto",
      endpoint,
      accessKey: resolvedAccessKey,
      secretKey: resolvedSecretKey,
    });

    // Upload a tiny test file then delete it to verify read/write access
    const testKey = `.asset-tracker-test-${crypto.randomUUID()}.txt`;
    const testContent = Buffer.from("connection-test");

    await provider.upload(testKey, testContent, "text/plain");
    await provider.delete(testKey);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Connection failed";
    if (message.startsWith("Forbidden")) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }
    return NextResponse.json({ success: false, error: message });
  }
}

export const dynamic = "force-dynamic";
