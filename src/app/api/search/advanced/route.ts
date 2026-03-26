import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";
import {
  parsePaginationParams,
  buildPaginatedResponse,
} from "@/lib/pagination";
import { logger } from "@/lib/logger";
import {
  SEARCHABLE_FIELDS,
  ENTITY_ID_FIELD,
  type SearchableEntity,
  type SearchFilter,
  type FilterOperator,
} from "@/lib/search-fields";

const VALID_ENTITIES: SearchableEntity[] = [
  "asset",
  "accessory",
  "consumable",
  "licence",
  "component",
];

const VALID_OPS: FilterOperator[] = [
  "eq",
  "neq",
  "gt",
  "lt",
  "gte",
  "lte",
  "contains",
];

/**
 * Turn a filter operator + value into a Prisma where condition for a standard field.
 */
function buildFieldCondition(
  fieldType: "text" | "number" | "date",
  op: FilterOperator,
  rawValue: string,
): unknown {
  if (fieldType === "number") {
    const num = parseFloat(rawValue);
    if (isNaN(num)) return undefined;
    switch (op) {
      case "eq":
        return num;
      case "neq":
        return { not: num };
      case "gt":
        return { gt: num };
      case "lt":
        return { lt: num };
      case "gte":
        return { gte: num };
      case "lte":
        return { lte: num };
      case "contains":
        return num; // fallback to equality for numbers
    }
  }

  if (fieldType === "date") {
    const date = new Date(rawValue);
    if (isNaN(date.getTime())) return undefined;
    switch (op) {
      case "eq":
        // For dates, equals means same day: >= start of day, < next day
        const startOfDay = new Date(date);
        startOfDay.setUTCHours(0, 0, 0, 0);
        const nextDay = new Date(startOfDay);
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);
        return { gte: startOfDay, lt: nextDay };
      case "neq":
        // Not in that day
        const dayStart = new Date(date);
        dayStart.setUTCHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
        return { OR: [{ lt: dayStart }, { gte: dayEnd }] };
      case "gt":
        return { gt: date };
      case "lt":
        return { lt: date };
      case "gte":
        return { gte: date };
      case "lte":
        return { lte: date };
      case "contains":
        return { gte: date }; // fallback
    }
  }

  // text
  switch (op) {
    case "eq":
      return rawValue;
    case "neq":
      return { not: rawValue };
    case "contains":
      return { contains: rawValue, mode: "insensitive" };
    case "gt":
      return { gt: rawValue };
    case "lt":
      return { lt: rawValue };
    case "gte":
      return { gte: rawValue };
    case "lte":
      return { lte: rawValue };
  }
}

/**
 * Look up the field type from SEARCHABLE_FIELDS for a standard field.
 */
function getFieldType(
  entity: SearchableEntity,
  fieldKey: string,
): "text" | "number" | "date" | null {
  const fields = SEARCHABLE_FIELDS[entity];
  const found = fields.find((f) => f.key === fieldKey);
  return found ? found.type : null;
}

/**
 * Get the Prisma model delegate for a given entity.
 */
function getPrismaDelegate(entity: SearchableEntity) {
  switch (entity) {
    case "asset":
      return prisma.asset;
    case "accessory":
      return prisma.accessories;
    case "consumable":
      return prisma.consumable;
    case "licence":
      return prisma.licence;
    case "component":
      return prisma.component;
  }
}

