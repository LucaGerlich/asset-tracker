// Safety checks that run before the seed touches any database.

const CONFIRM_VARIABLE = "DEMO_SEED_CONFIRM";

/** Throws unless the operator explicitly confirmed with DEMO_SEED_CONFIRM=yes. */
function assertDemoSeedConfirmed(env) {
  if (env[CONFIRM_VARIABLE] !== "yes") {
    throw new Error(
      `Refusing to run: set ${CONFIRM_VARIABLE}=yes to confirm. The demo seed deletes and recreates all organizations whose slug starts with "demo-".`,
    );
  }
}

/** Returns the connection string or throws when it is missing. */
function requireDatabaseUrl(env) {
  const url = env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set.");
  }
  return url;
}

/**
 * Human-readable target of a connection string: host, port and database
 * name. Never includes user name or password.
 */
function describeDatabaseTarget(connectionString) {
  try {
    const url = new URL(connectionString);
    const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
    const port = url.port || "5432";
    return `${url.hostname}:${port}/${database}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

module.exports = {
  CONFIRM_VARIABLE,
  assertDemoSeedConfirmed,
  requireDatabaseUrl,
  describeDatabaseTarget,
};
