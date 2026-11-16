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

describe("apiErrorResponse malformed JSON bodies", () => {
  const malformedBody = async () => {
    const req = new Request("http://localhost/api/x", {
      method: "POST",
      body: "{not json",
    });
    try {
      await req.json();
    } catch (error) {
      return error;
    }
    throw new Error("expected req.json() to reject");
  };

  it("maps the SyntaxError from req.json() to 400 Invalid JSON body", async () => {
    const res = apiErrorResponse(await malformedBody());
    expect(res?.status).toBe(400);
    await expect(res?.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });

  it("maps an empty body the same way", async () => {
    const req = new Request("http://localhost/api/x", { method: "POST" });
    const error = await req.json().catch((e: unknown) => e);
    expect(apiErrorResponse(error)?.status).toBe(400);
  });

  it("leaves SyntaxErrors that are not about JSON to the caller", () => {
    expect(
      apiErrorResponse(new SyntaxError("Invalid regular expression")),
    ).toBeNull();
  });
});
