import { describe, it, expect } from "vitest";
import { getEnvEmailConfig } from "@/lib/env-email-config";

const configuredEnv = {
  EMAIL_PROVIDER: "brevo",
  EMAIL_FROM: "noreply@platform.example",
  EMAIL_FROM_NAME: "Platform Mailer",
  BREVO_API_KEY: "xkeysib-secret",
};

describe("getEnvEmailConfig", () => {
  it("returns null for a non-super-admin even when the platform mailer is configured", () => {
    expect(getEnvEmailConfig(false, configuredEnv)).toBeNull();
  });

  it("returns the platform mailer config for a super-admin", () => {
    expect(getEnvEmailConfig(true, configuredEnv)).toEqual({
      provider: "brevo",
      fromEmail: "noreply@platform.example",
      fromName: "Platform Mailer",
      hasApiKey: true,
    });
  });

  it("never exposes the API key itself", () => {
    const serialised = JSON.stringify(getEnvEmailConfig(true, configuredEnv));

    expect(serialised).not.toContain("xkeysib-secret");
  });

  it("returns null when no provider is configured", () => {
    expect(getEnvEmailConfig(true, {})).toBeNull();
    expect(getEnvEmailConfig(true, { EMAIL_PROVIDER: "" })).toBeNull();
  });

  it("falls back to the default sender fields", () => {
    expect(getEnvEmailConfig(true, { EMAIL_PROVIDER: "smtp" })).toEqual({
      provider: "smtp",
      fromEmail: "",
      fromName: "Asset Tracker",
      hasApiKey: false,
    });
  });

  it.each([
    "BREVO_API_KEY",
    "SENDGRID_API_KEY",
    "MAILGUN_API_KEY",
    "POSTMARK_API_KEY",
  ])("reports hasApiKey when %s is set", (name) => {
    const config = getEnvEmailConfig(true, {
      EMAIL_PROVIDER: "x",
      [name]: "secret",
    });

    expect(config?.hasApiKey).toBe(true);
  });
});
