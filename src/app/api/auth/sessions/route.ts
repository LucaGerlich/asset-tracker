import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth';
import { getUserSessions } from '@/lib/session-tracking';

/**
 * GET /api/auth/sessions
 * List all active sessions for the current user
 */
export async function GET() {
  try {
    const user = await requireApiAuth();

    if (!user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sessions = await getUserSessions(user.id);

    return NextResponse.json({ sessions });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message.startsWith('Forbidden')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    console.error('Failed to fetch sessions:', error);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
