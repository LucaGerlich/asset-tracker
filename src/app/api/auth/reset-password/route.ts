import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/auth-utils";
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

    // Atomic transaction: find token, validate, update password, delete token
    const result = await prisma.$transaction(async (tx) => {
      const verificationToken = await tx.verification_tokens.findFirst({
        where: { identifier: normalizedEmail, token },
      });

      if (!verificationToken) {
        return { error: "Invalid or expired reset link", status: 400 };
      }

      if (verificationToken.expires < new Date()) {
        await tx.verification_tokens.deleteMany({
          where: {
            identifier: verificationToken.identifier,
            token: verificationToken.token,
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

      await tx.user.update({
        where: { userid: user.userid },
        data: { password: hashedPassword, change_date: new Date() },
      });

      await tx.verification_tokens.deleteMany({
        where: {
          identifier: verificationToken.identifier,
          token: verificationToken.token,
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
