import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");

const lookup = vi.hoisted(() => vi.fn());
vi.mock("dns/promises", () => ({ default: { lookup } }));

import { POST } from "@/app/api/admin/settings/integrations/test/route";

const fetchMock = vi.fn();

const send = (webhookUrl: string) =>
  POST(
    createMockRequest("/api/admin/settings/integrations/test", {
      method: "POST",
      body: { type: "slack", webhookUrl },
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/admin/settings/integrations/test SSRF protection", () => {
  it.each([
    "http://hooks.example.test/x",
    "https://localhost/x",
    "https://127.0.0.1/x",
    "https://169.254.169.254/latest",
    "https://[::ffff:7f00:1]/x",
    "https://0.0.0.0/x",
    "https://100.64.0.1/x",
    "https://[fd00::1]/x",
  ])("rejects %s without sending a request", async (url) => {
    const { status } = await parseResponse(await send(url));

    expect(status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a hostname that resolves to a private address", async () => {
    lookup.mockResolvedValue([{ address: "10.0.0.5", family: 4 }]);

    const { status } = await parseResponse(
      await send("https://hooks.evil.test/x"),
    );

    expect(status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not follow redirects", async () => {
    fetchMock.mockResolvedValue(
      new Response("", {
        status: 302,
        headers: { Location: "http://169.254.169.254/" },
      }),
    );

    const { status } = await parseResponse(
      await send("https://hooks.example.test/x"),
    );

    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
    expect(status).toBe(502);
  });

  it("does not echo the upstream response body in errors", async () => {
    fetchMock.mockResolvedValue(
      new Response("internal-secret-detail", { status: 500 }),
    );

    const { status, body } = await parseResponse(
      await send("https://hooks.example.test/x"),
    );

    expect(status).toBe(502);
    expect(JSON.stringify(body)).not.toContain("internal-secret-detail");
  });

  it("reports success for a public webhook that answers 200", async () => {
    fetchMock.mockResolvedValue(new Response("ok", { status: 200 }));

    const { status, body } = await parseResponse(
      await send("https://hooks.example.test/x"),
    );

    expect(status).toBe(200);
    expect(body).toEqual({ success: true });
  });
});
