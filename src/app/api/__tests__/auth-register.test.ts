import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

// Mock all dependencies before imports
vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findFirst: vi.fn(), create: vi.fn() },
    organization: { create: vi.fn() },
  },
}));

vi.mock("@/lib/api-auth", () => ({
  requireNotDemoMode: vi.fn().mockReturnValue(null),
}));

vi.mock("@/lib/rate-limit", () => ({
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
  checkRateLimit: vi.fn().mockReturnValue({ success: true }),
  createRateLimitResponse: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/auth-utils", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed_password"),
}));

import { POST } from "@/app/api/auth/register/route";
import prisma from "@/lib/prisma";
import { checkRateLimit, createRateLimitResponse } from "@/lib/rate-limit";

const mockPrisma = vi.mocked(prisma);
const mockCheckRateLimit = vi.mocked(checkRateLimit);

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRateLimit.mockReturnValue({ success: true } as any);
});

describe("POST /api/auth/register", () => {
  const validBody = {
    firstname: "Test",
    lastname: "User",
    email: "test@example.com",
    organization: "Test Corp",
    username: "testuser",
    password: "SecurePass123!",
  };

  it("returns 201 on successful registration", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.organization.create.mockResolvedValue({
      id: "new-org-id",
    } as any);
    mockPrisma.user.create.mockResolvedValue({ userid: "new-user-id" } as any);

    const req = createMockRequest("/api/auth/register", {
      method: "POST",
      body: validBody,
    });
    const res = await POST(req);
    const { status, body } = await parseResponse<any>(res);
    expect(status).toBe(201);
    expect(body.message).toContain("successful");
  });

  it("returns 409 for duplicate username", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      userid: "existing",
      username: "testuser",
    } as any);

    const req = createMockRequest("/api/auth/register", {
      method: "POST",
      body: validBody,
    });
    const res = await POST(req);
    const { status, body } = await parseResponse<any>(res);
    expect(status).toBe(409);
    expect(body.message).toContain("already taken");
  });

  it("returns 400 for missing required fields", async () => {
    const req = createMockRequest("/api/auth/register", {
      method: "POST",
      body: { email: "test@example.com" },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(400);
  });

  it("returns 400 for invalid email", async () => {
    const req = createMockRequest("/api/auth/register", {
      method: "POST",
      body: { ...validBody, email: "not-an-email" },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(400);
  });

  it("returns 400 for password too short", async () => {
    const req = createMockRequest("/api/auth/register", {
      method: "POST",
      body: { ...validBody, password: "short" },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(400);
  });

  it("returns rate limit response when rate limited", async () => {
    mockCheckRateLimit.mockReturnValue({
      success: false,
      retryAfter: 3600,
    } as any);

    vi.mocked(createRateLimitResponse).mockReturnValue(
      new Response(JSON.stringify({ error: "Rate limited" }), { status: 429 }),
    );

    const req = createMockRequest("/api/auth/register", {
      method: "POST",
      body: validBody,
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
  });
});
