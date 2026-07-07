import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

// Mock all dependencies before imports
vi.mock("@/lib/prisma");

vi.mock("@/lib/logger");

vi.mock("@/lib/auth-utils", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed_password"),
}));

import { POST } from "@/app/api/setup/route";
import { GET } from "@/app/api/setup/status/route";
import prisma from "@/lib/prisma";

const mockPrisma = vi.mocked(prisma);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/setup/status", () => {
  it("returns needsSetup true when no users exist", async () => {
    mockPrisma.user.count.mockResolvedValue(0);

    const res = await GET();
    const { status, body } = await parseResponse<any>(res);
    expect(status).toBe(200);
    expect(body.needsSetup).toBe(true);
  });

  it("returns needsSetup false when users exist", async () => {
    mockPrisma.user.count.mockResolvedValue(1);

    const res = await GET();
    const { status, body } = await parseResponse<any>(res);
    expect(status).toBe(200);
    expect(body.needsSetup).toBe(false);
  });

  it("returns needsSetup true on database error", async () => {
    mockPrisma.user.count.mockRejectedValue(new Error("DB error"));

    const res = await GET();
    const { status, body } = await parseResponse<any>(res);
    expect(status).toBe(500);
    // On DB failure the route assumes setup is needed rather than redirecting to login.
    expect(body.needsSetup).toBe(true);
  });
});

describe("POST /api/setup", () => {
  const validBody = {
    firstname: "Admin",
    lastname: "User",
    email: "admin@example.com",
    organization: "My Company",
    username: "admin",
    password: "SecurePass123!@",
  };

  it("returns 201 on successful setup", async () => {
    mockPrisma.user.count.mockResolvedValue(0);
    mockPrisma.organization.create.mockResolvedValue({
      id: "org-id",
    } as any);
    mockPrisma.user.create.mockResolvedValue({
      userid: "user-id",
      username: "admin",
    } as any);
    mockPrisma.accounts.create.mockResolvedValue({} as any);

    const req = createMockRequest("/api/setup", {
      method: "POST",
      body: validBody,
    });
    const res = await POST(req);
    const { status, body } = await parseResponse<any>(res);
    expect(status).toBe(201);
    expect(body.message).toContain("Setup complete");
  });

  it("returns 403 when users already exist", async () => {
    mockPrisma.user.count.mockResolvedValue(1);

    const req = createMockRequest("/api/setup", {
      method: "POST",
      body: validBody,
    });
    const res = await POST(req);
    const { status, body } = await parseResponse<any>(res);
    expect(status).toBe(403);
    expect(body.message).toContain("already been completed");
  });

  it("returns 400 for missing required fields", async () => {
    mockPrisma.user.count.mockResolvedValue(0);

    const req = createMockRequest("/api/setup", {
      method: "POST",
      body: { email: "admin@example.com" },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(400);
  });

  it("returns 400 for invalid email", async () => {
    mockPrisma.user.count.mockResolvedValue(0);

    const req = createMockRequest("/api/setup", {
      method: "POST",
      body: { ...validBody, email: "not-an-email" },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(400);
  });

  it("returns 400 for password too short", async () => {
    mockPrisma.user.count.mockResolvedValue(0);

    const req = createMockRequest("/api/setup", {
      method: "POST",
      body: { ...validBody, password: "short" },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(400);
  });

  it("returns 400 for username too short", async () => {
    mockPrisma.user.count.mockResolvedValue(0);

    const req = createMockRequest("/api/setup", {
      method: "POST",
      body: { ...validBody, username: "ab" },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(400);
  });

  it("creates user with isadmin true", async () => {
    mockPrisma.user.count.mockResolvedValue(0);
    mockPrisma.organization.create.mockResolvedValue({
      id: "org-id",
    } as any);
    mockPrisma.user.create.mockResolvedValue({
      userid: "user-id",
      username: "admin",
    } as any);
    mockPrisma.accounts.create.mockResolvedValue({} as any);

    const req = createMockRequest("/api/setup", {
      method: "POST",
      body: validBody,
    });
    await POST(req);

    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isadmin: true,
          canrequest: true,
          username: "admin",
        }),
      }),
    );
  });

  it("creates BetterAuth credential account", async () => {
    mockPrisma.user.count.mockResolvedValue(0);
    mockPrisma.organization.create.mockResolvedValue({
      id: "org-id",
    } as any);
    mockPrisma.user.create.mockResolvedValue({
      userid: "user-id",
      username: "admin",
    } as any);
    mockPrisma.accounts.create.mockResolvedValue({} as any);

    const req = createMockRequest("/api/setup", {
      method: "POST",
      body: validBody,
    });
    await POST(req);

    expect(mockPrisma.accounts.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-id",
          providerId: "credential",
          accountId: "user-id",
          password: "hashed_password",
        }),
      }),
    );
  });
});
