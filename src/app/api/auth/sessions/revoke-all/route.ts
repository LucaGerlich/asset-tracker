import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth';
import { revokeOtherSessions } from '@/lib/session-tracking';
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from '@/lib/audit-log';

/**
 * POST /api/auth/sessions/revoke-all
 * Revoke all sessions except the current one.
 * Body: { currentSessionId: string }
 */
export async function POST(req: Request) {
  try {
    const user = await requireApiAuth();

    if (!user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { currentSessionId } = body;

    if (!currentSessionId) {
      return NextResponse.json(
        { error: 'currentSessionId is required' },
        { status: 400 }
      );
    }

    const revokedCount = await revokeOtherSessions(user.id, currentSessionId);

    await createAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.DELETE,
      entity: AUDIT_ENTITIES.USER,
      entityId: user.id,
      details: {
        type: 'session_revoke_all',
        revokedCount,
        keptSessionId: currentSessionId,
      },
    });

    return NextResponse.json({ success: true, revokedCount });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message.startsWith('Forbidden')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    console.error('Failed to revoke all sessions:', error);
    return NextResponse.json({ error: 'Failed to revoke sessions' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
