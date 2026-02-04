import prisma from "../../../../lib/prisma";
import { Prisma } from "@prisma/client";

// Create asset via POST /api/asset/addAsset
export async function POST(req) {
  try {
    const body = await req.json();
    const { assetname, assettag, serialnumber, ...rest } = body || {};

    if (!assetname || !assettag || !serialnumber) {
      return new Response(
        JSON.stringify({ error: "assetname, assettag and serialnumber are required" }),
        { status: 400 }
      );
    }

    const created = await prisma.asset.create({
      data: {
        assetname,
        assettag,
        serialnumber,
        modelid: rest.modelid ?? null,
        specs: rest.specs ?? null,
        notes: rest.notes ?? null,
        purchaseprice: rest.purchaseprice ?? null,
        purchasedate: rest.purchasedate ? new Date(rest.purchasedate) : null,
        mobile: typeof rest.mobile === "boolean" ? rest.mobile : null,
        requestable: typeof rest.requestable === "boolean" ? rest.requestable : null,
        assetcategorytypeid: rest.assetcategorytypeid ?? null,
        statustypeid: rest.statustypeid ?? null,
        supplierid: rest.supplierid ?? null,
        locationid: rest.locationid ?? null,
        manufacturerid: rest.manufacturerid ?? null,
        creation_date: new Date(),
      } as Prisma.assetUncheckedCreateInput,
    });

    return new Response(JSON.stringify(created), { status: 201 });
  } catch (error) {
    console.error("Error creating asset:", error);
    return new Response(JSON.stringify({ error: "Error creating asset" }), {
      status: 500,
    });
  }
}
