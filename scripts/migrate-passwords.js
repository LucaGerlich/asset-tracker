/**
 * Password Migration Script
 * 
 * This script migrates all plain-text passwords in the database to bcrypt hashed passwords.
 * Run this script ONCE after updating the schema but BEFORE deploying authentication.
 * 
 * Usage: node scripts/migrate-passwords.js
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function migratePasswords() {
  console.log("Starting password migration...");

  try {
    // Get all users
    const users = await prisma.user.findMany({
      select: {
        userid: true,
        username: true,
        password: true,
      },
    });

    console.log(`Found ${users.length} users to process`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const user of users) {
      // Check if password is already hashed (bcrypt hashes start with $2a$, $2b$, or $2y$)
      if (user.password.startsWith("$2a$") || user.password.startsWith("$2b$") || user.password.startsWith("$2y$")) {
        console.log(`Skipping user ${user.username} - password already hashed`);
        skippedCount++;
        continue;
      }

      // Hash the plain-text password
      const hashedPassword = await bcrypt.hash(user.password, 12);

      // Update the user's password
      await prisma.user.update({
        where: { userid: user.userid },
        data: { password: hashedPassword },
      });

      console.log(`✓ Migrated password for user: ${user.username}`);
      migratedCount++;
    }

    console.log("\n=== Migration Complete ===");
    console.log(`Total users: ${users.length}`);
    console.log(`Migrated: ${migratedCount}`);
    console.log(`Skipped (already hashed): ${skippedCount}`);
  } catch (error) {
    console.error("Error during password migration:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migratePasswords();
