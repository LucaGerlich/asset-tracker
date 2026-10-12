import { describe, it, expect } from "vitest";
import {
  organizationAdminUpdateSchema,
  stockAlertSchema,
  updateOrganizationSchema,
  updateRoleSchema,
  updateStockAlertSchema,
  updateWebhookSchema,
  webhookSchema,
} from "../validation-organization";

describe("update schemas do not re-apply create defaults", () => {
  it("updateWebhookSchema keeps omitted fields omitted", () => {
    expect(updateWebhookSchema.parse({ name: "Renamed" })).toEqual({
      name: "Renamed",
    });
  });

  it("webhookSchema still applies its defaults on create", () => {
    const created = webhookSchema.parse({
      name: "Hook",
      url: "https://example.com/hook",
      events: ["asset.created"],
    });
    expect(created).toMatchObject({ isActive: true, retryAttempts: 3 });
  });

  it("updateWebhookSchema still validates the fields it receives", () => {
    expect(updateWebhookSchema.safeParse({ retryAttempts: 99 }).success).toBe(
      false,
    );
    expect(updateWebhookSchema.parse({ isActive: false })).toEqual({
      isActive: false,
    });
  });

  it("updateStockAlertSchema keeps omitted fields omitted", () => {
    expect(updateStockAlertSchema.parse({ minThreshold: 20 })).toEqual({
      minThreshold: 20,
    });
  });

  it("stockAlertSchema still applies its defaults on create", () => {
    const created = stockAlertSchema.parse({
      consumableId: "00000000-0000-4000-8000-0000000000a1",
    });
    expect(created).toMatchObject({
      minThreshold: 10,
      criticalThreshold: 5,
      emailNotify: true,
      webhookNotify: false,
    });
  });
});

describe("updateRoleSchema", () => {
  it("drops organizationId so a role can never change tenant", () => {
    expect(
      updateRoleSchema.parse({ name: "Renamed", organizationId: null }),
    ).toEqual({ name: "Renamed" });
    expect(
      updateRoleSchema.parse({
        organizationId: "00000000-0000-4000-8000-000000000999",
      }),
    ).toEqual({});
  });
});

describe("organization update schemas", () => {
  it("strips isActive for tenants but keeps it for super-admins", () => {
    expect(updateOrganizationSchema.parse({ isActive: true })).toEqual({});
    expect(organizationAdminUpdateSchema.parse({ isActive: false })).toEqual({
      isActive: false,
    });
    expect(organizationAdminUpdateSchema.parse({})).toEqual({});
  });
});
