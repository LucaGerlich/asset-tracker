import { describe, it, expect } from "vitest";
import { getTrustedProviders } from "@/lib/auth-trusted-providers";

const GUID = "8f1c6b5e-4a3d-4f7e-9b2a-1c2d3e4f5a6b";

describe("getTrustedProviders", () => {
  it("trusts no provider when no tenant is configured", () => {
    expect(getTrustedProviders(undefined)).toEqual([]);
    expect(getTrustedProviders("")).toEqual([]);
  });

  it.each(["common", "organizations", "consumers", "COMMON"])(
    "does not trust microsoft for the multi-tenant endpoint %s",
    (tenant) => {
      expect(getTrustedProviders(tenant)).toEqual([]);
    },
  );

  it("does not trust microsoft for a non-GUID tenant value", () => {
    expect(getTrustedProviders("contoso.onmicrosoft.com")).toEqual([]);
  });

  it("trusts microsoft for a concrete tenant GUID", () => {
    expect(getTrustedProviders(GUID)).toEqual(["microsoft"]);
    expect(getTrustedProviders(GUID.toUpperCase())).toEqual(["microsoft"]);
  });
});
