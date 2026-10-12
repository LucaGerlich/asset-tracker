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

/**
 * Query parameters that make pg connect somewhere other than the URL says:
 * pg-connection-string lets host and port override the URL, and libpq-style
 * hostaddr, dbname and service name a target as well.
 */
const TARGET_OVERRIDES = ["host", "hostaddr", "port", "dbname", "service"];

/**
 * pg-connection-string (2.14.0) re-encodes the whole string with encodeURI when
 * it holds a space or a malformed percent escape. Every "%" then becomes "%25",
 * so escapes in the host or database name are taken literally and no longer
 * match what is printed here. This is the same test pg runs.
 */
const PG_REENCODES_INPUT = / |%[^a-f0-9]|%[a-f0-9][^a-f0-9]/i;

const POSTGRES_SCHEMES = ["postgres:", "postgresql:"];

function decode(value: string, what: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new Error(`The connection string has a malformed ${what}`);
  }
}

/**
 * Describes where pg will connect, as host:port/database/schema, never with
 * credentials. Throws unless the URL uses the postgres: or postgresql: scheme
 * (pg reads socket: URLs differently), names host, port and database
 * explicitly, and has no query parameter that overrides them: otherwise pg
 * would fall back to PGHOST, PGPORT or localhost, or follow the override, and
 * the printed target would differ from the real one. A percent escape in the
 * host or database name is rejected when the string holds a space or a
 * malformed escape elsewhere (see PG_REENCODES_INPUT).
 */
export function describeTarget(
  connectionString: string,
  schema: string,
): string {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    // Not echoing the input: it contains credentials.
    throw new Error("The connection string is not a valid URL");
  }
  if (!POSTGRES_SCHEMES.includes(url.protocol)) {
    throw new Error(
      "The connection string must use the postgres: or postgresql: scheme",
    );
  }
  if (!url.hostname) {
    throw new Error("The connection string must name the host explicitly");
  }
  if (!url.port) {
    throw new Error("The connection string must name the port explicitly");
  }
  const rawDatabase = url.pathname.replace(/^\//, "");
  if (!rawDatabase) {
    throw new Error("The connection string must name the database explicitly");
  }
  for (const key of url.searchParams.keys()) {
    if (TARGET_OVERRIDES.includes(key.toLowerCase())) {
      throw new Error(
        `The connection string must not use the "${key}" query parameter`,
      );
    }
  }
  if (
    PG_REENCODES_INPUT.test(connectionString) &&
    (url.hostname.includes("%") || rawDatabase.includes("%"))
  ) {
    throw new Error(
      "The connection string has a space or a malformed percent escape, " +
        "so its host and database name must not contain percent escapes",
    );
  }
  const database = decode(rawDatabase, "database name");
  // pg decodes the database name with decodeURI, which keeps encoded reserved
  // characters such as %2F; refuse the names where the two would disagree.
  if (database !== decodeURI(rawDatabase)) {
    throw new Error(
      "The database name in the connection string must not contain encoded reserved characters",
    );
  }
  return `${decode(url.hostname, "host")}:${url.port}/${database}/${schema}`;
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
