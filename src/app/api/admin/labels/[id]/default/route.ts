import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await prisma.label_templates.updateMany({
      data: { isDefault: false, updatedAt: new Date() },
    });

    const updated = await prisma.label_templates.update({
      where: { id: params.id },
      data: { isDefault: true, updatedAt: new Date() },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("POST /api/admin/labels/[id]/default error:", error);
    return NextResponse.json({ error: "Failed to set default template" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
