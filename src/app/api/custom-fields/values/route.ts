import { NextRequest, NextResponse } from "next/server";
import {
  requireApiAuth,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import prisma from "@/lib/prisma";
import { verifyEntityOrgOwnership } from "@/lib/organization-context";
import { isGuid } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiAuth();

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: "entityType and entityId are required" },
        { status: 400 },
      );
    }

    // A user without an organization owns no entities and no definitions.
    // Never pass an undefined organizationId to Prisma: it would drop the
    // filter and match every org.
    const orgId = user.organizationId;
    if (!orgId) return NextResponse.json([]);

    // Verify entity belongs to user's organization
    const entityOwned = await verifyEntityOrgOwnership(
      entityType,
      entityId,
      orgId,
    );
    if (!entityOwned) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    const definitions = await prisma.custom_field_definitions.findMany({
      where: {
        entityType,
        isActive: true,
        organizationId: orgId,
      },
      orderBy: { displayOrder: "asc" },
    });

    const values = await prisma.custom_field_values.findMany({
      where: { entityId },
    });

    const valueMap = new Map(values.map((v) => [v.fieldId, v.value]));

    const result = definitions.map((def) => ({
      id: def.id,
      name: def.name,
      fieldType: def.fieldType,
      options: def.options,
      isRequired: def.isRequired,
      displayOrder: def.displayOrder,
      value: valueMap.get(def.id) ?? null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    return NextResponse.json(
      { error: "Failed to fetch custom field values" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const user = await requireApiAuth();
    await requireWritableOrg(user);

    const orgId = user.organizationId;
    if (!orgId) {
      return NextResponse.json(
        { error: "An organization is required to save custom field values" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { entityId, entityType, values } = body;

    if (!entityId || !entityType || !values) {
      return NextResponse.json(
        { error: "entityId, entityType, and values are required" },
        { status: 400 },
      );
    }

    if (typeof values !== "object" || Array.isArray(values)) {
      return NextResponse.json(
        { error: "values must be an object keyed by field id" },
        { status: 400 },
      );
    }

    // Verify entity belongs to user's organization
    const entityOwned = await verifyEntityOrgOwnership(
      entityType,
      entityId,
      orgId,
    );
    if (!entityOwned) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    // Every field must be an active definition of this organization for this
    // entity type. The request is all-or-nothing: one unknown field rejects it.
    const fieldIds = Object.keys(values);
    const wellFormed = fieldIds.filter(isGuid);
    const fields =
      wellFormed.length > 0
        ? await prisma.custom_field_definitions.findMany({
            where: {
              id: { in: wellFormed },
              organizationId: orgId,
              entityType,
              isActive: true,
            },
            select: { id: true },
          })
        : [];
    const allowed = new Set(fields.map((f) => f.id));
    const foreign = fieldIds.filter((id) => !allowed.has(id));
    if (foreign.length > 0) {
      return NextResponse.json(
        { error: "Unknown custom fields", fieldIds: foreign },
        { status: 400 },
      );
    }

    let count = 0;

    for (const fieldId of fieldIds) {
      const value = values[fieldId];

      await prisma.custom_field_values.upsert({
        where: {
          fieldId_entityId: {
            fieldId,
            entityId,
          },
        },
        create: {
          fieldId,
          entityId,
          value,
          updatedAt: new Date(),
        },
        update: {
          value,
          updatedAt: new Date(),
        },
      });

      count++;
    }

    return NextResponse.json({ success: true, count });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    return NextResponse.json(
      { error: "Failed to save custom field values" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
