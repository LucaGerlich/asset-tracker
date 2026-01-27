#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";
import readline from "readline";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error("Error: DATABASE_URL environment variable is not set!");
  console.error("Please check your .env file.");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function createAdmin() {
  console.log("\n=== Create Admin User ===\n");

  try {
    // Get user details
    const username = await question("Username: ");
    const email = await question("Email: ");
    const firstname = await question("First Name: ");
    const lastname = await question("Last Name: ");
    const password = await question("Password: ");
    const lan = await question("LAN (optional, press Enter to skip): ");

    if (!username || !password || !firstname || !lastname) {
      console.error("\nError: Username, password, firstname, and lastname are required!");
      process.exit(1);
    }

    // Hash the password
    console.log("\nHashing password...");
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create the user
    console.log("Creating admin user...");
    const user = await prisma.user.create({
      data: {
        username,
        email: email || null,
        firstname,
        lastname,
        lan: lan || null,
        password: hashedPassword,
        isadmin: true,
        canrequest: true,
        creation_date: new Date(),
      },
    });

    console.log("\n✓ Admin user created successfully!");
    console.log("\nUser details:");
    console.log(`  ID: ${user.userid}`);
    console.log(`  Username: ${user.username}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Name: ${user.firstname} ${user.lastname}`);
    console.log(`  Admin: ${user.isadmin}`);
    console.log("\nYou can now log in with these credentials.");
  } catch (error) {
    console.error("\n=== Error Details ===");
    console.error("Error code:", error.code);
    console.error("Error message:", error.message);
    console.error("\nFull error:");
    console.error(error);

    if (error.code === "P2002") {
      console.error("\nA user with this username or email already exists!");
    }
    process.exit(1);
  } finally {
    await pool.end();
    await prisma.$disconnect();
    rl.close();
  }
}

createAdmin();
