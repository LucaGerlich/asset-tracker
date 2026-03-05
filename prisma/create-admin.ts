/**
 * Create an admin user for initial setup.
 *
 * Usage:
 *   npx tsx prisma/create-admin.ts
 *
 * Environment: Requires DATABASE_URL in .env
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import * as readline from "readline";

const prisma = new PrismaClient();

function ask(question: string, hidden = false): Promise<string> {
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

  // Check if user already exists
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });
  if (existing) {
    console.error("Error: A user with that email or username already exists.");
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

  // Create org + user + BetterAuth account in a transaction
  const user = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: { name: orgName, slug },
    });

    const newUser = await tx.user.create({
      data: {
        firstname,
        lastname,
        email: email.toLowerCase(),
        username,
        password: hashedPassword,
        isadmin: true,
        canrequest: true,
        organizationId: org.id,
        creation_date: new Date(),
      },
    });

    // BetterAuth credential account (required for email/password login)
    await tx.accounts.create({
      data: {
        userId: newUser.userid,
        providerId: "credential",
        accountId: newUser.userid,
        password: hashedPassword,
      },
    });

    return newUser;
  });

  console.log(`\nAdmin user created successfully!`);
  console.log(`  ID: ${user.userid}`);
  console.log(`  Email: ${user.email}`);
  console.log(`  Username: ${user.username}`);
  console.log(`\nYou can now log in at /login\n`);
}

main()
  .catch((e) => {
    console.error("Error:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
