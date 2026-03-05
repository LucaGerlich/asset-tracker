/**
 * Create an admin user for initial setup.
 *
 * Usage:
 *   npx tsx prisma/create-admin.ts
 *
 * Environment: Requires DATABASE_URL in .env
 */

import "dotenv/config";
import pg from "pg";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import * as readline from "readline";

const isCloudDatabase =
  process.env.DATABASE_SSL === "true" ||
  process.env.DATABASE_URL?.includes("supabase") ||
  process.env.DATABASE_URL?.includes("pooler.supabase");

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isCloudDatabase ? { rejectUnauthorized: false } : false,
});

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log("\n=== Create Admin User ===\n");

  const email = await ask("Email: ");
  const firstname = await ask("First name: ");
  const lastname = await ask("Last name: ");
  const username = await ask("Username: ");
  const password = await ask("Password (min 12 chars): ");
  const orgName = await ask("Organization name: ");

  if (password.length < 12) {
    console.error("Error: Password must be at least 12 characters.");
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    // Check if user already exists
    const existing = await client.query(
      `SELECT userid FROM "user" WHERE email = $1 OR username = $2 LIMIT 1`,
      [email.toLowerCase(), username],
    );
    if (existing.rows.length > 0) {
      console.error(
        "Error: A user with that email or username already exists.",
      );
      process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const slug =
      orgName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .slice(0, 40) +
      "-" +
      randomBytes(3).toString("hex");

    await client.query("BEGIN");

    // Create organization
    const orgResult = await client.query(
      `INSERT INTO "organizations" (name, slug, "updatedAt") VALUES ($1, $2, NOW()) RETURNING id`,
      [orgName, slug],
    );
    const orgId = orgResult.rows[0].id;

    // Create user
    const userResult = await client.query(
      `INSERT INTO "user" (firstname, lastname, email, username, password, isadmin, canrequest, "organizationId", creation_date)
       VALUES ($1, $2, $3, $4, $5, true, true, $6, NOW())
       RETURNING userid, email, username`,
      [firstname, lastname, email.toLowerCase(), username, hashedPassword, orgId],
    );
    const user = userResult.rows[0];

    // BetterAuth credential account (required for email/password login)
    await client.query(
      `INSERT INTO "accounts" ("userId", "providerId", "accountId", password, "createdAt", "updatedAt")
       VALUES ($1::uuid, 'credential', $2::text, $3, NOW(), NOW())`,
      [user.userid, user.userid, hashedPassword],
    );

    await client.query("COMMIT");

    console.log(`\nAdmin user created successfully!`);
    console.log(`  ID: ${user.userid}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Username: ${user.username}`);
    console.log(`\nYou can now log in at /login\n`);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

main()
  .catch((e) => {
    console.error("Error:", e.message);
    process.exit(1);
  })
  .finally(() => pool.end());
