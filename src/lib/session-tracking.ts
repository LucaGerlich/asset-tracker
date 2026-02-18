import prisma from './prisma';
import crypto from 'crypto';

// Parse user agent string into a friendly device name
export function parseDeviceName(userAgent: string | null): string {
  if (!userAgent) return 'Unknown Device';

  // Simple UA parsing
  if (userAgent.includes('iPhone')) return 'iPhone';
  if (userAgent.includes('iPad')) return 'iPad';
  if (userAgent.includes('Android')) return 'Android Device';
  if (userAgent.includes('Mac')) return 'Mac';
  if (userAgent.includes('Windows')) return 'Windows PC';
  if (userAgent.includes('Linux')) return 'Linux PC';

  return 'Unknown Device';
}

// Parse browser from user agent
export function parseBrowser(userAgent: string | null): string {
  if (!userAgent) return 'Unknown Browser';

  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Edg/')) return 'Edge';
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Safari')) return 'Safari';

  return 'Unknown Browser';
}

// Create a new session record
export async function createSessionRecord(
  userId: string,
  ipAddress: string | null,
  userAgent: string | null
): Promise<string> {
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await prisma.sessions.create({
    data: {
      sessionToken,
      userId,
      expires,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      deviceName: `${parseDeviceName(userAgent)} - ${parseBrowser(userAgent)}`,
      lastActive: new Date(),
      isCurrent: true,
    },
  });

  return sessionToken;
}

// Update last active time for a session
export async function updateSessionActivity(sessionToken: string): Promise<void> {
  try {
    await prisma.sessions.update({
      where: { sessionToken },
      data: { lastActive: new Date() },
    });
  } catch {
    // Session may have been revoked
  }
}

// Get all active sessions for a user
export async function getUserSessions(userId: string) {
  return prisma.sessions.findMany({
    where: {
      userId,
      expires: { gt: new Date() },
    },
    orderBy: { lastActive: 'desc' },
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
export async function revokeSession(sessionId: string, userId: string): Promise<boolean> {
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
export async function revokeOtherSessions(userId: string, currentSessionId: string): Promise<number> {
  const result = await prisma.sessions.deleteMany({
    where: {
      userId,
      id: { not: currentSessionId },
    },
  });

  return result.count;
}

// Clean up expired sessions
export async function cleanExpiredSessions(): Promise<number> {
  const result = await prisma.sessions.deleteMany({
    where: {
      expires: { lt: new Date() },
    },
  });

  return result.count;
}
