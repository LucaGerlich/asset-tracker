import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  requireApiAdmin,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { createAutomationRuleSchema, validateBody } from "@/lib/validation";

export async function GET() {
  try {
    const user = await requireApiAdmin();

    // A user without an organization owns no rules. Never pass an undefined
    // organizationId to Prisma: it would drop the filter and list every org.
    const orgId = user.organizationId;
    if (!orgId) return NextResponse.json([], { status: 200 });

    const rules = await prisma.automationRule.findMany({
      where: { organizationId: orgId },
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

    const orgId = user.organizationId;
    if (!orgId) {
      return NextResponse.json(
        { error: "An organization is required to create automation rules" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const validated = validateBody(createAutomationRuleSchema, body);
    if (validated instanceof NextResponse) return validated;
    const { name, description, trigger, conditions, actions, isActive } =
      validated;

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
        isActive,
        createdBy: user.id!,
        organizationId: orgId,
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
