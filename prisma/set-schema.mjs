#!/usr/bin/env node
/**
 * Build-time script that substitutes the PostgreSQL schema name in:
 *   - prisma/schema.prisma  (@@schema / schemas directives)
 *   - prisma/migrations/     (CREATE SCHEMA, SET search_path, table_schema refs)
 *
 * Usage:
 *   DB_SCHEMA=assettool node prisma/set-schema.mjs
 *
 * Detects the current schema name from the Prisma schema file and replaces
 * it with the target. Works bidirectionally (public↔assettool or any other name).
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

if (!process.env.DB_SCHEMA) {
  const envPath = resolve(__dirname, "..", ".env");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf-8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const TARGET = process.env.DB_SCHEMA || "assettool";

const schemaPath = join(__dirname, "schema.prisma");
let schema = readFileSync(schemaPath, "utf-8");

// Extract the current schema name from: schemas = ["<name>"]
const schemasMatch = schema.match(/schemas\s*=\s*\["([^"]+)"\]/);
const SOURCE = schemasMatch ? schemasMatch[1] : "assettool";

if (TARGET === SOURCE) {
  process.exit(0);
}

// schemas = ["<source>"]  →  schemas = ["<target>"]
schema = schema.replace(
  new RegExp(`schemas\\s*=\\s*\\["${SOURCE}"\\]`, "g"),
  `schemas  = ["${TARGET}"]`,
);

// @@schema("<source>")  →  @@schema("<target>")
schema = schema.replace(
  new RegExp(`@@schema\\("${SOURCE}"\\)`, "g"),
  `@@schema("${TARGET}")`,
);

writeFileSync(schemaPath, schema);

const migrationsDir = join(__dirname, "migrations");
if (existsSync(migrationsDir)) {
  const migrations = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const migration of migrations) {
    const sqlPath = join(migrationsDir, migration, "migration.sql");
    if (!existsSync(sqlPath)) continue;

    const original = readFileSync(sqlPath, "utf-8");
    let sql = original;

    // CREATE SCHEMA IF NOT EXISTS "<source>"  →  "<target>"
    sql = sql.replace(
      new RegExp(`CREATE SCHEMA IF NOT EXISTS "${SOURCE}"`, "g"),
      `CREATE SCHEMA IF NOT EXISTS "${TARGET}"`,
    );

    // SET search_path TO "<source>"  →  "<target>"
    sql = sql.replace(
      new RegExp(`SET search_path TO "${SOURCE}"`, "g"),
      `SET search_path TO "${TARGET}"`,
    );

    // table_schema = '<source>'  →  '<target>'
    sql = sql.replace(
      new RegExp(`table_schema = '${SOURCE}'`, "g"),
      `table_schema = '${TARGET}'`,
    );

    // "<source>"."table_name"  →  "<target>"."table_name"
    sql = sql.replace(
      new RegExp(`"${SOURCE}"\\."`, "g"),
      `"${TARGET}"."`,
    );

    if (sql !== original) {
      writeFileSync(sqlPath, sql);
    }
  }
}
