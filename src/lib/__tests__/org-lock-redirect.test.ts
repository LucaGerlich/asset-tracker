import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock("@/lib/prisma");
vi.mock("@/lib/logger");

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getLockedRedirect, shouldCheckOrgLock } from "@/lib/org-lock-redirect";

const mockAuth = vi.mocked(auth, true);
const mockPrisma = vi.mocked(prisma, true);

const DAY_MS = 24 * 60 * 60 * 1000;

function pageRequest(path = "/assets"): NextRequest {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

describe("shouldCheckOrgLock", () => {
  it("checks regular page requests", () => {
    expect(shouldCheckOrgLock("/assets", false)).toBe(true);
    expect(shouldCheckOrgLock("/assets/abc-123/edit", false)).toBe(true);
    expect(shouldCheckOrgLock("/dashboard", false)).toBe(true);
  });

  it.each([
    ["/api/assets", false],
    ["/api", false],
    ["/suspended", false],
    ["/suspended/", false],
    ["/login", true],
    ["/_next/static/chunks/main.js", false],
    ["/_next/image", false],
    ["/monitoring", false],
    ["/monitoring/tunnel", false],
    ["/sw.js", false],
    ["/manifest.json", false],
    ["/favicon.ico", false],
    ["/icons/icon-192.png", false],
    ["/logo.svg", false],
  ])("skips %s", (pathname, isPublicRoute) => {
    expect(shouldCheckOrgLock(pathname, isPublicRoute)).toBe(false);
  });

  it("skips any public route", () => {
    expect(shouldCheckOrgLock("/pricing", true)).toBe(false);
  });

  it("does not mistake page routes sharing an api prefix for the API", () => {
    expect(shouldCheckOrgLock("/api-docs", false)).toBe(true);
  });
});

describe("getLockedRedirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SELF_HOSTED;
    mockAuth.api.getSession.mockResolvedValue({
      user: { id: "user-1" },
    } as never);
  });

  afterEach(() => {
    delete process.env.SELF_HOSTED;
  });

  it("returns null without a session", async () => {
    mockAuth.api.getSession.mockResolvedValue(null as never);

    expect(await getLockedRedirect(pageRequest())).toBeNull();
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("returns null for an active org", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      organization: { isActive: true, suspendedAt: null },
    } as never);

    expect(await getLockedRedirect(pageRequest())).toBeNull();
  });

  it("returns null for a read-only org (inside the grace period)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      organization: {
        isActive: true,
        suspendedAt: new Date(Date.now() - 2 * DAY_MS),
      },
    } as never);

    expect(await getLockedRedirect(pageRequest())).toBeNull();
  });

  it("returns null for a user without an organization", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      organization: null,
    } as never);

    expect(await getLockedRedirect(pageRequest())).toBeNull();
  });

  it("redirects a deactivated org to /suspended", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      organization: { isActive: false, suspendedAt: null },
    } as never);

    const url = await getLockedRedirect(pageRequest("/assets"));

    expect(url?.pathname).toBe("/suspended");
    expect(url?.origin).toBe("http://localhost:3000");
  });

  it("redirects an org suspended past the grace period", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      organization: {
        isActive: true,
        suspendedAt: new Date(Date.now() - 30 * DAY_MS),
      },
    } as never);

    const url = await getLockedRedirect(pageRequest());

    expect(url?.pathname).toBe("/suspended");
  });

  it("reads the org with a single user lookup keyed by the session user", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      organization: { isActive: true, suspendedAt: null },
    } as never);

    await getLockedRedirect(pageRequest());

    expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(1);
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { userid: "user-1" },
      select: {
        organization: { select: { isActive: true, suspendedAt: true } },
      },
    });
  });

  it("reads the session from the request headers", async () => {
    const req = pageRequest();
    mockPrisma.user.findUnique.mockResolvedValue({
      organization: { isActive: true, suspendedAt: null },
    } as never);

    await getLockedRedirect(req);

    expect(mockAuth.api.getSession).toHaveBeenCalledWith({
      headers: req.headers,
    });
  });

  it("never redirects self-hosted deployments and skips the lookups", async () => {
    process.env.SELF_HOSTED = "true";
    mockPrisma.user.findUnique.mockResolvedValue({
      organization: { isActive: false, suspendedAt: null },
    } as never);

    expect(await getLockedRedirect(pageRequest())).toBeNull();
    expect(mockAuth.api.getSession).not.toHaveBeenCalled();
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("fails open and logs when the session lookup throws", async () => {
    mockAuth.api.getSession.mockRejectedValue(new Error("boom"));

    expect(await getLockedRedirect(pageRequest())).toBeNull();
    expect(logger.error).toHaveBeenCalled();
  });

  it("fails open and logs when the organization lookup throws", async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error("db down"));

    expect(await getLockedRedirect(pageRequest())).toBeNull();
    expect(logger.error).toHaveBeenCalled();
  });
});
