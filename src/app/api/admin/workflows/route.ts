import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  requireApiAdmin,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    await requireApiAdmin();

    const rules = await prisma.automationRule.findMany({
      include: {
        creator: {
          select: {
            userid: true,
            firstname: true,
            lastname: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(rules, { status: 200 });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("GET /api/admin/workflows error", { error });
    return NextResponse.json(
      { error: "Failed to fetch automation rules" },
      { status: 500 },
    );
  }
}

// POST /api/admin/workflows - Create a new automation rule
export async function POST(req: Request) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const user = await requireApiAdmin();
    await requireWritableOrg(user);
    const body = await req.json();
    const { name, description, trigger, conditions, actions } = body;

    if (!name || !trigger) {
      return NextResponse.json(
        { error: "Name and trigger are required" },
        { status: 400 },
      );
    }

    const rule = await prisma.automationRule.create({
      data: {
        name,
        description: description || null,
        trigger,
        conditions:
          typeof conditions === "string"
            ? conditions
            : JSON.stringify(conditions || {}),
        actions:
          typeof actions === "string" ? actions : JSON.stringify(actions || []),
        createdBy: user.id!,
      },
      include: {
        creator: {
          select: {
            userid: true,
            firstname: true,
            lastname: true,
          },
        },
      },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("POST /api/admin/workflows error", { error });
    return NextResponse.json(
      { error: "Failed to create automation rule" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
