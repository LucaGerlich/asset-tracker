import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/org-lock-redirect", () => ({
  shouldCheckOrgLock: vi.fn(() => false),
  getLockedRedirect: vi.fn(async () => null),
}));

import { proxy } from "@/proxy";

describe("proxy and the service worker files", () => {
  it.each(["/sw.js", "/sw-queue-rules.js"])(
    "serves %s without a session instead of redirecting to the login page",
    async (pathname) => {
      const res = await proxy(new NextRequest(`http://localhost${pathname}`));

      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    },
  );

  it("still sends anonymous page requests to the login page", async () => {
    const res = await proxy(new NextRequest("http://localhost/dashboard"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });
});
