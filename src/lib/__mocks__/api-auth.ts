import { vi } from "vitest";

/**
 * Vitest automock for `@/lib/api-auth`.
 *
 * Routes gained new guards over time (requirePlanFeature, requireWritableOrg,
 * …); a hand-written mock omitting one throws "No X export defined on mock" as
 * soon as a route calls it. This provides every export with a sensible default
 * (authenticated admin) that a test overrides as needed, e.g.:
 *
 *   vi.mocked(requirePermission).mockRejectedValue(new Error("Unauthorized"));
 */

const defaultAuthUser = {
  id: "admin-uuid-001",
  isAdmin: true,
  canRequest: true,
  name: "Admin User",
  email: "admin@test.com",
  username: "admin",
  firstname: "Admin",
  lastname: "User",
  organizationId: "org-uuid-001",
  departmentId: null,
};

// Mutations are not blocked in tests by default.
export const requireNotDemoMode = vi.fn(() => null);

export const getAuthUser = vi.fn().mockResolvedValue(defaultAuthUser);
export const requireApiAuth = vi.fn().mockResolvedValue(defaultAuthUser);
export const requireApiAdmin = vi.fn().mockResolvedValue(defaultAuthUser);
export const requireSuperAdmin = vi.fn().mockResolvedValue(defaultAuthUser);
export const requireApiCanRequest = vi.fn().mockResolvedValue(defaultAuthUser);
export const requirePermission = vi.fn().mockResolvedValue(defaultAuthUser);

export const requireWritableOrg = vi.fn().mockResolvedValue(undefined);
export const requirePlanFeature = vi.fn().mockResolvedValue(undefined);
