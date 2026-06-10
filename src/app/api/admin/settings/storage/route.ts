import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { requireApiAdmin, requireNotDemoMode } from "@/lib/api-auth";
import { getOrganizationContext } from "@/lib/organization-context";
import { maskSecret } from "@/lib/secrets";
import { logger } from "@/lib/logger";

/**
 * Categorize a storage-config failure into an actionable response. Full details
 * are always logged server-side; the returned message is safe for the (admin-only)
 * caller and points at the concrete cause.
 */
function storageErrorResponse(action: string, error: unknown): NextResponse {
  logger.error(`Storage config ${action} failed`, { error });

  const message = error instanceof Error ? error.message : String(error);

  // Forbidden (non-admin)
  if (message.startsWith("Forbidden")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Encryption key absent at runtime — Vercel isn't injecting it (not set for
  // this environment/scope, or the deployment predates the variable).
  if (message.includes("ENCRYPTION_KEY is required")) {
    return NextResponse.json(
      {
        error:
          "ENCRYPTION_KEY is not present at runtime. Confirm it is set for THIS environment (Production/Preview) on the correct Vercel project, then trigger a NEW deployment — env var changes only apply to fresh builds.",
        code: "encryption_key_absent",
      },
      { status: 503 },
    );
  }

  // Encryption key present but the wrong format.
  if (message.includes("ENCRYPTION_KEY")) {
    return NextResponse.json(
      {
        error:
          "ENCRYPTION_KEY is set but malformed — it must be exactly 64 hex characters (32 bytes), no quotes or whitespace. Re-generate with `openssl rand -hex 32`.",
        code: "encryption_key_malformed",
      },
      { status: 503 },
    );
  }

  // Prisma: table does not exist (migration not applied in this database)
  if (
    typeof (error as { code?: unknown })?.code === "string" &&
    (error as { code: string }).code === "P2021"
  ) {
    return NextResponse.json(
      {
        error:
          "The storage configuration table is missing in this database. Apply the database migration, then retry.",
        code: "table_missing",
      },
      { status: 500 },
    );
  }

  // Fall back to the real message (admin-only endpoint — safe to surface)
  return NextResponse.json(
    { error: `Failed to ${action} storage config: ${message}` },
    { status: 500 },
  );
}

export async function GET() {
  try {
    await requireApiAdmin();
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;
    if (!orgId) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 },
      );
    }

    const config = await prisma.organizationStorageConfig.findUnique({
      where: { organizationId: orgId },
    });

    if (!config) {
      return NextResponse.json({ configured: false });
    }

    return NextResponse.json({
      configured: true,
      provider: config.provider,
      endpoint: config.endpoint,
      bucket: config.bucket,
      region: config.region,
      accessKey: maskSecret(config.accessKey),
      secretKey: maskSecret(config.secretKey),
      isEnabled: config.isEnabled,
    });
  } catch (error) {
    return storageErrorResponse("load", error);
  }
}

export async function PUT(req: Request) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    await requireApiAdmin();
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;
    if (!orgId) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 },
      );
    }

    const body = await req.json();
    const { endpoint, bucket, region, accessKey, secretKey } = body as {
      endpoint: string;
      bucket: string;
      region?: string;
      accessKey: string;
      secretKey: string;
    };

    if (!endpoint || !bucket) {
      return NextResponse.json(
        { error: "endpoint and bucket are required" },
        { status: 400 },
      );
    }

    const existing = await prisma.organizationStorageConfig.findUnique({
      where: { organizationId: orgId },
    });

    // Require credentials on new config; allow omitting them to keep existing values
    if (!existing && (!accessKey || !secretKey)) {
      return NextResponse.json(
        {
          error: "accessKey and secretKey are required for new configurations",
        },
        { status: 400 },
      );
    }

    const encryptedAccessKey = accessKey
      ? encrypt(accessKey)
      : existing!.accessKey;
    const encryptedSecretKey = secretKey
      ? encrypt(secretKey)
      : existing!.secretKey;

    if (existing) {
      await prisma.organizationStorageConfig.update({
        where: { organizationId: orgId },
        data: {
          endpoint,
          bucket,
          region: region ?? "auto",
          accessKey: encryptedAccessKey,
          secretKey: encryptedSecretKey,
          isEnabled: true,
        },
      });
    } else {
      await prisma.organizationStorageConfig.create({
        data: {
          organizationId: orgId,
          provider: "s3",
          endpoint,
          bucket,
          region: region ?? "auto",
          accessKey: encryptedAccessKey,
          secretKey: encryptedSecretKey,
          isEnabled: true,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return storageErrorResponse("save", error);
  }
}

export async function DELETE() {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    await requireApiAdmin();
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;
    if (!orgId) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 },
      );
    }

    await prisma.organizationStorageConfig.deleteMany({
      where: { organizationId: orgId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return storageErrorResponse("remove", error);
  }
}

export const dynamic = "force-dynamic";
