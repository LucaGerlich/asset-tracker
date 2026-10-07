import { NextRequest, NextResponse } from "next/server";
import {
  requireApiAdmin,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    await requireApiAdmin();

    const definitions = await prisma.custom_field_definitions.findMany({
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

    const body = await request.json();
    const { name, fieldType, entityType, isRequired, options, displayOrder } =
      body;

    if (!name || !fieldType) {
      return NextResponse.json(
        { error: "Name and fieldType are required" },
        { status: 400 },
      );
    }

    const definition = await prisma.custom_field_definitions.create({
      data: {
        name,
        fieldType,
        entityType,
        isRequired,
        options,
        displayOrder,
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
