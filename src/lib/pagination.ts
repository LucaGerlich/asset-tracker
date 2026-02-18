export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Parse pagination-related query parameters from a URLSearchParams object.
 * Defaults: page=1, pageSize=25, sortOrder="asc".
 * pageSize is clamped between 1 and 100. page is clamped to >= 1.
 */
export function parsePaginationParams(
  searchParams: URLSearchParams,
): PaginationParams {
  let page = parseInt(searchParams.get("page") ?? "1", 10);
  if (isNaN(page) || page < 1) page = 1;

  let pageSize = parseInt(searchParams.get("pageSize") ?? "25", 10);
  if (isNaN(pageSize) || pageSize < 1) pageSize = 1;
  if (pageSize > 100) pageSize = 100;

  const sortBy = searchParams.get("sortBy") ?? undefined;

  const rawSortOrder = searchParams.get("sortOrder");
  const sortOrder: "asc" | "desc" =
    rawSortOrder === "desc" ? "desc" : "asc";

  const search = searchParams.get("search") ?? undefined;

  return { page, pageSize, sortBy, sortOrder, search };
}

/**
 * Build Prisma query args (skip, take, orderBy) from pagination params.
 * Only allows sorting by fields listed in `allowedSortFields` to prevent
 * injection of arbitrary field names.
 */
export function buildPrismaArgs(
  params: PaginationParams,
  allowedSortFields: string[],
): { skip: number; take: number; orderBy?: Record<string, "asc" | "desc"> } {
  const skip = (params.page - 1) * params.pageSize;
  const take = params.pageSize;

  let orderBy: Record<string, "asc" | "desc"> | undefined;
  if (params.sortBy && allowedSortFields.includes(params.sortBy)) {
    orderBy = { [params.sortBy]: params.sortOrder ?? "asc" };
  }

  return { skip, take, ...(orderBy ? { orderBy } : {}) };
}

/**
 * Build a standardised paginated response envelope.
 */
export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams,
): PaginatedResponse<T> {
  return {
    data,
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.ceil(total / params.pageSize),
  };
}
