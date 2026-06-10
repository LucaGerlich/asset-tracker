import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { requireApiAdmin, requireNotDemoMode } from "@/lib/api-auth";
import { getOrganizationContext } from "@/lib/organization-context";
import { maskSecret } from "@/lib/secrets";

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
    if (error instanceof Error && error.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to load storage config" },
      { status: 500 },
    );
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
    if (error instanceof Error && error.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to save storage config" },
      { status: 500 },
    );
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
    if (error instanceof Error && error.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to remove storage config" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
