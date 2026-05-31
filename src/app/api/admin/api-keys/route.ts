import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApiAdmin, requireNotDemoMode } from "@/lib/api-auth";
import { generateApiKey } from "@/lib/api-keys";
import { logger } from "@/lib/logger";
import { PERMISSIONS } from "@/lib/rbac";

// Valid scopes = all RBAC permission keys
const VALID_SCOPES = Object.keys(PERMISSIONS);

// POST /api/admin/api-keys - Create a new API key
export async function POST(req: Request) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const user = await requireApiAdmin();

    const body = await req.json();
    const { name, scopes, expiresAt } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (name.length > 100) {
      return NextResponse.json(
        { error: "Name must be 100 characters or less" },
        { status: 400 },
      );
    }

    if (!scopes || !Array.isArray(scopes) || scopes.length === 0) {
      return NextResponse.json(
        { error: "At least one scope is required" },
        { status: 400 },
      );
    }

    const invalidScopes = scopes.filter(
      (s: string) => !VALID_SCOPES.includes(s),
    );
    if (invalidScopes.length > 0) {
      return NextResponse.json(
        { error: `Invalid scopes: ${invalidScopes.join(", ")}` },
        { status: 400 },
      );
    }

    let parsedExpiry: Date | null = null;
    if (expiresAt) {
      parsedExpiry = new Date(expiresAt);
      if (isNaN(parsedExpiry.getTime()) || parsedExpiry <= new Date()) {
        return NextResponse.json(
          { error: "expiresAt must be a valid future date" },
          { status: 400 },
        );
      }
    }

    const { key, prefix, hash } = await generateApiKey();

    const apiKey = await prisma.apiKey.create({
      data: {
        userId: user.id!,
        name: name.trim(),
        keyPrefix: prefix,
        keyHash: hash,
        scopes,
        expiresAt: parsedExpiry,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        ...apiKey,
        key,
        message: "Store this API key securely. It will not be shown again.",
      },
      { status: 201 },
    );
  } catch (error) {
    logger.error("POST /api/admin/api-keys error", { error });
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes("Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to create API key" },
      { status: 500 },
    );
  }
}

// GET /api/admin/api-keys - List all API keys for the authenticated user
export async function GET() {
  try {
    const user = await requireApiAdmin();

    const keys = await prisma.apiKey.findMany({
      where: { userId: user.id! },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ keys }, { status: 200 });
  } catch (error) {
    logger.error("GET /api/admin/api-keys error", { error });
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes("Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to fetch API keys" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
