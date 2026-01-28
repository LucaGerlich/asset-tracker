import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.toLowerCase() || "";
    const type = searchParams.get("type") || "all"; // all, assets, users, accessories, licenses

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const results: Array<{
      id: string;
      type: string;
      title: string;
      subtitle: string;
      href: string;
    }> = [];

    // Search assets
    if (type === "all" || type === "assets") {
      const assets = await prisma.asset.findMany({
        where: {
          OR: [
            { assetname: { contains: query, mode: "insensitive" } },
            { assettag: { contains: query, mode: "insensitive" } },
            { serialnumber: { contains: query, mode: "insensitive" } },
          ],
        },
        take: 10,
      });

      assets.forEach((asset) => {
        results.push({
          id: asset.assetid,
          type: "asset",
          title: asset.assetname,
          subtitle: `Tag: ${asset.assettag} • Serial: ${asset.serialnumber}`,
          href: `/assets/${asset.assetid}`,
        });
      });
    }

    // Search users
    if (type === "all" || type === "users") {
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { firstname: { contains: query, mode: "insensitive" } },
            { lastname: { contains: query, mode: "insensitive" } },
            { username: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ],
        },
        take: 10,
      });

      users.forEach((user) => {
        results.push({
          id: user.userid,
          type: "user",
          title: `${user.firstname} ${user.lastname}`,
          subtitle: user.email || user.username || "No email",
          href: `/user/${user.userid}`,
        });
      });
    }

    // Search accessories
    if (type === "all" || type === "accessories") {
      const accessories = await prisma.accessories.findMany({
        where: {
          OR: [
            { accessoriename: { contains: query, mode: "insensitive" } },
            { accessorietag: { contains: query, mode: "insensitive" } },
          ],
        },
        take: 10,
      });

      accessories.forEach((acc) => {
        results.push({
          id: acc.accessorieid,
          type: "accessory",
          title: acc.accessoriename,
          subtitle: `Tag: ${acc.accessorietag}`,
          href: `/accessories/${acc.accessorieid}`,
        });
      });
    }

    // Search licenses
    if (type === "all" || type === "licenses") {
      const licenses = await prisma.licence.findMany({
        where: {
          OR: [
            { licencekey: { contains: query, mode: "insensitive" } },
            { licensedtoemail: { contains: query, mode: "insensitive" } },
          ],
        },
        include: {
          licenceCategoryType: true,
        },
        take: 10,
      });

      licenses.forEach((lic) => {
        results.push({
          id: lic.licenceid,
          type: "license",
          title: lic.licenceCategoryType.licencecategorytypename,
          subtitle: lic.licencekey || "No license key",
          href: `/licences/${lic.licenceid}`,
        });
      });
    }

    // Search consumables
    if (type === "all" || type === "consumables") {
      const consumables = await prisma.consumable.findMany({
        where: {
          consumablename: { contains: query, mode: "insensitive" },
        },
        take: 10,
      });

      consumables.forEach((con) => {
        results.push({
          id: con.consumableid,
          type: "consumable",
          title: con.consumablename,
          subtitle: `Qty: ${con.quantity}`,
          href: `/consumables/${con.consumableid}`,
        });
      });
    }

    // Search locations
    if (type === "all" || type === "locations") {
      const locations = await prisma.location.findMany({
        where: {
          OR: [
            { locationname: { contains: query, mode: "insensitive" } },
            { city: { contains: query, mode: "insensitive" } },
          ],
        },
        take: 5,
      });

      locations.forEach((loc) => {
        results.push({
          id: loc.locationid,
          type: "location",
          title: loc.locationname || "Unnamed Location",
          subtitle: [loc.city, loc.country].filter(Boolean).join(", ") || "No address",
          href: `/locations/${loc.locationid}`,
        });
      });
    }

    // Search manufacturers
    if (type === "all" || type === "manufacturers") {
      const manufacturers = await prisma.manufacturer.findMany({
        where: {
          manufacturername: { contains: query, mode: "insensitive" },
        },
        take: 5,
      });

      manufacturers.forEach((man) => {
        results.push({
          id: man.manufacturerid,
          type: "manufacturer",
          title: man.manufacturername,
          subtitle: "Manufacturer",
          href: `/manufacturers/${man.manufacturerid}`,
        });
      });
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("GET /api/search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
