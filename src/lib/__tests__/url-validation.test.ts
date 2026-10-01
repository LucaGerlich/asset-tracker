import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    securityEvent: vi.fn(),
  },
}));

vi.mock("dns/promises", () => ({
  default: { lookup: vi.fn() },
}));

import dns from "dns/promises";
import { validateOutboundUrl } from "@/lib/url-validation";

const mockLookup = vi.mocked(dns.lookup);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("validateOutboundUrl", () => {
  it("rejects http://localhost without doing a DNS lookup", async () => {
    const result = await validateOutboundUrl("http://localhost");

    expect(result.valid).toBe(false);
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it("rejects http://127.0.0.1", async () => {
    const result = await validateOutboundUrl("http://127.0.0.1");

    expect(result.valid).toBe(false);
  });

  it("rejects http://10.0.0.1", async () => {
    const result = await validateOutboundUrl("http://10.0.0.1");

    expect(result.valid).toBe(false);
  });

  it("rejects http://169.254.169.254 (cloud metadata endpoint)", async () => {
    const result = await validateOutboundUrl("http://169.254.169.254");

    expect(result.valid).toBe(false);
  });

  it("rejects http://[::1]", async () => {
    const result = await validateOutboundUrl("http://[::1]");

    expect(result.valid).toBe(false);
  });

  it("rejects a hostname that resolves to a private IP", async () => {
    mockLookup.mockResolvedValue([{ address: "10.1.2.3", family: 4 }] as any);

    const result = await validateOutboundUrl("https://evil.example.com");

    expect(result.valid).toBe(false);
    expect(mockLookup).toHaveBeenCalledWith(
      "evil.example.com",
      expect.objectContaining({ all: true }),
    );
  });

  it("accepts a hostname that resolves to a public IP", async () => {
    mockLookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ] as any);

    const result = await validateOutboundUrl("https://example.com");

    expect(result.valid).toBe(true);
  });

  it("rejects non-http(s) schemes", async () => {
    const result = await validateOutboundUrl("ftp://example.com/file");

    expect(result.valid).toBe(false);
    expect(mockLookup).not.toHaveBeenCalled();
  });
});