// GET /api/search/advanced?entity=asset&filters=[...]&page=1&pageSize=25
export async function GET(req: NextRequest) {
  try {
    await requireApiAuth();
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const searchParams = req.nextUrl.searchParams;

    // Parse entity
    const entityParam = searchParams.get("entity");
    if (
      !entityParam ||
      !VALID_ENTITIES.includes(entityParam as SearchableEntity)
    ) {
      return NextResponse.json(
        {
          error: `Invalid entity. Must be one of: ${VALID_ENTITIES.join(", ")}`,
        },
        { status: 400 },
      );
    }
    const entity = entityParam as SearchableEntity;

    // Parse filters
    const filtersParam = searchParams.get("filters");
    let filters: SearchFilter[] = [];
    if (filtersParam) {
      try {
        filters = JSON.parse(filtersParam);
      } catch {
        return NextResponse.json(
          { error: "Invalid filters JSON" },
          { status: 400 },
        );
      }
    }

    if (!Array.isArray(filters)) {
      return NextResponse.json(
        { error: "Filters must be an array" },
        { status: 400 },
      );
    }

    // Validate each filter
    for (const f of filters) {
      if (!f.field || !f.op || f.value === undefined || f.value === null) {
        return NextResponse.json(
          { error: "Each filter must have field, op, and value" },
          { status: 400 },
        );
      }
      if (!VALID_OPS.includes(f.op)) {
        return NextResponse.json(
          {
            error: `Invalid operator "${f.op}". Must be one of: ${VALID_OPS.join(", ")}`,
          },
          { status: 400 },
        );
      }
    }

    // Separate standard and custom field filters
    const standardFilters = filters.filter((f) => !f.isCustom);
    const customFilters = filters.filter((f) => f.isCustom);

    // Build the standard where clause
    const where: Record<string, unknown> = scopeToOrganization({}, orgId);

    for (const f of standardFilters) {
      const fieldType = getFieldType(entity, f.field);
      if (!fieldType) {
        return NextResponse.json(
          {
            error: `Unknown field "${f.field}" for entity "${entity}"`,
          },
          { status: 400 },
        );
      }
      const condition = buildFieldCondition(fieldType, f.op, f.value);
      if (condition === undefined) {
        return NextResponse.json(
          {
            error: `Invalid value "${f.value}" for field "${f.field}"`,
          },
          { status: 400 },
        );
      }

      // Handle date neq special case (returns OR condition at field level)
      if (
        fieldType === "date" &&
        f.op === "neq" &&
        typeof condition === "object" &&
        condition !== null &&
        "OR" in condition
      ) {
        const neqCondition = condition as { OR: unknown[] };
        // Wrap in AND to combine with other conditions
        if (!where.AND) {
          where.AND = [];
        }
        (where.AND as unknown[]).push({
          OR: neqCondition.OR.map((c) => ({ [f.field]: c })),
        });
      } else {
        where[f.field] = condition;
      }
    }

    // Handle custom field filters by finding matching entity IDs
    if (customFilters.length > 0) {
      const idField = ENTITY_ID_FIELD[entity];
      let matchingEntityIds: string[] | null = null;

      for (const f of customFilters) {
        // For each custom field filter, query custom_field_values
        const cfWhere: Record<string, unknown> = {
          fieldId: f.field,
        };

        // Custom field values are stored as text, so we do text comparison
        switch (f.op) {
          case "eq":
            cfWhere.value = f.value;
            break;
          case "neq":
            cfWhere.value = { not: f.value };
            break;
          case "contains":
            cfWhere.value = { contains: f.value, mode: "insensitive" };
            break;
          case "gt":
            cfWhere.value = { gt: f.value };
            break;
          case "lt":
            cfWhere.value = { lt: f.value };
            break;
          case "gte":
            cfWhere.value = { gte: f.value };
            break;
          case "lte":
            cfWhere.value = { lte: f.value };
            break;
        }

        const cfValues = await prisma.custom_field_values.findMany({
          where: cfWhere,
          select: { entityId: true },
        });

        const ids = cfValues.map((v) => v.entityId);

        if (matchingEntityIds === null) {
          matchingEntityIds = ids;
        } else {
          // Intersect with previous filter results
          const idSet = new Set(ids);
          matchingEntityIds = matchingEntityIds.filter((id) => idSet.has(id));
        }
      }

      // Apply the custom field constraint to the main query
      where[idField] = {
        in: matchingEntityIds ?? [],
      };
    }

    // Pagination
    const delegate = getPrismaDelegate(entity) as {
      findMany: (args: Record<string, unknown>) => Promise<unknown[]>;
      count: (args: Record<string, unknown>) => Promise<number>;
    };

    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const pageSize = Math.min(
      Math.max(parseInt(searchParams.get("pageSize") ?? "25", 10), 1),
      100,
    );
    const skip = (Math.max(page, 1) - 1) * pageSize;

    const [results, total] = await Promise.all([
      delegate.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: {
          [ENTITY_ID_FIELD[entity] === "id" ? "createdAt" : "creation_date"]:
            "desc" as const,
        },
      }),
      delegate.count({ where }),
    ]);

    return NextResponse.json(
      buildPaginatedResponse(
        results as Record<string, unknown>[],
        total,
        parsePaginationParams(searchParams),
      ),
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    logger.error("GET /api/search/advanced error", { error });
    return NextResponse.json(
      { error: "Advanced search failed" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
