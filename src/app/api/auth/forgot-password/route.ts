import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import prisma from "@/lib/prisma";
import { queueEmail, emailTemplates, renderTemplate } from "@/lib/email";
import { checkRateLimit, rateLimiters } from "@/lib/rate-limit";
import { headers } from "next/headers";

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "unknown";

    const rateLimit = checkRateLimit(`password-reset:${ip}`, rateLimiters.passwordReset);
    if (!rateLimit.success) {
      return NextResponse.json(
        { message: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { message: "If an account with that email exists, we've sent a password reset link." },
        { status: 200 }
      );
    }

    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase().trim() },
    });

    if (user) {
      // Delete any existing tokens for this user
      await prisma.verification_tokens.deleteMany({
        where: { identifier: user.email! },
      });

      // Generate token
      const token = randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.verification_tokens.create({
        data: {
          identifier: user.email!,
          token,
          expires,
        },
      });

      // Build reset URL
      const baseUrl = headersList.get("origin") || headersList.get("host") || "http://localhost:3000";
      const protocol = baseUrl.startsWith("http") ? "" : "https://";
      const resetUrl = `${protocol}${baseUrl}/reset-password?token=${token}&email=${encodeURIComponent(user.email!)}`;

      // Send email
      const html = renderTemplate(emailTemplates.passwordReset.html, { resetUrl });
      const subject = emailTemplates.passwordReset.subject;

      await queueEmail(
        user.userid,
        "password_reset",
        user.email!,
        subject,
        html
      );
    }

    // Always return same response to prevent email enumeration
    return NextResponse.json(
      { message: "If an account with that email exists, we've sent a password reset link." },
      { status: 200 }
    );
  } catch (error) {
    console.error("POST /api/auth/forgot-password error:", error);
    return NextResponse.json(
      { message: "If an account with that email exists, we've sent a password reset link." },
      { status: 200 }
    );
  }
}

export const dynamic = "force-dynamic";
