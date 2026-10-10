import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";

export interface SettingsViewer {
  id: string;
  organizationId: string | null;
}

const DEFAULT_PREFERENCES = {
  theme: "system",
  locale: "en",
  timezone: "UTC",
  currency: "USD",
  dateFormat: "MM/DD/YYYY",
  numberFormat: "1,234.56",
  pageSize: 20,
};

/**
 * Identity lookup for the settings page. A viewer may always load themselves;
 * anyone else (an admin) is resolved inside the viewer's own organization, and
 * a viewer without an organization cannot resolve anyone else. A miss is
 * indistinguishable from a foreign user's id: both end in notFound().
 */
function settingsUserWhere(viewer: SettingsViewer, targetUserId: string) {
  if (viewer.id === targetUserId) return { userid: targetUserId };
  if (!viewer.organizationId) return null;
  return { userid: targetUserId, organizationId: viewer.organizationId };
}

/**
 * Load the user and preferences shown on /user/[id]/settings. The preferences
 * row is only read after the user has been resolved for this viewer, so a
 * foreign user's preferences are never queried.
 */
export async function loadUserSettings(
  viewer: SettingsViewer,
  targetUserId: string,
) {
  const where = settingsUserWhere(viewer, targetUserId);
  if (!where) notFound();

  const user = await prisma.user.findFirst({
    where,
    select: {
      userid: true,
      firstname: true,
      lastname: true,
      email: true,
      twoFactorEnabled: true,
      authProvider: true,
    },
  });
  if (!user) notFound();

  const prefs = await prisma.user_preferences.findUnique({
    where: { userId: user.userid },
  });

  const preferences = prefs
    ? {
        theme: prefs.theme,
        locale: prefs.locale,
        timezone: prefs.timezone,
        currency: prefs.currency,
        dateFormat: prefs.dateFormat,
        numberFormat: prefs.numberFormat,
        pageSize: prefs.pageSize,
      }
    : DEFAULT_PREFERENCES;

  return { user, preferences };
}
