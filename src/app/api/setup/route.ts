import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/auth-utils";
import { randomBytes } from "crypto";
import { logger } from "@/lib/logger";

// Internal sentinel thrown inside the setup transaction when another request
// has already created the first admin — caught below and mapped to a 403.
const SETUP_ALREADY_COMPLETED = "SETUP_ALREADY_COMPLETED";

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

    // The "no users exist yet" guard and the org+admin creation run inside a
    // single Serializable transaction so two concurrent setup requests can't
    // both pass the check-then-act guard and create two "initial" admins.
    const user = await prisma.$transaction(
      async (tx) => {
        const userCount = await tx.user.count();
        if (userCount > 0) {
          throw new Error(SETUP_ALREADY_COMPLETED);
        }

        const org = await tx.organization.create({
          data: {
            name: organization,
            slug: generateSlug(organization),
          },
        });

        const createdUser = await tx.user.create({
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
        await tx.accounts.create({
          data: {
            userId: createdUser.userid,
            providerId: "credential",
            accountId: createdUser.userid,
            password: hashedPassword,
          },
        });

        return createdUser;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    logger.info("Initial admin account created via setup wizard", {
      userId: user.userid,
      username: user.username,
    });

    return NextResponse.json(
      { message: "Setup complete. You can now sign in." },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === SETUP_ALREADY_COMPLETED) {
      return NextResponse.json(
        { message: "Setup has already been completed." },
        { status: 403 },
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        { message: "Setup is already in progress. Please try again." },
        { status: 409 },
      );
    }
    logger.error("POST /api/setup error", { error });
    return NextResponse.json(
      { message: "An unexpected error occurred. Please try again later." },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
