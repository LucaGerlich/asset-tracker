import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma");
vi.mock("@/lib/logger");
vi.mock("@/lib/org-suspension", () => ({
  getOrgSuspensionStatus: vi.fn().mockResolvedValue("active"),
}));

import prisma from "@/lib/prisma";
import {
  authenticateScim,
  scimEmailRejection,
  scimTokenDigest,
} from "@/lib/scim";
import { EmailConflictError } from "@/lib/email-ownership";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

describe("scimEmailRejection", () => {
  it("maps an email conflict to a SCIM 409", async () => {
    const response = scimEmailRejection(new EmailConflictError());

    expect(response?.status).toBe(409);
    expect(response?.headers.get("Content-Type")).toBe("application/scim+json");
    await expect(response?.json()).resolves.toEqual({
      schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
      detail: "Email is already in use",
      status: 409,
    });
  });

  it("maps a reserved address to a SCIM 403", async () => {
    const response = scimEmailRejection(
      new ForbiddenError("not_super_admin", "This email address is reserved"),
    );

    expect(response?.status).toBe(403);
    expect(response?.headers.get("Content-Type")).toBe("application/scim+json");
    await expect(response?.json()).resolves.toEqual({
      schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
      detail: "Forbidden: This email address is reserved",
      status: 403,
    });
  });

  it.each([
    ["another application error", new NotFoundError()],
    ["a plain error", new Error("connection refused")],
    ["a non-error value", "boom"],
  ])("returns null for %s so the caller keeps its own handling", (_, error) => {
    expect(scimEmailRejection(error)).toBeNull();
  });
});

describe("authenticateScim token hashing", () => {
  const mockPrisma = vi.mocked(prisma, true);
  const bearer = (token: string) =>
    new Request("http://localhost/api/scim/v2/Users", {
      headers: { authorization: `Bearer ${token}` },
    });

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.scimToken.findFirst.mockResolvedValue(null);
    mockPrisma.scimToken.findMany.mockResolvedValue([]);
  });

  it("matches a stored digest by hashing the presented token", async () => {
    mockPrisma.scimToken.findFirst.mockResolvedValue({
      id: "t1",
      token: scimTokenDigest("scim-secret"),
      organizationId: "org-1",
    } as never);

    const result = await authenticateScim(bearer("scim-secret"));

    expect(mockPrisma.scimToken.findFirst).toHaveBeenCalledWith({
      where: { token: scimTokenDigest("scim-secret") },
      select: { id: true, organizationId: true },
    });
    expect(result).toEqual({ organizationId: "org-1" });
    expect(mockPrisma.scimToken.update).not.toHaveBeenCalled();
  });

  it("accepts a legacy plaintext row and rewrites it to its digest", async () => {
    mockPrisma.scimToken.findMany.mockResolvedValue([
      { id: "t2", token: "legacy-plain", organizationId: "org-2" },
    ] as never);

    const result = await authenticateScim(bearer("legacy-plain"));

    expect(result).toEqual({ organizationId: "org-2" });
    expect(mockPrisma.scimToken.update).toHaveBeenCalledWith({
      where: { id: "t2" },
      data: { token: scimTokenDigest("legacy-plain") },
    });
  });

  it("rejects a token that matches neither a digest nor a legacy row", async () => {
    mockPrisma.scimToken.findMany.mockResolvedValue([
      { id: "t3", token: scimTokenDigest("other"), organizationId: "org-3" },
    ] as never);

    const result = await authenticateScim(bearer("wrong"));

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
    expect(mockPrisma.scimToken.update).not.toHaveBeenCalled();
  });

  it("does not accept the stored digest itself as a bearer token", async () => {
    const digest = scimTokenDigest("scim-secret");
    mockPrisma.scimToken.findMany.mockResolvedValue([
      { id: "t1", token: digest, organizationId: "org-1" },
    ] as never);

    const result = await authenticateScim(bearer(digest));

    expect((result as Response).status).toBe(401);
  });
});
