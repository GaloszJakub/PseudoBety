import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

// In-memory cache — survives across requests in same Node.js process
// Works in both dev and prod (Vercel keeps processes warm)
let memCache: { data: { live: object[]; upcoming: object[] }; expiresAt: number } | null = null;
const MEM_TTL_MS = 5 * 60 * 1000; // 5 minutes

function toKickoff(ts: Timestamp | null): string {
  if (!ts) return '';
  const date = ts.toDate();
  const now = new Date();
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  if (date.toDateString() === now.toDateString()) return `Dziś ${h}:${m}`;
  const tom = new Date(now.getTime() + 86400000);
  if (date.toDateString() === tom.toDateString()) return `Jutro ${h}:${m}`;
  const day = date.getDate().toString().padStart(2, '0');
  const mon = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${day}.${mon} ${h}:${m}`;
}

function docToMatch(d: FirebaseFirestore.QueryDocumentSnapshot) {
  const data = d.data();
  return {
    id: d.id,
    ...data,
    commenceTime: data.commenceTime?.toMillis?.() ?? null,
    fixtureUpdatedAt: data.fixtureUpdatedAt?.toMillis?.() ?? null,
    kickoff: toKickoff(data.commenceTime),
  };
}

export async function GET() {
  // Serve from memory cache if fresh — 0 Firestore reads
  if (memCache && Date.now() < memCache.expiresAt) {
    return NextResponse.json(memCache.data, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600', 'X-Cache': 'HIT' },
    });
  }

  try {
    const twoHoursAgo = Timestamp.fromMillis(Date.now() - 2 * 60 * 60 * 1000);
    const [liveSnap, upcomingSnap] = await Promise.all([
      adminDb.collection('matches')
        .where('status', '==', 'live')
        .orderBy('commenceTime', 'asc')
        .limit(200)
        .get(),
      adminDb.collection('matches')
        .where('status', '==', 'upcoming')
        .where('commenceTime', '>', twoHoursAgo)
        .orderBy('commenceTime', 'asc')
        .limit(500)
        .get(),
    ]);

    const live = liveSnap.docs.map(docToMatch);
    const upcoming = upcomingSnap.docs.map(docToMatch);
    const data = { live, upcoming };

    memCache = { data, expiresAt: Date.now() + MEM_TTL_MS };

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600', 'X-Cache': 'MISS' },
    });
  } catch (e: any) {
    console.error('[api/matches]', e);
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
