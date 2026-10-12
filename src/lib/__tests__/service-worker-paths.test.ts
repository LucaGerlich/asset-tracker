import { describe, expect, it } from "vitest";
import { isServiceWorkerPath } from "@/lib/service-worker-paths";

describe("isServiceWorkerPath", () => {
  it.each(["/sw.js", "/sw-queue-rules.js"])("accepts %s", (pathname) => {
    expect(isServiceWorkerPath(pathname)).toBe(true);
  });

  it.each(["/", "/sw.js/", "/sw", "/api/sw.js", "/sw-other.js", "/assets"])(
    "rejects %s",
    (pathname) => {
      expect(isServiceWorkerPath(pathname)).toBe(false);
    },
  );
});
