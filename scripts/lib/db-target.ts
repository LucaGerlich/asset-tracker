import type { ClientBase } from "pg";

/**
 * Guards for scripts that write to a database: an explicit schema, a printed
 * target without credentials, and a column fingerprint check. The host of
 * DATABASE_URL is never trusted (see scope-automation-migration.test.ts).
 */

const SCHEMA_NAME = /^[a-z_][a-z0-9_]{0,62}$/;

export function parseSchemaName(value: string | undefined): string {
  if (!value || !SCHEMA_NAME.test(value)) {
    throw new Error(
      "--schema is required: a lowercase Postgres schema name such as public or assettool",
    );
  }
  return value;
}

export function describeTarget(
  connectionString: string,
  schema: string,
): string {
  const url = new URL(connectionString);
  const database = url.pathname.replace(/^\//, "") || "postgres";
  return `${url.hostname}:${url.port || "5432"}/${database}/${schema}`;
}

export function qualified(schema: string, table: string): string {
  return `"${parseSchemaName(schema)}"."${table}"`;
}

export async function assertColumns(
  client: ClientBase,
  schema: string,
  table: string,
  columns: readonly string[],
): Promise<void> {
  const result = await client.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2`,
    [schema, table],
  );
  const present = new Set(result.rows.map((row) => row.column_name));
  const missing = columns.filter((column) => !present.has(column));
  if (missing.length > 0) {
    throw new Error(
      `${schema}.${table} is missing ${missing.join(", ")}. ` +
        "Wrong schema, or the migration has not been applied.",
    );
  }
}
