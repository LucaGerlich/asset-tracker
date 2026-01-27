import { NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";

// GET /api/asset/validate?assettag=...&serialnumber=...
export async function GET(req) {
  try {
    const url = req.nextUrl;
    const assettag = url.searchParams.get("assettag");
    const serialnumber = url.searchParams.get("serialnumber");
    const result: Record<string, { exists: boolean }> = {};

    if (assettag) {
      const byTag = await prisma.asset.findUnique({ where: { assettag } });
      result.assettag = { exists: Boolean(byTag) };
    }
    if (serialnumber) {
      const bySerial = await prisma.asset.findUnique({ where: { serialnumber } });
      result.serialnumber = { exists: Boolean(bySerial) };
    }

    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    console.error("GET /api/asset/validate error:", e);
    return NextResponse.json({ error: "Validation error" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";

