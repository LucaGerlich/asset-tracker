import { describe, it, expect, vi } from "vitest";

/**
 * verifyEntityOrgOwnership resolves a Prisma delegate by name. The generated
 * client exposes camelCase properties (`component`), so this mock is keyed the
 * same way: a PascalCase lookup would never find the delegate and every
 * component would read as foreign.
 */

const db = vi.hoisted(() => ({
  component: { findFirst: vi.fn().mockResolvedValue({ id: "component-1" }) },
}));

vi.mock("@/lib/prisma", () => ({ default: db }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));

import { verifyEntityOrgOwnership } from "@/lib/organization-context";

describe("verifyEntityOrgOwnership", () => {
  it("finds a component of the caller's organization", async () => {
    const owned = await verifyEntityOrgOwnership(
      "component",
      "component-1",
      "org-uuid-001",
    );

    expect(owned).toBe(true);
    expect(db.component.findFirst).toHaveBeenCalledWith({
      where: { id: "component-1", organizationId: "org-uuid-001" },
      select: { id: true },
    });
  });
});
