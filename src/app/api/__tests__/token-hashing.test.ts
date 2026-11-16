import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/logger");
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("@/lib/api-auth", () => ({
  requireNotDemoMode: vi.fn().mockReturnValue(null),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  rateLimiters: { passwordReset: {} },
}));
vi.mock("@/lib/auth-utils", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed"),
  setUserPasswordHashed: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
  queueEmail: vi.fn(),
  renderTemplate: vi.fn((_html: string, vars: Record<string, string>) =>
    JSON.stringify(vars),
  ),
  emailTemplates: { passwordReset: { html: "", subject: "s" } },
}));
vi.mock("@/lib/email/service", () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock("@/lib/email/templates", () => ({
  emailTemplates: { setPassword: { subject: "s", html: "" } },
  renderTemplate: vi.fn((_html: string, vars: Record<string, string>) =>
    JSON.stringify(vars),
  ),
  renderTextTemplate: vi.fn(() => "subject"),
}));
vi.mock("@/lib/url", () => ({ getBaseUrl: () => "https://app.test" }));

import { POST as forgotPassword } from "@/app/api/auth/forgot-password/route";
import { POST as resetPassword } from "@/app/api/auth/reset-password/route";
import { POST as setPassword } from "@/app/api/auth/set-password/route";
import { sendSetPasswordLink } from "@/lib/magic-link";
import { sendEmail } from "@/lib/email";
import { sendEmail as sendSetPasswordEmail } from "@/lib/email/service";
import { hashToken } from "@/lib/token-hash";
import prisma from "@/lib/prisma";

const mockPrisma = vi.mocked(prisma, true);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("token hashing at rest", () => {
  it("forgot-password stores the digest but emails the plaintext token", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      userid: "u1",
      email: "u@example.com",
    } as never);

    const res = await forgotPassword(
      createMockRequest("/api/auth/forgot-password", {
        method: "POST",
        body: { email: "u@example.com" },
      }),
    );
    expect(res.status).toBe(200);

    const stored = mockPrisma.verification.create.mock.calls[0][0].data.value;
    const mail = vi.mocked(sendEmail).mock.calls[0][0].html;
    const { resetUrl } = JSON.parse(mail) as { resetUrl: string };
    const plaintext = new URL(resetUrl).searchParams.get("token");

    expect(plaintext).toMatch(/^[0-9a-f]{64}$/);
    expect(stored).toBe(hashToken(plaintext as string));
    expect(stored).not.toBe(plaintext);
  });

  it("reset-password looks the token up by its digest", async () => {
    mockPrisma.verification.findFirst.mockResolvedValue(null);

    await resetPassword(
      createMockRequest("/api/auth/reset-password", {
        method: "POST",
        body: {
          token: "plain-token",
          email: "U@example.com",
          password: "a-brand-new-password-1",
        },
      }),
    );

    expect(mockPrisma.verification.findFirst).toHaveBeenCalledWith({
      where: {
        identifier: "u@example.com",
        value: hashToken("plain-token"),
      },
    });
  });

  it("sendSetPasswordLink stores the digest and emails the plaintext token", async () => {
    await sendSetPasswordLink({
      userId: "u1",
      email: "u@example.com",
      userName: "U",
    });

    const stored = mockPrisma.verification.create.mock.calls[0][0].data.value;
    const html = vi.mocked(sendSetPasswordEmail).mock.calls[0][0].html;
    const { setPasswordUrl } = JSON.parse(html) as { setPasswordUrl: string };
    const plaintext = setPasswordUrl.split("/set-password/")[1];

    expect(stored).toBe(hashToken(plaintext));
    expect(stored).not.toBe(plaintext);
  });

  it("set-password looks the token up by its digest", async () => {
    const token = "3f6b0f0e-8f4e-4c55-9d4b-0b5a8f2e7c11";
    mockPrisma.verification.findFirst.mockResolvedValue(null);

    const res = await setPassword(
      createMockRequest("/api/auth/set-password", {
        method: "POST",
        body: { token, password: "a-brand-new-password-1" },
      }),
    );
    await parseResponse(res);

    expect(mockPrisma.verification.findFirst).toHaveBeenCalledWith({
      where: {
        value: hashToken(token),
        identifier: { startsWith: "set-password:" },
      },
    });
  });
});
