/**
 * Cursor-based pagination utilities for Prisma.
 *
 * Cursor pagination is more efficient than offset-based pagination for large
 * datasets because it doesn't require the database to skip over rows.
 *
 * Usage with any Prisma model:
 *   const result = await cursorPaginate(prisma.asset, {
 *     where: { ... },
 *     orderBy: { creation_date: "desc" },
 *     limit: 25,
 *     cursor: "some-uuid",
 *     cursorField: "assetid",
 *     direction: "forward",
 *   });
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CursorPaginationParams {
  /** The cursor value to start from (exclusive). Omit for the first page. */
  cursor?: string | null;
  /** Number of items to return. Clamped to 1–100, default 25. */
  limit?: number;
  /** Direction of traversal relative to the cursor. Default "forward". */
  direction?: "forward" | "backward";
}

export interface CursorPaginatedResponse<T> {
  items: T[];
  /** Cursor pointing to the last item – pass as `cursor` with direction=forward to get the next page. */
  nextCursor: string | null;
  /** Cursor pointing to the first item – pass as `cursor` with direction=backward to get the previous page. */
  previousCursor: string | null;
  /** Whether there are more items in the current traversal direction. */
  hasMore: boolean;
}

/**
 * Config passed to `cursorPaginate`. The generic keeps the Prisma `where` and
 * `orderBy` types open so it works with any model.
 */
export interface CursorPaginateConfig<Where = unknown, OrderBy = unknown> {
  /** Prisma `where` filter. */
  where?: Where;
  /** Prisma `orderBy` clause. Must be provided so cursor ordering is deterministic. */
  orderBy?: OrderBy;
  /** Name of the unique/sortable field used as the cursor (e.g. "assetid", "id"). */
  cursorField: string;
  /** Number of items per page (1-100, default 25). */
  limit?: number;
  /** Opaque cursor string (the value of `cursorField` for the boundary record). */
  cursor?: string | null;
  /** Pagination direction. Default "forward". */
  direction?: "forward" | "backward";
  /** Prisma `include` clause for eager-loading relations. */
  include?: Record<string, unknown>;
  /** Prisma `select` clause. Mutually exclusive with `include`. */
  select?: Record<string, unknown>;
}

/**
 * Minimal interface describing a Prisma delegate's `findMany` method.
 * This lets `cursorPaginate` work with *any* Prisma model without importing
 * the generated client types.
 */
interface PrismaDelegate {
  findMany(args: Record<string, unknown>): Promise<unknown[]>;
}

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Execute a cursor-paginated query against any Prisma model delegate.
 *
 * ```ts
 * const page = await cursorPaginate(prisma.asset, {
 *   where: { organizationId: orgId },
 *   orderBy: { creation_date: "desc" },
 *   cursorField: "assetid",
 *   limit: 25,
 *   cursor: searchParams.get("cursor"),
 *   direction: "forward",
 * });
 * ```
 */
export async function cursorPaginate<T = unknown>(
  delegate: PrismaDelegate,
  config: CursorPaginateConfig,
): Promise<CursorPaginatedResponse<T>> {
  const {
    where,
    orderBy,
    cursorField,
    cursor,
    direction = "forward",
    include,
    select,
  } = config;

  const limit = clampLimit(config.limit);

  // Build findMany args --------------------------------------------------
  const findArgs: Record<string, unknown> = {
    where,
    orderBy,
    // Fetch one extra item to determine `hasMore`.
    take: (direction === "forward" ? 1 : -1) * (limit + 1),
  };

  if (cursor) {
    findArgs.cursor = { [cursorField]: cursor };
    // skip: 1 makes the cursor exclusive (don't re-include the cursor item).
    findArgs.skip = 1;
  }

  if (include) findArgs.include = include;
  if (select) findArgs.select = select;

  // Execute ---------------------------------------------------------------
  const rows = (await delegate.findMany(findArgs)) as (T &
    Record<string, unknown>)[];

  // Determine hasMore based on the extra row ----------------------------
  const hasMore = rows.length > limit;
  if (hasMore) {
    // Remove the extra sentinel row.
    if (direction === "forward") {
      rows.pop();
    } else {
      rows.shift();
    }
  }

  // Build cursors --------------------------------------------------------
  const firstItem = rows[0] as Record<string, unknown> | undefined;
  const lastItem = rows[rows.length - 1] as Record<string, unknown> | undefined;

  const nextCursor =
    direction === "forward" && hasMore && lastItem
      ? String(lastItem[cursorField])
      : direction === "backward" && firstItem
        ? String(firstItem[cursorField])
        : null;

  const previousCursor =
    direction === "forward" && cursor && firstItem
      ? String(firstItem[cursorField])
      : direction === "backward" && hasMore && firstItem
        ? String(firstItem[cursorField])
        : null;

  return {
    items: rows as T[],
    nextCursor,
    previousCursor,
    hasMore,
  };
}

// ---------------------------------------------------------------------------
// Request-param helpers
// ---------------------------------------------------------------------------

/**
 * Extract cursor-pagination params from a URLSearchParams object.
 *
 * Recognised query keys:
 *  - `cursor`    – opaque cursor string
 *  - `limit`     – items per page (1–100, default 25)
 *  - `direction` – "forward" | "backward" (default "forward")
 *
 * Returns `null` when no cursor-related params are present, making it easy
 * to fall back to offset-based pagination.
 */
export function parseCursorParams(
  searchParams: URLSearchParams,
): CursorPaginationParams | null {
  const cursor = searchParams.get("cursor");
  const directionRaw = searchParams.get("direction");
  const limitRaw = searchParams.get("limit");

  // If none of the cursor-specific params are present, signal "not requested".
  if (!cursor && !directionRaw && !limitRaw) {
    return null;
  }

  const direction: "forward" | "backward" =
    directionRaw === "backward" ? "backward" : "forward";

  return {
    cursor: cursor || null,
    limit: limitRaw ? clampLimit(parseInt(limitRaw, 10)) : 25,
    direction,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function clampLimit(value: number | undefined | null): number {
  if (value === undefined || value === null || isNaN(value)) return 25;
  if (value < 1) return 1;
  if (value > 100) return 100;
  return value;
}
