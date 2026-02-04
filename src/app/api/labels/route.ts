import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const templates = await prisma.label_templates.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });

    return NextResponse.json(templates, { status: 200 });
  } catch (error) {
    console.error("GET /api/labels error:", error);
    return NextResponse.json({ error: "Failed to fetch label templates" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
