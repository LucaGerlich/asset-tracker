import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth';
import { revokeSession } from '@/lib/session-tracking';
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from '@/lib/audit-log';
import prisma from '@/lib/prisma';

/**
 * DELETE /api/auth/sessions/[id]
 * Revoke a specific session by ID.
 * Users can revoke their own sessions; admins can revoke any session.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireApiAuth();
    const { id: sessionId } = await params;

    if (!user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // If admin, allow revoking any session; otherwise only own sessions
    if (user.isAdmin) {
      // Admin: find the session to get its userId for audit logging
      const session = await prisma.sessions.findUnique({
        where: { id: sessionId },
        select: { userId: true, deviceName: true, ipAddress: true },
      });

      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      await prisma.sessions.delete({ where: { id: sessionId } });

      await createAuditLog({
        userId: user.id,
        action: AUDIT_ACTIONS.DELETE,
        entity: AUDIT_ENTITIES.USER,
        entityId: session.userId,
        details: {
          type: 'session_revoke',
          sessionId,
          deviceName: session.deviceName,
          ipAddress: session.ipAddress,
          revokedByAdmin: user.id !== session.userId,
        },
      });

      return NextResponse.json({ success: true });
    }

    // Regular user: can only revoke own sessions
    const revoked = await revokeSession(sessionId, user.id);

    if (!revoked) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    await createAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.DELETE,
      entity: AUDIT_ENTITIES.USER,
      entityId: user.id,
      details: {
        type: 'session_revoke',
        sessionId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message.startsWith('Forbidden')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    console.error('Failed to revoke session:', error);
    return NextResponse.json({ error: 'Failed to revoke session' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
