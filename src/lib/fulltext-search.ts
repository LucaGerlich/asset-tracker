import prisma from "@/lib/prisma";

/** Upper bound for ids returned by one full-text lookup. */
export const FULLTEXT_RESULT_LIMIT = 1000;

/** Tables with a `search_vector` column, mapped to their primary-key column. */
const FULLTEXT_ID_COLUMNS = {
  asset: "assetid",
  accessories: "accessorieid",
  consumable: "consumableid",
  components: "id",
  licence: "licenceid",
  user: "userid",
} as const;

export type FullTextTable = keyof typeof FULLTEXT_ID_COLUMNS;

/**
 * Ids of the rows in `table` matching `search` through the tsvector index,
 * scoped to one organization and capped at FULLTEXT_RESULT_LIMIT.
 *
 * Table and column names come from the closed map above; the search text and
 * the organization id are bound parameters. Without the organization filter
 * another tenant's matches would fill the result list. A null/undefined
 * `organizationId` matches only org-less rows, like `scopeToOrganization`.
 *
 * Resolves to null when the query fails (e.g. the migration adding
 * `search_vector` has not been applied) so callers can fall back to ILIKE.
 */
export async function searchIdsByFullText(
  table: FullTextTable,
  organizationId: string | null | undefined,
  search: string,
): Promise<string[] | null> {
  const idColumn = FULLTEXT_ID_COLUMNS[table];
  const tsQuery = search.trim().split(/\s+/).join(" & ");
  const orgFilter = organizationId
    ? `"organizationId" = $2`
    : `"organizationId" IS NULL`;
  const params = organizationId ? [tsQuery, organizationId] : [tsQuery];

  try {
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, string>>>(
      `SELECT "${idColumn}" FROM "${table}" WHERE "search_vector" @@ websearch_to_tsquery('english', $1) AND ${orgFilter} LIMIT ${FULLTEXT_RESULT_LIMIT}`,
      ...params,
    );
    return rows.map((row) => row[idColumn]);
  } catch {
    return null;
  }
}
