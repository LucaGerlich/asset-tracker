import { type NextRequest, NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  try {
    await requireApiAuth();
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const searchParams = req.nextUrl.searchParams;
    const categoryId = searchParams.get("categoryId");
    const manufacturerId = searchParams.get("manufacturerId");
    const modelId = searchParams.get("modelId");

    // Look up names
    const [category, manufacturer, model] = await Promise.all([
      categoryId
        ? prisma.assetCategoryType.findUnique({
            where: { assetcategorytypeid: categoryId },
            select: { assetcategorytypename: true },
          })
        : null,
      manufacturerId
        ? prisma.manufacturer.findUnique({
            where: { manufacturerid: manufacturerId },
            select: { manufacturername: true },
          })
        : null,
      modelId
        ? prisma.model.findUnique({
            where: { modelid: modelId },
            select: { modelname: true },
          })
        : null,
    ]);

    // Build prefix parts (abbreviate: remove non-alphanumeric, uppercase, max 10 chars)
    const abbrev = (name: string | null | undefined) =>
      (name || "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase()
        .slice(0, 10);

    const parts = [
      abbrev(category?.assetcategorytypename) || "ASSET",
      abbrev(manufacturer?.manufacturername),
      abbrev(model?.modelname),
    ].filter(Boolean);

    const prefix = parts.join("-");

    // Find existing tags with this prefix
    const existing = await prisma.asset.findMany({
      where: scopeToOrganization(
        { assettag: { startsWith: prefix + "-" } },
        orgId,
      ),
      select: { assettag: true },
    });

    let nextNumber = 1;
    if (existing.length > 0) {
      const numbers = existing
        .map((a) => {
          const match = a.assettag.match(
            new RegExp(
              `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d+)$`,
            ),
          );
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter((n) => n > 0);
      if (numbers.length > 0) {
        nextNumber = Math.max(...numbers) + 1;
      }
    }

    const tag = `${prefix}-${String(nextNumber).padStart(4, "0")}`;

    return NextResponse.json({ tag }, { status: 200 });
  } catch (e) {
    logger.error("GET /api/asset/nextTag error", { error: e });
    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to generate next tag" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
