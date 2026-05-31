import prisma from "./prisma";
import crypto from "crypto";

export function parseDeviceName(userAgent: string | null): string {
  if (!userAgent) return "Unknown Device";

  if (userAgent.includes("iPhone")) return "iPhone";
  if (userAgent.includes("iPad")) return "iPad";
  if (userAgent.includes("Android")) return "Android Device";
  if (userAgent.includes("Mac")) return "Mac";
  if (userAgent.includes("Windows")) return "Windows PC";
  if (userAgent.includes("Linux")) return "Linux PC";

  return "Unknown Device";
}

export function parseBrowser(userAgent: string | null): string {
  if (!userAgent) return "Unknown Browser";

  if (userAgent.includes("Firefox")) return "Firefox";
  if (userAgent.includes("Edg/")) return "Edge";
  if (userAgent.includes("Chrome")) return "Chrome";
  if (userAgent.includes("Safari")) return "Safari";

  return "Unknown Browser";
}

export async function createSessionRecord(
  userId: string,
  ipAddress: string | null,
  userAgent: string | null,
): Promise<string> {
  const sessionToken = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await prisma.sessions.create({
    data: {
      token: sessionToken,
      userId,
      expiresAt: expires,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      deviceName: `${parseDeviceName(userAgent)} - ${parseBrowser(userAgent)}`,
      lastActive: new Date(),
      isCurrent: true,
    },
  });

  return sessionToken;
}

export async function updateSessionActivity(
  sessionToken: string,
): Promise<void> {
  try {
    await prisma.sessions.update({
      where: { token: sessionToken },
      data: { lastActive: new Date() },
    });
  } catch {
    // Session may have been revoked
  }
}

export async function getUserSessions(userId: string) {
  return prisma.sessions.findMany({
    where: {
      userId,
      expiresAt: { gt: new Date() },
    },
    orderBy: { lastActive: "desc" },
    select: {
      id: true,
      ipAddress: true,
      userAgent: true,
      deviceName: true,
      lastActive: true,
      createdAt: true,
      isCurrent: true,
    },
  });
}

// Revoke a specific session
export async function revokeSession(
  sessionId: string,
  userId: string,
): Promise<boolean> {
  const session = await prisma.sessions.findFirst({
    where: { id: sessionId, userId },
  });

  if (!session) return false;

  await prisma.sessions.delete({
    where: { id: sessionId },
  });

  return true;
}

// Revoke all sessions except current
export async function revokeOtherSessions(
  userId: string,
  currentSessionId: string,
): Promise<number> {
  const result = await prisma.sessions.deleteMany({
    where: {
      userId,
      id: { not: currentSessionId },
    },
  });

  return result.count;
}

export async function cleanExpiredSessions(): Promise<number> {
  const result = await prisma.sessions.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });

  return result.count;
}
