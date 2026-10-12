import { describe, it, expect } from "vitest";
import {
  ForbiddenError,
  UnauthorizedError,
  apiErrorResponse,
} from "@/lib/errors";

describe("typed auth errors", () => {
  it("ForbiddenError keeps the 'Forbidden: ' prefix and carries a code", () => {
    const err = new ForbiddenError("org_locked", "Organization suspended");
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("Forbidden: Organization suspended");
    expect(err.code).toBe("org_locked");
    expect(err.statusCode).toBe(403);
  });

  it("UnauthorizedError defaults to 'Unauthorized'", () => {
    const err = new UnauthorizedError();
    expect(err.message).toBe("Unauthorized");
    expect(err.statusCode).toBe(401);
  });
});

describe("apiErrorResponse", () => {
  it("maps ForbiddenError to 403 with error and code", async () => {
    const res = apiErrorResponse(
      new ForbiddenError("org_read_only", "Organization is in read-only mode"),
    );
    expect(res?.status).toBe(403);
    await expect(res?.json()).resolves.toEqual({
      error: "Forbidden: Organization is in read-only mode",
      code: "org_read_only",
    });
  });

  it("maps UnauthorizedError to 401", async () => {
    const res = apiErrorResponse(new UnauthorizedError());
    expect(res?.status).toBe(401);
    await expect(res?.json()).resolves.toEqual({
      error: "Unauthorized",
      code: "unauthorized",
    });
  });

  it("returns null for any other error so routes keep their own handling", () => {
    expect(apiErrorResponse(new Error("boom"))).toBeNull();
    expect(apiErrorResponse("string")).toBeNull();
    expect(apiErrorResponse(null)).toBeNull();
  });
});
