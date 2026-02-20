import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/auth-utils";
import { randomBytes } from "crypto";
import {
  checkRateLimit,
  getClientIP,
  createRateLimitResponse,
} from "@/lib/rate-limit";

const registerSchema = z.object({
  firstname: z.string().min(1, "First name is required").max(100),
  lastname: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Invalid email address"),
  organization: z.string().min(1, "Organization name is required").max(100),
  username: z.string().min(3, "Username must be at least 3 characters").max(50),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
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

export async function POST(req: Request) {
  try {
    // Rate limit: 5 registrations per hour per IP
    const ip = getClientIP(req);
    const rl = checkRateLimit(`register:${ip}`, {
      maxRequests: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.success) {
      return createRateLimitResponse(
        rl,
        "Too many registration attempts. Please try again later.",
      );
    }

    const body = await req.json();

    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        { message: firstError.message },
        { status: 400 },
      );
    }

    const { firstname, lastname, email, organization, username, password } =
      parsed.data;

    // Check for existing username or email
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ username: username }, { email: email.toLowerCase().trim() }],
      },
    });

    if (existingUser) {
      const conflict =
        existingUser.username === username ? "Username" : "Email";
      return NextResponse.json(
        { message: `${conflict} is already taken.` },
        { status: 409 },
      );
    }

    const hashedPassword = await hashPassword(password);

    // Create the organization
    const org = await prisma.organization.create({
      data: {
        name: organization,
        slug: generateSlug(organization),
      },
    });

    // Create the user as the first admin of the organization
    await prisma.user.create({
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

    return NextResponse.json(
      { message: "Registration successful" },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/auth/register error:", error);
    return NextResponse.json(
      { message: "An unexpected error occurred. Please try again later." },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
