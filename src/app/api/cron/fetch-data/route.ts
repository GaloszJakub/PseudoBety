import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { verifyCronToken } from '@/lib/cron-auth';
import fs from 'fs';
import path from 'path';

// Temporary: load football events from local file if present (avoids API rate limit)
// File: <project_root>/wynikapi.json — from odds-api.io /events?sport=football
// Delete file when API rate limit is no longer a concern.
function loadLocalFootballEvents(): { id: number; home: string; away: string; date: string }[] {
  const filePath = path.join(process.cwd(), '..', 'wynikapi.json');
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data.filter((e: any) => e.status === 'pending') : [];
  } catch { return []; }
}

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// ─── Date helpers ─────────────────────────────────────────────────────────────

const dateOffset = (ms: number) => new Date(Date.now() + ms).toISOString().split('T')[0];
const yesterday = () => dateOffset(-86400000);
const today = () => dateOffset(0);
const tomorrow = () => dateOffset(86400000);

// ─── Odds API types + helpers (odds-api.io) ────────────────────────────────────

interface OddsApiOutcome { home?: string; away?: string; draw?: string; hdp?: number; over?: string; under?: string; yes?: string; no?: string; }
interface OddsApiMarket { name: string; updatedAt: string; odds: OddsApiOutcome[]; }
interface OddsEvent {
  id: number;
  home: string;
  away: string;
  date: string;
  status: string;
  sport: { name: string; slug: string };
  league: { name: string; slug: string };
  bookmakers: Record<string, OddsApiMarket[]>;
}

// map api-sports.io sport name → odds-api.io slug
const API_SPORT_TO_ODDS_SLUG: Record<string, string> = {
  football: 'football',
  basketball: 'basketball',
  hockey: 'ice-hockey',
  nfl: 'american-football',
  volleyball: 'volleyball',
  handball: 'handball',
  mma: 'mixed-martial-arts',
};

const MARKET_META: Record<string, { name: string; subtitle: string }> = {
  h2h:           { name: 'Wynik meczu (1X2)',  subtitle: 'Pełny czas gry' },
  totals:        { name: 'Liczba goli',         subtitle: 'Ponad / Poniżej' },
  spreads:       { name: 'Handicap',            subtitle: 'Wyrównanie' },
  btts:          { name: 'Obie strzelą gola',   subtitle: 'BTTS · pełny czas' },
  double_chance: { name: 'Podwójna szansa',     subtitle: 'Wynik meczu' },
  draw_no_bet:   { name: 'Remis bez zakładu',   subtitle: 'Zwrot przy remisie' },
};

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}


function nameScore(a: string, b: string): number {
  if (a === b) return 3;
  if (a.includes(b) || b.includes(a)) return 2;
  const triA = new Set<string>();
  for (let i = 0; i <= a.length - 3; i++) triA.add(a.slice(i, i + 3));
  let shared = 0;
  for (let i = 0; i <= b.length - 3; i++) if (triA.has(b.slice(i, i + 3))) shared++;
  const total = Math.max(triA.size + Math.max(b.length - 2, 0), 1);
  return shared / total;
}

const timeBucket = (ms: number) => Math.floor(ms / 7_200_000);
const r2 = (n: number) => Math.round(n * 100) / 100;


function deriveExtraMarkets(
  homeTeam: string, awayTeam: string,
  homePrice: number, drawPrice: number | null, awayPrice: number,
): object[] {
  const extra: object[] = [];
  const pH = 1 / homePrice;
  const pA = 1 / awayPrice;
  const pD = drawPrice ? 1 / drawPrice : 0;
  const or = pH + pA + pD || 1;
  const nH = pH / or, nA = pA / or, nD = pD / or;

  if (drawPrice) {
    extra.push({
      type: 'double_chance', ...MARKET_META['double_chance'],
      outcomes: [
        { label: `1X · ${homeTeam} lub Remis`, value: r2(1 / (nH + nD)) },
        { label: `12 · ${homeTeam} lub ${awayTeam}`, value: r2(1 / (nH + nA)) },
        { label: `X2 · Remis lub ${awayTeam}`, value: r2(1 / (nD + nA)) },
      ],
    });
    extra.push({
      type: 'draw_no_bet', ...MARKET_META['draw_no_bet'],
      outcomes: [
        { label: `DNB · ${homeTeam}`, value: r2(1 / (nH / (nH + nA))) },
        { label: `DNB · ${awayTeam}`, value: r2(1 / (nA / (nH + nA))) },
      ],
    });
  }
  return extra;
}

