import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/logger");
vi.mock("@/lib/api-auth", () => ({
  requireNotDemoMode: vi.fn().mockReturnValue(null),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock("@/lib/auth-utils", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed"),
  setUserPasswordHashed: vi.fn().mockResolvedValue(undefined),
}));

import { POST as resetPassword } from "@/app/api/auth/reset-password/route";
import { POST as setPassword } from "@/app/api/auth/set-password/route";
import prisma from "@/lib/prisma";
import { setUserPasswordHashed } from "@/lib/auth-utils";

const mockPrisma = vi.mocked(prisma, true);

const USER_ID = "user-uuid-001";
const TOKEN = "3f6b0f0e-8f4e-4c55-9d4b-0b5a8f2e7c11";
const NEW_PASSWORD = "a-brand-new-password-1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/auth/reset-password", () => {
  const req = () =>
    createMockRequest("/api/auth/reset-password", {
      method: "POST",
      body: {
        token: "reset-token",
        email: "u@example.com",
        password: NEW_PASSWORD,
      },
    });

  it("revokes every session of the user after a successful reset", async () => {
    mockPrisma.verification.findFirst.mockResolvedValue({
      identifier: "u@example.com",
      value: "reset-token",
      expiresAt: new Date(Date.now() + 60_000),
    } as never);
    mockPrisma.user.findFirst.mockResolvedValue({ userid: USER_ID } as never);

    const res = await resetPassword(req());

    expect(res.status).toBe(200);
    expect(setUserPasswordHashed).toHaveBeenCalled();
    expect(mockPrisma.sessions.deleteMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
    });
  });

  it("does not touch sessions when the token is invalid", async () => {
    mockPrisma.verification.findFirst.mockResolvedValue(null);

    const res = await resetPassword(req());

    expect(res.status).toBe(400);
    expect(mockPrisma.sessions.deleteMany).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/set-password", () => {
  const req = () =>
    createMockRequest("/api/auth/set-password", {
      method: "POST",
      body: { token: TOKEN, password: NEW_PASSWORD },
    });

  it("revokes every session of the user after the password is set", async () => {
    mockPrisma.verification.findFirst.mockResolvedValue({
      id: "ver-1",
      identifier: `set-password:${USER_ID}`,
      value: TOKEN,
      expiresAt: new Date(Date.now() + 60_000),
    } as never);

    const res = await setPassword(req());
    const { status } = await parseResponse(res);

    expect(status).toBe(200);
    expect(mockPrisma.sessions.deleteMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
    });
    expect(mockPrisma.verification.delete).toHaveBeenCalledWith({
      where: { id: "ver-1" },
    });
  });

  it("does not touch sessions when the link is invalid", async () => {
    mockPrisma.verification.findFirst.mockResolvedValue(null);

    const res = await setPassword(req());

    expect(res.status).toBe(400);
    expect(mockPrisma.sessions.deleteMany).not.toHaveBeenCalled();
  });
});
