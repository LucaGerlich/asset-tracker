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

// Schema names we know how to detect/rewrite. Any of these may appear as the
// "current" name in a given file — we don't assume every file shares one
// single SOURCE, we detect it per file so a partially-normalized tree (or a
// tree using a different historical schema name than schema.prisma) is still
// normalized correctly.
const KNOWN_SCHEMA_NAMES = ["assettool", "public"];

function detectSourceSchema(content, patternFor) {
  for (const name of KNOWN_SCHEMA_NAMES) {
    if (name !== TARGET && patternFor(name).test(content)) {
      return name;
    }
  }
  return null;
}

const schemaPath = join(__dirname, "schema.prisma");
const originalSchema = readFileSync(schemaPath, "utf-8");
let schema = originalSchema;

// Extract the current schema name from: schemas = ["<name>"]
const schemasMatch = schema.match(/schemas\s*=\s*\["([^"]+)"\]/);
const SOURCE = schemasMatch ? schemasMatch[1] : detectSourceSchema(
  schema,
  (name) => new RegExp(`@@schema\\("${name}"\\)`),
);

if (SOURCE && SOURCE !== TARGET) {
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
}

if (schema !== originalSchema) {
  writeFileSync(schemaPath, schema);
}

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

    // Detect which known schema name this specific file currently uses —
    // migrations may lag behind schema.prisma or use a different name.
    const fileSource = detectSourceSchema(
      sql,
      (name) => new RegExp(`"${name}"`),
    );

    if (fileSource && fileSource !== TARGET) {
      // CREATE SCHEMA IF NOT EXISTS "<source>"  →  "<target>"
      sql = sql.replace(
        new RegExp(`CREATE SCHEMA IF NOT EXISTS "${fileSource}"`, "g"),
        `CREATE SCHEMA IF NOT EXISTS "${TARGET}"`,
      );

      // SET search_path TO "<source>"  →  "<target>"
      sql = sql.replace(
        new RegExp(`SET search_path TO "${fileSource}"`, "g"),
        `SET search_path TO "${TARGET}"`,
      );

      // table_schema = '<source>'  →  '<target>'
      sql = sql.replace(
        new RegExp(`table_schema = '${fileSource}'`, "g"),
        `table_schema = '${TARGET}'`,
      );

      // "<source>"."table_name"  →  "<target>"."table_name"
      sql = sql.replace(
        new RegExp(`"${fileSource}"\\."`, "g"),
        `"${TARGET}"."`,
      );
    }

    if (sql !== original) {
      writeFileSync(sqlPath, sql);
    }
  }
}