function parseMarkets(event: OddsEvent): {
  odds: { home: number; draw: number | null; away: number } | null;
  markets: object[];
} {
  const bms = Object.values(event.bookmakers ?? {});
  if (bms.length === 0) return { odds: null, markets: [] };

  // Use first available bookmaker
  const bmMarkets = bms[0];
  let odds: { home: number; draw: number | null; away: number } | null = null;
  const markets: object[] = [];

  for (const m of bmMarkets) {
    const o0 = m.odds?.[0];
    if (!o0) continue;

    if (m.name === 'ML') {
      const h = parseFloat(o0.home ?? '0');
      const a = parseFloat(o0.away ?? '0');
      const d = o0.draw ? parseFloat(o0.draw) : null;
      if (!h || !a) continue;
      odds = { home: h, draw: d, away: a };
      const outcomes: object[] = [
        { label: `1 · ${event.home}`, value: h },
        ...(d ? [{ label: 'X · Remis', value: d }] : []),
        { label: `2 · ${event.away}`, value: a },
      ];
      markets.push({ type: 'h2h', ...MARKET_META['h2h'], outcomes });

    } else if (m.name === 'Totals') {
      const byPoint: Record<number, object[]> = {};
      for (const o of m.odds) {
        const pt = o.hdp ?? 2.5;
        if (!byPoint[pt]) byPoint[pt] = [];
        byPoint[pt].push(
          { label: `Ponad ${pt}`, sub: `${pt} goli`, value: parseFloat(o.over ?? '0') },
          { label: `Poniżej ${pt}`, sub: `${pt} goli`, value: parseFloat(o.under ?? '0') },
        );
      }
      const outcomes: object[] = [];
      for (const pt of Object.keys(byPoint).sort((a, b) => Number(a) - Number(b))) {
        outcomes.push(...byPoint[Number(pt)]);
      }
      if (outcomes.length > 0) markets.push({ type: 'totals', ...MARKET_META['totals'], outcomes });

    } else if (m.name === 'Asian Handicap') {
      const outcomes = m.odds.map((o: OddsApiOutcome) => {
        const hdp = o.hdp ?? 0;
        return {
          label: hdp === 0
            ? `${event.home} 0`
            : hdp > 0
              ? `${event.home} +${hdp}`
              : `${event.away} +${Math.abs(hdp)}`,
          value: parseFloat(o.home ?? '0'),
        };
      }).filter((o: any) => o.value > 0);
      if (outcomes.length > 0) markets.push({ type: 'spreads', ...MARKET_META['spreads'], outcomes });

    } else if (m.name === 'Both Teams to Score') {
      const outcomes: object[] = [];
      for (const o of m.odds) {
        if (o.yes) outcomes.push({ label: 'Tak', value: parseFloat(o.yes) });
        if (o.no) outcomes.push({ label: 'Nie', value: parseFloat(o.no) });
      }
      if (outcomes.length > 0) markets.push({ type: 'btts', ...MARKET_META['btts'], outcomes });
    }
  }

  if (odds) markets.push(...deriveExtraMarkets(event.home, event.away, odds.home, odds.draw, odds.away));
  return { odds, markets };
}

// ─── Fixture status helpers ───────────────────────────────────────────────────

