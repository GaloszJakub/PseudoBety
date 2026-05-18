import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyCronToken } from '@/lib/cron-auth';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authError = verifyCronToken(req);
  if (authError) return authError;

  const snap = await adminDb.collection('matches')
    .where('status', 'in', ['upcoming', 'live'])
    .get();

  // Legacy docs: no 'source' field (old UUID-based Odds API docs created before fetch-fixtures)
  // Also catch stale 'upcoming' docs with past commenceTime (missed by settle-bets)
  const now = Date.now();
  const legacy = snap.docs.filter(d => {
    const data = d.data();
    if (!data.source) return true; // no source = old Odds API doc
    const ms = data.commenceTime?.toMillis?.() ?? 0;
    if (ms > 0 && ms < now - 3_600_000) return true; // upcoming but >1h in past
    return false;
  });

  let deleted = 0;
  for (let i = 0; i < legacy.length; i += 400) {
    const batch = adminDb.batch();
    for (const d of legacy.slice(i, i + 400)) {
      batch.delete(d.ref);
      deleted++;
    }
    await batch.commit();
  }

  return NextResponse.json({ ok: true, deleted, total: snap.size });
}
