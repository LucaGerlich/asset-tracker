/**
 * Visibility rules for the admin settings tabs.
 *
 * Platform-wide tabs configure or expose rows that every tenant shares (system
 * settings, the organization list, the rate limit counters). They are shown,
 * and rendered, only for super-admins:
 * a regular org admin must not see or edit them. This is a usability filter on
 * top of the API guards, never a replacement for them.
 */

export const SUPER_ADMIN_ONLY_TABS: ReadonlySet<string> = new Set([
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
]);

/** Billing exists only in the hosted SaaS deployment. */
export const SELF_HOSTED_HIDDEN_TABS: ReadonlySet<string> = new Set([
  "billing",
]);

export interface TabVisibilityContext {
  isSuperAdmin: boolean;
  isSelfHostedMode: boolean;
}

export function isTabVisible(
  tab: string,
  { isSuperAdmin, isSelfHostedMode }: TabVisibilityContext,
): boolean {
  if (SUPER_ADMIN_ONLY_TABS.has(tab) && !isSuperAdmin) return false;
  if (SELF_HOSTED_HIDDEN_TABS.has(tab) && isSelfHostedMode) return false;
  return true;
}

/**
 * The tab to render. A requested tab (from `?tab=` or a click) that the viewer
 * may not see falls back to the first visible one, so a hidden tab never
 * renders just because it was selected by URL.
 */
export function resolveActiveTab(
  requested: string | null | undefined,
  visibleTabs: readonly string[],
): string {
  if (requested && visibleTabs.includes(requested)) return requested;
  return visibleTabs[0] ?? "";
}