function footballStatus(short: string): 'upcoming' | 'live' | 'finished' {
  if (['NS', 'TBD'].includes(short)) return 'upcoming';
  if (['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(short)) return 'finished';
  return 'live';
}

function gameStatus(s: string): 'upcoming' | 'live' | 'finished' {
  const st = (s || '').toLowerCase();
  if (['ns', 'tbd', 'scheduled', 'not started'].includes(st)) return 'upcoming';
  if (['ft', 'finished', 'after ot', 'aot', 'after penalties', 'final', 'aet', 'pen', 'f/ot', 'canc', 'cancelled', 'awd', 'wo'].includes(st)) return 'finished';
  return 'live';
}

// ─── Per-sport fixture fetchers ───────────────────────────────────────────────

interface FixtureDoc {
  externalId: string;
  source: string;
  sport: string;
  competition: string;
  country: string | null;
  countryFlag: string | null;
  home: { name: string; code: string; logo?: string };
  away: { name: string; code: string; logo?: string };
  commenceTime: Date;
  commenceMs: number;
  venue?: string;
  status: 'upcoming' | 'live' | 'finished';
  score: number[] | null;
  minute: string | null;
}

async function fetchFootball(apiKey: string, dates: string[]): Promise<{ docs: FixtureDoc[]; errors: string[] }> {
  const docs: FixtureDoc[] = [];
  const errors: string[] = [];
  for (const date of dates) {
    try {
      const res = await fetch(`https://v3.football.api-sports.io/fixtures?date=${date}`, {
        headers: { 'x-apisports-key': apiKey }, next: { revalidate: 0 },
      });
      if (!res.ok) { errors.push(`football/${date}: ${res.status}`); continue; }
      const json = await res.json();
      for (const f of json.response || []) {
        const status = footballStatus(f.fixture.status.short);
        const dt = new Date(f.fixture.date);
        docs.push({
          externalId: `afoot-${f.fixture.id}`,
          source: 'api-football', sport: 'football',
          competition: f.league.name,
          country: f.league.country || null,
          countryFlag: f.league.flag || null,
          home: { name: f.teams.home.name, code: f.teams.home.name.slice(0, 3).toUpperCase(), logo: f.teams.home.logo },
          away: { name: f.teams.away.name, code: f.teams.away.name.slice(0, 3).toUpperCase(), logo: f.teams.away.logo },
          commenceTime: dt, commenceMs: dt.getTime(),
          venue: `${f.fixture.venue?.name || ''}, ${f.fixture.venue?.city || ''}`,
          status,
          score: status !== 'upcoming' ? [f.goals.home ?? 0, f.goals.away ?? 0] : null,
          minute: f.fixture.status.elapsed ? `${f.fixture.status.elapsed}'` : null,
        });
      }
    } catch (e: any) { errors.push(`football/${date}: ${e.message}`); }
  }
  return { docs, errors };
}

async function fetchSport(
  url: string, sport: string, apiKey: string, dates: string[],
  mapFn: (g: any) => Omit<FixtureDoc, 'commenceMs'> | null,
): Promise<{ docs: FixtureDoc[]; errors: string[] }> {
  const docs: FixtureDoc[] = [];
  const errors: string[] = [];
  for (const date of dates) {
    try {
      const res = await fetch(`${url}?date=${date}`, {
        headers: { 'x-apisports-key': apiKey }, next: { revalidate: 0 },
      });
      if (!res.ok) { errors.push(`${sport}/${date}: ${res.status}`); continue; }
      const json = await res.json();
      for (const g of json.response || []) {
        const mapped = mapFn(g);
        if (!mapped) continue;
        docs.push({ ...mapped, commenceMs: mapped.commenceTime.getTime() });
      }
    } catch (e: any) { errors.push(`${sport}/${date}: ${e.message}`); }
  }
  return { docs, errors };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const authError = verifyCronToken(req);
  if (authError) return authError;

  const apiKey = process.env.API_FOOTBALL_KEY;
  const oddsKey = process.env.ODDS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'API_FOOTBALL_KEY not set' }, { status: 500 });
  if (!oddsKey) return NextResponse.json({ error: 'ODDS_API_KEY not set' }, { status: 500 });

  const errors: string[] = [];
  const dates = [yesterday(), today(), tomorrow()];
  const yest = yesterday();

  // ── Phase 1: Fetch event lists from odds-api.io, build name index ────────────
  // Only fetch odds for events that actually match fixtures (Phase 3).
  // This keeps requests at: N_sports + N_matched/10 (well within 100 req/hour limit).

  const BASE_ODDS = 'https://api.odds-api.io/v3';

  // name index: `${slug}_${bucket}` → OddsEvent (no odds yet, just id+teams+date)
  type SlimEvent = { id: number; home: string; away: string; date: string };
  const eventIndex = new Map<string, SlimEvent[]>();

  let oddsGames = 0;
  try {
    const sportsRes = await fetch(`${BASE_ODDS}/sports`, { next: { revalidate: 0 } });
    if (!sportsRes.ok) {
      errors.push(`odds/sports: ${sportsRes.status}`);
    } else {
      // Only fetch events for sports we actually have fixtures for (saves ~27 requests)
      const NEEDED_SLUGS = new Set(Object.values(API_SPORT_TO_ODDS_SLUG));
      const sportsData: { name: string; slug: string }[] = await sportsRes.json();
      const activeSports = Array.isArray(sportsData)
        ? sportsData.filter(s => NEEDED_SLUGS.has(s.slug))
        : [];

      // Load football from local file if available (rate limit fallback)
      const localFootball = loadLocalFootballEvents();
      if (localFootball.length > 0) {
        for (const ev of localFootball) {
          const ms = new Date(ev.date).getTime();
          const key = `football_${timeBucket(ms)}`;
          if (!eventIndex.has(key)) eventIndex.set(key, []);
          eventIndex.get(key)!.push(ev);
        }
        errors.push(`events/football: loaded ${localFootball.length} from local file`);
      }

      // Skip API calls for sports if rate-limited (localFootball signals we're in fallback mode)
      if (localFootball.length > 0) {
        errors.push('events/other: skipped (local file mode)');
      }

      // In local-file mode skip all API events calls (save all remaining requests for odds/multi)
      for (const sport of (localFootball.length > 0 ? [] : activeSports)) {
        try {
          const eventsRes = await fetch(
            `${BASE_ODDS}/events?sport=${sport.slug}&apiKey=${oddsKey}`,
            { next: { revalidate: 0 } }
          );
          if (!eventsRes.ok) { errors.push(`events/${sport.slug}: ${eventsRes.status}`); continue; }
          const events: SlimEvent[] = await eventsRes.json();
          if (!Array.isArray(events)) continue;
          for (const ev of events) {
            const ms = new Date(ev.date).getTime();
            const key = `${sport.slug}_${timeBucket(ms)}`;
            if (!eventIndex.has(key)) eventIndex.set(key, []);
            eventIndex.get(key)!.push(ev);
          }
        } catch (e: any) { errors.push(`events/${sport.slug}: ${e.message}`); }
      }
    }
  } catch (e: any) {
    errors.push(`odds/sports: ${e.message}`);
  }

  // Helper: find event in name index (same trigram logic, no odds yet)
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

  // Placeholder — oddsIndex populated later for matched events only
  const oddsIndex = new Map<number, OddsEvent>(); // eventId → full event with odds

  // ── Phase 2: Fetch fixtures, match against oddsIndex ──────────────────────

  const allDocs: FixtureDoc[] = [];

  const fb = await fetchFootball(apiKey, dates);
  allDocs.push(...fb.docs);
  errors.push(...fb.errors);


  // ── Phase 3a: Match fixtures to event index, collect IDs ──────────────────────

  let written = 0;
  let skippedNoOdds = 0;
  let matched = 0;

  // Split docs into yesterday (always write) and today/tomorrow (need odds)
  const yesterdayDocs: FixtureDoc[] = [];
  const needOddsDocs: { doc: FixtureDoc; eventId: number }[] = [];

  for (const doc of allDocs) {
    const isYesterday = doc.commenceTime.toISOString().split('T')[0] === yest;
    if (isYesterday || doc.status === 'live') {
      yesterdayDocs.push(doc);
      continue;
    }
    const ev = findEvent(norm(doc.home.name), norm(doc.away.name), doc.commenceMs, doc.sport);
    if (ev) needOddsDocs.push({ doc, eventId: ev.id });
    else skippedNoOdds++;
  }

  // ── Phase 3b: Batch fetch odds for matched events only ─────────────────────
  // max 10 per request → N_matched/10 requests total (very cheap)

  const matchedIds = [...new Set(needOddsDocs.map(x => x.eventId))].slice(0, 200);
  for (let i = 0; i < matchedIds.length; i += 10) {
    const ids = matchedIds.slice(i, i + 10).join(',');
    try {
      const oddsRes = await fetch(
        `${BASE_ODDS}/odds/multi?eventIds=${ids}&bookmakers=Bet365,22Bet&apiKey=${oddsKey}`,
        { next: { revalidate: 0 } }
      );
      if (!oddsRes.ok) {
        const body = await oddsRes.text().catch(() => '');
        errors.push(`odds/multi: ${oddsRes.status} — ${body.slice(0, 200)}`);
        continue;
      }
      const oddsData: OddsEvent[] = await oddsRes.json();
      if (!Array.isArray(oddsData)) continue;
      for (const ev of oddsData) {
        oddsIndex.set(ev.id, ev);
        oddsGames++;
      }
    } catch (e: any) { errors.push(`odds/multi: ${e.message}`); }
  }

  // ── Phase 3c: Build write queue ───────────────────────────────────────────

  const toWrite: { id: string; data: object }[] = [];

  // Yesterday docs — always write (for settle-bets finished status)
  for (const doc of yesterdayDocs) {
    toWrite.push({
      id: doc.externalId,
      data: {
        externalId: doc.externalId, source: doc.source, sport: doc.sport,
        competition: doc.competition, country: doc.country, countryFlag: doc.countryFlag,
        home: doc.home, away: doc.away, commenceTime: doc.commenceTime,
        venue: (doc as any).venue ?? null, status: doc.status,
        score: doc.score, minute: doc.minute,
        fixtureUpdatedAt: FieldValue.serverTimestamp(),
      },
    });
  }

  // Today/tomorrow docs — write only if odds found
  for (const { doc, eventId } of needOddsDocs) {
    const oddsEvent = oddsIndex.get(eventId);
    if (!oddsEvent) { skippedNoOdds++; continue; }

    const { odds, markets } = parseMarkets(oddsEvent);
    if (!odds) { skippedNoOdds++; continue; }

    matched++;
    toWrite.push({
      id: doc.externalId,
      data: {
        externalId: doc.externalId, source: doc.source, sport: doc.sport,
        competition: doc.competition, country: doc.country, countryFlag: doc.countryFlag,
        home: doc.home, away: doc.away, commenceTime: doc.commenceTime,
        venue: (doc as any).venue ?? null, status: doc.status,
        score: doc.score, minute: doc.minute,
        odds, markets,
        oddsUpdatedAt: FieldValue.serverTimestamp(),
        fixtureUpdatedAt: FieldValue.serverTimestamp(),
      },
    });
  }

  // Batch write in chunks of 400
  for (let i = 0; i < toWrite.length; i += 400) {
    const batch = adminDb.batch();
    for (const { id, data } of toWrite.slice(i, i + 400)) {
      batch.set(adminDb.doc(`matches/${id}`), data, { merge: true });
      written++;
    }
    await batch.commit();
  }

  return NextResponse.json({
    ok: true,
    oddsGames,
    fixturesTotal: allDocs.length,
    fixturesWritten: written,
    fixturesWithOdds: matched,
    fixturesSkippedNoOdds: skippedNoOdds,
    errors,
  });
}
