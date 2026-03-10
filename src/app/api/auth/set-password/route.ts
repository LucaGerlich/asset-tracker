import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/auth-utils";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

const setPasswordSchema = z.object({
  token: z.string().uuid(),
  password: z
    .string()
    .min(12, "Password must be at least 12 characters")
    .max(100),
});

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";
    const rl = await checkRateLimit(`set-password:${ip}`, {
      maxRequests: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429 },
      );
    }

    const body = await request.json();
    const parsed = setPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { token, password } = parsed.data;

    const verification = await prisma.verification.findFirst({
      where: {
        value: token,
        identifier: { startsWith: "set-password:" },
      },
    });

    if (!verification) {
      return NextResponse.json(
        { error: "Invalid or expired link" },
        { status: 400 },
      );
    }

    if (new Date() > new Date(verification.expiresAt)) {
      await prisma.verification.delete({ where: { id: verification.id } });
      return NextResponse.json(
        {
          error:
            "This link has expired. Please ask your administrator to send a new one.",
        },
        { status: 400 },
      );
    }

    const userId = verification.identifier.replace("set-password:", "");

    const hashedPassword = await hashPassword(password);

    await prisma.user.update({
      where: { userid: userId },
      data: { password: hashedPassword },
    });

    await prisma.accounts.upsert({
      where: {
        providerId_accountId: {
          providerId: "credential",
          accountId: userId,
        },
      },
      update: { password: hashedPassword },
      create: {
        userId: userId,
        providerId: "credential",
        accountId: userId,
        password: hashedPassword,
      },
    });

    await prisma.verification.delete({ where: { id: verification.id } });

    logger.info("User set password via magic link", { userId });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("POST /api/auth/set-password error", { error });
    return NextResponse.json(
      { error: "Failed to set password" },
      { status: 500 },
    );
  }
}
