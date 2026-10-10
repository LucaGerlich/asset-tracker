import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

type Headers = Record<string, string> | { get(name: string): string | null };

interface QueueRules {
  shouldQueue: (method: string, pathname: string, headers?: Headers) => boolean;
  pickHeaders: (headers: Headers) => Record<string, string>;
}

function loadRules(): QueueRules {
  const source = readFileSync(
    join(process.cwd(), "public", "sw-queue-rules.js"),
    "utf8",
  );
  const sandbox: Record<string, unknown> = {};
  runInNewContext(source, { self: sandbox });
  return sandbox as unknown as QueueRules;
}

const { shouldQueue, pickHeaders } = loadRules();

describe("shouldQueue", () => {
  it.each(["POST", "PUT", "PATCH", "DELETE"])(
    "queues a failed %s to an API route",
    (method) => {
      expect(shouldQueue(method, "/api/assets", {})).toBe(true);
    },
  );

  it("treats the method case-insensitively", () => {
    expect(shouldQueue("post", "/api/assets", {})).toBe(true);
  });

  it.each(["GET", "HEAD", "OPTIONS"])("never queues %s", (method) => {
    expect(shouldQueue(method, "/api/assets", {})).toBe(false);
  });

  it("does not queue the connectivity probe (HEAD /api/health)", () => {
    expect(shouldQueue("HEAD", "/api/health", {})).toBe(false);
  });

  it.each([
    "/api/auth/sign-in/email",
    "/api/auth/two-factor/verify-totp",
    "/api/auth/change-password",
    "/api/auth/",
    "/api/auth",
  ])("does not queue auth endpoint %s", (pathname) => {
    expect(shouldQueue("POST", pathname, {})).toBe(false);
  });

  it("still queues routes that merely start with the letters auth", () => {
    expect(shouldQueue("POST", "/api/authors", {})).toBe(true);
  });

  it.each(["/", "/assets", "/apiary", "/api"])(
    "does not queue non-API path %s",
    (pathname) => {
      expect(shouldQueue("POST", pathname, {})).toBe(false);
    },
  );

  it("does not queue multipart uploads", () => {
    expect(
      shouldQueue("POST", "/api/assets/upload", {
        "Content-Type": "multipart/form-data; boundary=----abc",
      }),
    ).toBe(false);
  });

  it("does not queue a replayed request", () => {
    expect(
      shouldQueue("POST", "/api/assets", { "x-offline-replay": "1" }),
    ).toBe(false);
  });

  it("reads Headers-like objects case-insensitively", () => {
    const headers = new Headers({
      "Content-Type": "multipart/form-data; boundary=x",
    });
    expect(shouldQueue("POST", "/api/assets", headers)).toBe(false);
    expect(
      shouldQueue(
        "POST",
        "/api/assets",
        new Headers({ "X-Offline-Replay": "1" }),
      ),
    ).toBe(false);
    expect(
      shouldQueue(
        "POST",
        "/api/assets",
        new Headers({ "Content-Type": "application/json" }),
      ),
    ).toBe(true);
  });

  it("queues when no headers are provided", () => {
    expect(shouldQueue("DELETE", "/api/assets/1")).toBe(true);
  });
});

describe("pickHeaders", () => {
  it("keeps only content-type, accept and x-expected-version", () => {
    expect(
      pickHeaders({
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Expected-Version": "3",
        Cookie: "better-auth.session_token=secret",
        Authorization: "Bearer secret",
        "X-Custom": "nope",
      }),
    ).toEqual({
      "content-type": "application/json",
      accept: "application/json",
      "x-expected-version": "3",
    });
  });

  it("drops cookie and authorization", () => {
    const picked = pickHeaders({
      cookie: "a=b",
      authorization: "Bearer x",
      "content-type": "application/json",
    });
    expect(picked).not.toHaveProperty("cookie");
    expect(picked).not.toHaveProperty("authorization");
    expect(picked).toEqual({ "content-type": "application/json" });
  });

  it("accepts a Headers instance", () => {
    expect(
      pickHeaders(
        new Headers({
          "Content-Type": "application/json",
          Cookie: "a=b",
        }),
      ),
    ).toEqual({ "content-type": "application/json" });
  });
});
