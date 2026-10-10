import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

type Headers = Record<string, string> | { get(name: string): string | null };

interface QueueRules {
  shouldQueue: (method: string, pathname: string, headers?: Headers) => boolean;
  pickHeaders: (headers: Headers) => Record<string, string>;
  bodyHasSecrets: (contentType: string | null, bodyText: string) => boolean;
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

const { shouldQueue, pickHeaders, bodyHasSecrets } = loadRules();

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

  describe("routes that carry credentials", () => {
    it.each([
      "/api/user/addUser",
      "/api/setup",
      "/api/setup/complete",
      "/api/admin/settings/ldap",
      "/api/admin/settings/email",
      "/api/admin/settings/sso/oidc",
      "/api/scim/v2/Users",
      "/api/scim/v2/Users/abc",
      "/api/team/invite/abc123",
    ])("does not queue %s", (pathname) => {
      for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
        expect(shouldQueue(method, pathname, {})).toBe(false);
      }
    });

    it.each([
      "/api/user/addUser/",
      "/api//user/addUser",
      "/api/%75ser/addUser",
      "/api/admin/settings%2Fldap",
      "/api/%61uth/sign-in/email",
    ])("does not let %s slip past with encoding or slashes", (pathname) => {
      expect(shouldQueue("POST", pathname, {})).toBe(false);
    });

    it("refuses a path it cannot decode", () => {
      expect(shouldQueue("POST", "/api/assets/%E0%A4%A", {})).toBe(false);
    });

    it.each([
      ["PUT", "/api/user"],
      ["POST", "/api/asset"],
      ["PUT", "/api/asset"],
      ["POST", "/api/user/getUser"],
      ["POST", "/api/setupfoo"],
      ["PUT", "/api/admin/settingsfoo"],
      ["POST", "/api/team"],
      ["POST", "/api/team/invites"],
      ["DELETE", "/api/asset/123"],
    ])("still queues ordinary route %s %s", (method, pathname) => {
      expect(shouldQueue(method, pathname, {})).toBe(true);
    });
  });

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

describe("bodyHasSecrets", () => {
  const json = "application/json";

  it.each([
    "password",
    "newPassword",
    "currentPassword",
    "bindPassword",
    "clientSecret",
    "apiKey",
    "api_key",
    "secret",
    "token",
  ])("flags a JSON body with the field %s", (field) => {
    expect(bodyHasSecrets(json, JSON.stringify({ [field]: "hunter2" }))).toBe(
      true,
    );
  });

  it("matches field names without regard to case", () => {
    expect(bodyHasSecrets(json, '{"PASSWORD":"x"}')).toBe(true);
    expect(bodyHasSecrets(json, '{"ApiKey":"x"}')).toBe(true);
    expect(bodyHasSecrets(json, '{"API_KEY":"x"}')).toBe(true);
  });

  it("flags related fields the app really sends", () => {
    for (const field of [
      "confirmPassword",
      "secretKey",
      "secretAccessKey",
      "freshdesk_api_key",
      "inviteToken",
      "webhookSecret",
    ]) {
      expect(bodyHasSecrets(json, JSON.stringify({ [field]: "x" }))).toBe(true);
    }
  });

  it("finds a field nested in objects and arrays", () => {
    expect(
      bodyHasSecrets(json, '{"user":{"profile":{"login":{"password":"x"}}}}'),
    ).toBe(true);
    expect(bodyHasSecrets(json, '{"users":[{"name":"a"},{"token":"x"}]}')).toBe(
      true,
    );
  });

  it("flags a JSON body sent without a JSON content type", () => {
    expect(bodyHasSecrets("text/plain;charset=UTF-8", '{"password":"x"}')).toBe(
      true,
    );
    expect(bodyHasSecrets(null, '{"password":"x"}')).toBe(true);
  });

  it("allows ordinary bodies", () => {
    expect(
      bodyHasSecrets(
        json,
        '{"assetname":"Laptop","assettag":"A-1","_expectedVersion":"2026-01-01T00:00:00.000Z","tags":["a","b"]}',
      ),
    ).toBe(false);
    expect(bodyHasSecrets(json, '{"passwordMode":"x"}')).toBe(false);
    expect(bodyHasSecrets(json, '{"note":"my password is x"}')).toBe(false);
    expect(bodyHasSecrets(json, "[1,2,3]")).toBe(false);
    expect(bodyHasSecrets(json, '"just a string"')).toBe(false);
  });

  it("allows non-JSON bodies and empty bodies", () => {
    expect(bodyHasSecrets("text/plain", "hello world")).toBe(false);
    expect(bodyHasSecrets(null, "hello world")).toBe(false);
    expect(bodyHasSecrets(json, "")).toBe(false);
    expect(bodyHasSecrets(null, "")).toBe(false);
  });

  it("treats JSON it cannot parse as unsafe to queue", () => {
    expect(bodyHasSecrets(json, '{"password": "x"')).toBe(true);
    expect(bodyHasSecrets("application/vnd.api+json", "not json")).toBe(true);
  });

  it("treats a body nested too deeply to inspect as unsafe", () => {
    const deep = `${'{"a":'.repeat(40)}1${"}".repeat(40)}`;
    expect(bodyHasSecrets(json, deep)).toBe(true);
  });

  it("checks the field names of form-encoded bodies", () => {
    const form = "application/x-www-form-urlencoded";
    expect(bodyHasSecrets(form, "email=a%40b.c&password=x")).toBe(true);
    expect(bodyHasSecrets(form, "new%5FPassword=x")).toBe(true);
    expect(bodyHasSecrets(form, "name=Laptop&tag=A-1")).toBe(false);
  });
});
