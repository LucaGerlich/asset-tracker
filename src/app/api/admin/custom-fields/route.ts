import { NextRequest, NextResponse } from "next/server";
import {
  requireApiAdmin,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import prisma from "@/lib/prisma";
import {
  createCustomFieldDefinitionSchema,
  validateBody,
} from "@/lib/validation";

export async function GET() {
  try {
    const user = await requireApiAdmin();

    // A user without an organization owns no definitions. Never pass an
    // undefined organizationId to Prisma: it would drop the filter and list
    // every org.
    const orgId = user.organizationId;
    if (!orgId) return NextResponse.json([]);

    const definitions = await prisma.custom_field_definitions.findMany({
      where: { organizationId: orgId },
      orderBy: [{ entityType: "asc" }, { displayOrder: "asc" }],
    });

    return NextResponse.json(definitions);
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    return NextResponse.json(
      { error: "Failed to fetch custom field definitions" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const user = await requireApiAdmin();
    await requireWritableOrg(user);

    const orgId = user.organizationId;
    if (!orgId) {
      return NextResponse.json(
        { error: "An organization is required to create custom fields" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const validated = validateBody(createCustomFieldDefinitionSchema, body);
    if (validated instanceof NextResponse) return validated;
    const { name, fieldType, entityType, isRequired, options, displayOrder } =
      validated;

    const definition = await prisma.custom_field_definitions.create({
      data: {
        name,
        fieldType,
        entityType,
        isRequired,
        options,
        displayOrder,
        organizationId: orgId,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(definition, { status: 201 });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    return NextResponse.json(
      { error: "Failed to create custom field definition" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
