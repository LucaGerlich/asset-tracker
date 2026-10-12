import { NextRequest, NextResponse } from "next/server";
import {
  requireApiAdmin,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import prisma from "@/lib/prisma";
import {
  toggleCustomFieldDefinitionSchema,
  updateCustomFieldDefinitionSchema,
  validateBody,
} from "@/lib/validation";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function definitionNotFound() {
  return NextResponse.json(
    { error: "Custom field definition not found" },
    { status: 404 },
  );
}

/**
 * True when the definition exists in the caller's organization. A user
 * without an organization owns no definitions; the check short-circuits so an
 * undefined organizationId can never reach Prisma, where it would drop the
 * filter and match any org.
 */
async function ownsDefinition(
  id: string,
  organizationId: string | undefined,
): Promise<boolean> {
  if (!organizationId) return false;
  const definition = await prisma.custom_field_definitions.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });
  return definition !== null;
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const user = await requireApiAdmin();
    await requireWritableOrg(user);

    const { id } = await params;
    if (!(await ownsDefinition(id, user.organizationId))) {
      return definitionNotFound();
    }

    const body = await request.json();
    const validated = validateBody(updateCustomFieldDefinitionSchema, body);
    if (validated instanceof NextResponse) return validated;

    const definition = await prisma.custom_field_definitions.update({
      where: { id },
      data: { ...validated, updatedAt: new Date() },
    });

    return NextResponse.json(definition);
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    return NextResponse.json(
      { error: "Failed to update custom field definition" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const user = await requireApiAdmin();
    await requireWritableOrg(user);

    const { id } = await params;
    if (!(await ownsDefinition(id, user.organizationId))) {
      return definitionNotFound();
    }

    const body = await request.json();
    const validated = validateBody(toggleCustomFieldDefinitionSchema, body);
    if (validated instanceof NextResponse) return validated;

    const definition = await prisma.custom_field_definitions.update({
      where: { id },
      data: {
        isActive: validated.isActive,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(definition);
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    return NextResponse.json(
      { error: "Failed to toggle custom field status" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const user = await requireApiAdmin();
    await requireWritableOrg(user);

    const { id } = await params;
    if (!(await ownsDefinition(id, user.organizationId))) {
      return definitionNotFound();
    }

    await prisma.custom_field_definitions.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    return NextResponse.json(
      { error: "Failed to delete custom field definition" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
