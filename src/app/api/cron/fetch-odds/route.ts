import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { verifyCronToken } from '@/lib/cron-auth';
import {
  norm, nameScore, timeBucket, parseMarkets,
  API_SPORT_TO_ODDS_SLUG, OddsEvent, SlimEvent,
} from '@/lib/odds-helpers';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const BASE_ODDS = 'https://api.odds-api.io/v3';

export async function GET(req: NextRequest) {
  const authError = verifyCronToken(req);
  if (authError) return authError;

  const oddsKey = process.env.ODDS_API_KEY;
  if (!oddsKey) return NextResponse.json({ error: 'ODDS_API_KEY not set' }, { status: 500 });

  const errors: string[] = [];

  // ── Phase 1: Read upcoming fixtures from Firestore ──────────────────────────
  // Only upcoming (not live/finished) — those need fresh odds
  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 3600 * 1000);

  const snap = await adminDb.collection('matches')
    .where('status', '==', 'upcoming')
    .where('commenceTime', '>=', now)
    .where('commenceTime', '<=', in48h)
    .orderBy('commenceTime', 'asc')
    .get();

  const fixtures = snap.docs.map(d => {
    const data = d.data();
    const ms = data.commenceTime?.toMillis?.() ?? 0;
    return {
      id: d.id,
      home: data.home?.name ?? '',
      away: data.away?.name ?? '',
      sport: data.sport ?? 'football',
      commenceMs: ms,
    };
  });

  // ── Phase 2: Build event index from odds-api.io ─────────────────────────────

  const eventIndex = new Map<string, SlimEvent[]>();
  const NEEDED_SLUGS = new Set(Object.values(API_SPORT_TO_ODDS_SLUG));

  try {
    const sportsRes = await fetch(`${BASE_ODDS}/sports`, { next: { revalidate: 0 } });
    if (!sportsRes.ok) {
      errors.push(`odds/sports: ${sportsRes.status}`);
    } else {
      const sportsData: { name: string; slug: string }[] = await sportsRes.json();
      const activeSports = Array.isArray(sportsData)
        ? sportsData.filter(s => NEEDED_SLUGS.has(s.slug))
        : [];

      await Promise.all(activeSports.map(async sport => {
        try {
          const res = await fetch(
            `${BASE_ODDS}/events?sport=${sport.slug}&apiKey=${oddsKey}`,
            { next: { revalidate: 0 } },
          );
          if (!res.ok) { errors.push(`events/${sport.slug}: ${res.status}`); return; }
          const events: SlimEvent[] = await res.json();
          if (!Array.isArray(events)) return;
          for (const ev of events) {
            const ms = new Date(ev.date).getTime();
            const key = `${sport.slug}_${timeBucket(ms)}`;
            if (!eventIndex.has(key)) eventIndex.set(key, []);
            eventIndex.get(key)!.push(ev);
          }
        } catch (e: any) { errors.push(`events/${sport.slug}: ${e.message}`); }
      }));
    }
  } catch (e: any) {
    errors.push(`odds/sports: ${e.message}`);
  }

  // ── Phase 3: Match fixtures → event index ──────────────────────────────────

  function findEvent(normHome: string, normAway: string, commenceMs: number, sport: string): SlimEvent | null {
    const slug = API_SPORT_TO_ODDS_SLUG[sport] || sport;
    const bucket = timeBucket(commenceMs);
    let best: SlimEvent | null = null;
    let bestScore = 0;
    for (const b of [bucket - 1, bucket, bucket + 1]) {
      const events = eventIndex.get(`${slug}_${b}`);
      if (!events) continue;
      for (const ev of events) {
        const hs = nameScore(normHome, norm(ev.home));
        const as_ = nameScore(normAway, norm(ev.away));
        if (hs < 1 || as_ < 1) continue;
        const score = hs + as_;
        if (score > bestScore) { bestScore = score; best = ev; }
      }
    }
    return best;
  }

  const matched: { firestoreId: string; eventId: number }[] = [];
  for (const f of fixtures) {
    const ev = findEvent(norm(f.home), norm(f.away), f.commenceMs, f.sport);
    if (ev) matched.push({ firestoreId: f.id, eventId: ev.id });
  }

  // ── Phase 4: Fetch odds for matched events ──────────────────────────────────

  const oddsIndex = new Map<number, OddsEvent>();
  const uniqueIds = [...new Set(matched.map(m => m.eventId))].slice(0, 200);

  let oddsGames = 0;
  for (let i = 0; i < uniqueIds.length; i += 10) {
    const ids = uniqueIds.slice(i, i + 10).join(',');
    try {
      const res = await fetch(
        `${BASE_ODDS}/odds/multi?eventIds=${ids}&bookmakers=Bet365,22Bet&apiKey=${oddsKey}`,
        { next: { revalidate: 0 } },
      );
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        errors.push(`odds/multi: ${res.status} — ${body.slice(0, 200)}`);
        continue;
      }
      const data: OddsEvent[] = await res.json();
      if (!Array.isArray(data)) continue;
      for (const ev of data) { oddsIndex.set(ev.id, ev); oddsGames++; }
    } catch (e: any) { errors.push(`odds/multi: ${e.message}`); }
  }

  // ── Phase 5: Write odds to matched Firestore docs ──────────────────────────

  let written = 0;
  let skipped = 0;
  const toWrite: { id: string; odds: object; markets: object[] }[] = [];

  for (const { firestoreId, eventId } of matched) {
    const oddsEvent = oddsIndex.get(eventId);
    if (!oddsEvent) { skipped++; continue; }
    const { odds, markets } = parseMarkets(oddsEvent);
    if (!odds) { skipped++; continue; }
    toWrite.push({ id: firestoreId, odds, markets });
  }

  for (let i = 0; i < toWrite.length; i += 400) {
    const batch = adminDb.batch();
    for (const { id, odds, markets } of toWrite.slice(i, i + 400)) {
      batch.update(adminDb.doc(`matches/${id}`), {
        odds,
        markets,
        oddsUpdatedAt: FieldValue.serverTimestamp(),
      });
      written++;
    }
    await batch.commit();
  }

  return NextResponse.json({
    ok: true,
    fixturesRead: fixtures.length,
    matchedToOdds: matched.length,
    oddsGames,
    written,
    skipped,
    errors,
  });
}
