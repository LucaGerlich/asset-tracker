import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

// Determine SSL configuration based on environment
// For Supabase and other cloud providers, SSL is required
const isCloudDatabase = process.env.DATABASE_SSL === "true" || 
  process.env.DATABASE_URL?.includes("supabase") ||
  process.env.DATABASE_URL?.includes("pooler.supabase");

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isCloudDatabase ? { rejectUnauthorized: false } : false
});
const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let prisma: PrismaClient;

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient({ adapter });
} else {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }
  prisma = globalForPrisma.prisma;
}

export default prisma;
