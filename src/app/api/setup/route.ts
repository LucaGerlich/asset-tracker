import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/auth-utils";
import { randomBytes } from "crypto";
import { logger } from "@/lib/logger";

const setupSchema = z.object({
  firstname: z.string().min(1, "First name is required").max(100),
  lastname: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Invalid email address"),
  organization: z.string().min(1, "Organization name is required").max(100),
  username: z.string().min(3, "Username must be at least 3 characters").max(50),
  password: z
    .string()
    .min(12, "Password must be at least 12 characters")
    .max(128),
});

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const suffix = randomBytes(3).toString("hex");
  return `${base}-${suffix}`.slice(0, 50);
}

/**
 * POST /api/setup
 *
 * Creates the initial admin account and organization on first deployment.
 * This endpoint only works when zero users exist in the database.
 * Once the first admin is created, this endpoint becomes permanently inaccessible.
 */
export async function POST(req: Request) {
  try {
    // Guard: only allow setup when no users exist
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      return NextResponse.json(
        { message: "Setup has already been completed." },
        { status: 403 },
      );
    }

    const body = await req.json();

    const parsed = setupSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        { message: firstError.message },
        { status: 400 },
      );
    }

    const { firstname, lastname, email, organization, username, password } =
      parsed.data;

    const hashedPassword = await hashPassword(password);

    const org = await prisma.organization.create({
      data: {
        name: organization,
        slug: generateSlug(organization),
      },
    });

    const user = await prisma.user.create({
      data: {
        firstname,
        lastname,
        email: email.toLowerCase().trim(),
        username,
        password: hashedPassword,
        isadmin: true,
        canrequest: true,
        organizationId: org.id,
        creation_date: new Date(),
      },
    });

    // Create BetterAuth credential account for email/password login
    await prisma.accounts.create({
      data: {
        userId: user.userid,
        providerId: "credential",
        accountId: user.userid,
        password: hashedPassword,
      },
    });

    logger.info("Initial admin account created via setup wizard", {
      userId: user.userid,
      username: user.username,
    });

    return NextResponse.json(
      { message: "Setup complete. You can now sign in." },
      { status: 201 },
    );
  } catch (error) {
    logger.error("POST /api/setup error", { error });
    return NextResponse.json(
      { message: "An unexpected error occurred. Please try again later." },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
