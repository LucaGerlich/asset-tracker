import { describe, it, expect } from "vitest";
import {
  SELF_HOSTED_HIDDEN_TABS,
  SUPER_ADMIN_ONLY_TABS,
  isTabVisible,
  resolveActiveTab,
} from "@/lib/settings-tabs";

const PLATFORM_TABS = [
  "general",
  "email",
  "freshdesk",
  "notifications",
  "sso",
  "ldap",
  "intune",
  "integrations",
  "organizations",
  "rateLimits",
];

const ORG_TABS = [
  "users",
  "labels",
  "depreciation",
  "custom-fields",
  "status-workflow",
  "asset-templates",
  "eula",
  "roles",
  "api-keys",
  "storage",
  "webhooks",
  "departments",
];

describe("SUPER_ADMIN_ONLY_TABS", () => {
  it("lists exactly the platform-wide tabs", () => {
    expect([...SUPER_ADMIN_ONLY_TABS].sort()).toEqual(
      [...PLATFORM_TABS].sort(),
    );
  });
});

describe("isTabVisible", () => {
  const admin = { isSuperAdmin: false, isSelfHostedMode: false };
  const superAdmin = { isSuperAdmin: true, isSelfHostedMode: false };

  it.each(PLATFORM_TABS)("hides %s from a regular admin", (tab) => {
    expect(isTabVisible(tab, admin)).toBe(false);
  });

  it.each(PLATFORM_TABS)("shows %s to a super-admin", (tab) => {
    expect(isTabVisible(tab, superAdmin)).toBe(true);
  });

  it.each(ORG_TABS)("shows %s to a regular admin", (tab) => {
    expect(isTabVisible(tab, admin)).toBe(true);
  });

  it("hides billing in self-hosted mode, even from a super-admin", () => {
    expect([...SELF_HOSTED_HIDDEN_TABS]).toEqual(["billing"]);
    expect(
      isTabVisible("billing", { isSuperAdmin: true, isSelfHostedMode: true }),
    ).toBe(false);
    expect(isTabVisible("billing", superAdmin)).toBe(true);
  });
});

describe("resolveActiveTab", () => {
  const visibleForAdmin = ["users", "billing", "labels", "roles"];

  it("keeps a requested tab that is visible", () => {
    expect(resolveActiveTab("labels", visibleForAdmin)).toBe("labels");
  });

  it("falls back to the first visible tab for a hidden platform tab", () => {
    for (const tab of PLATFORM_TABS) {
      expect(resolveActiveTab(tab, visibleForAdmin)).toBe("users");
    }
  });

  it("falls back to the first visible tab for an unknown tab", () => {
    expect(resolveActiveTab("does-not-exist", visibleForAdmin)).toBe("users");
  });

  it("falls back to the first visible tab when none is requested", () => {
    expect(resolveActiveTab(null, visibleForAdmin)).toBe("users");
    expect(resolveActiveTab(undefined, visibleForAdmin)).toBe("users");
    expect(resolveActiveTab("", visibleForAdmin)).toBe("users");
  });

  it("does not match prototype property names", () => {
    expect(resolveActiveTab("constructor", visibleForAdmin)).toBe("users");
  });

  it("returns an empty string when nothing is visible", () => {
    expect(resolveActiveTab("general", [])).toBe("");
  });
});
