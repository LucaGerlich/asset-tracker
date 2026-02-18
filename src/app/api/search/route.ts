import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import prisma from "@/lib/prisma";
import { getOrganizationContext, scopeToOrganization } from "@/lib/organization-context";

interface SearchResult {
  type: "asset" | "user" | "consumable";
  id: string;
  label: string;
  sublabel?: string;
  href: string;
}

export async function GET(req: Request) {
  try {
    await requireApiAuth();
    const orgContext = await getOrganizationContext();
    const orgId = orgContext?.organization?.id;

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const results: SearchResult[] = [];

    // Search assets (max 3)
    const assets = await prisma.asset.findMany({
      where: scopeToOrganization({
        OR: [
          { assetname: { contains: query, mode: "insensitive" } },
          { assettag: { contains: query, mode: "insensitive" } },
        ],
      }, orgId),
      take: 3,
    });

    assets.forEach((asset) => {
      results.push({
        type: "asset",
        id: asset.assetid,
        label: asset.assetname,
        sublabel: asset.assettag,
        href: `/assets/${asset.assetid}`,
      });
    });

    // Search users (max 3)
    const users = await prisma.user.findMany({
      where: scopeToOrganization({
        OR: [
          { firstname: { contains: query, mode: "insensitive" } },
          { lastname: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
        ],
      }, orgId),
      take: 3,
    });

    users.forEach((user) => {
      results.push({
        type: "user",
        id: user.userid,
        label: `${user.firstname} ${user.lastname}`,
        sublabel: user.email || undefined,
        href: `/user/${user.userid}`,
      });
    });

    // Search consumables (max 2)
    const consumables = await prisma.consumable.findMany({
      where: scopeToOrganization({
        consumablename: { contains: query, mode: "insensitive" },
      }, orgId),
      take: 2,
    });

    consumables.forEach((con) => {
      results.push({
        type: "consumable",
        id: con.consumableid,
        label: con.consumablename,
        sublabel: `Qty: ${con.quantity}`,
        href: `/consumables/${con.consumableid}`,
      });
    });

    // Ensure max 8 results total
    return NextResponse.json({ results: results.slice(0, 8) });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
