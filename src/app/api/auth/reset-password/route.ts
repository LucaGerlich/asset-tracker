import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword, setUserPasswordHashed } from "@/lib/auth-utils";
import { requireNotDemoMode } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

export async function POST(req: Request) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const { token, email, password } = await req.json();

    if (!token || !email || !password) {
      return NextResponse.json(
        { error: "Token, email, and password are required" },
        { status: 400 },
      );
    }

    if (typeof password !== "string" || password.length < 12) {
      return NextResponse.json(
        { error: "Password must be at least 12 characters" },
        { status: 400 },
      );
    }

    // Hash password before transaction to minimize transaction duration
    const normalizedEmail = email.toLowerCase().trim();
    const hashedPassword = await hashPassword(password);

    // Atomic transaction: find token, validate, update password (both user + accounts), delete token
    const result = await prisma.$transaction(async (tx) => {
      const verificationToken = await tx.verification.findFirst({
        where: { identifier: normalizedEmail, value: token },
      });

      if (!verificationToken) {
        return { error: "Invalid or expired reset link", status: 400 };
      }

      if (verificationToken.expiresAt < new Date()) {
        await tx.verification.deleteMany({
          where: {
            identifier: verificationToken.identifier,
            value: verificationToken.value,
          },
        });
        return {
          error: "Reset link has expired. Please request a new one.",
          status: 400,
        };
      }

      const user = await tx.user.findFirst({
        where: { email: normalizedEmail },
      });

      if (!user) {
        return { error: "Invalid or expired reset link", status: 400 };
      }

      // Writes both user.password AND accounts.password — BetterAuth verifies against accounts.
      await setUserPasswordHashed(user.userid, hashedPassword, tx);

      // Whoever held the old password (or a stolen session) must not stay in.
      await tx.sessions.deleteMany({ where: { userId: user.userid } });

      await tx.verification.deleteMany({
        where: {
          identifier: verificationToken.identifier,
          value: verificationToken.value,
        },
      });

      return null;
    });

    if (result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json(
      { message: "Password has been reset successfully" },
      { status: 200 },
    );
  } catch (error) {
    logger.error("POST /api/auth/reset-password error", { error });
    return NextResponse.json(
      { error: "Failed to reset password" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
