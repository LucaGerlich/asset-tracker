import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma");

import { scimEmailRejection } from "@/lib/scim";
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
