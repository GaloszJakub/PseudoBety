import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { verifyCronToken } from '@/lib/cron-auth';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const dateOffset = (ms: number) => new Date(Date.now() + ms).toISOString().split('T')[0];
const yesterday = () => dateOffset(-86400000);
const today = () => dateOffset(0);
const tomorrow = () => dateOffset(86400000);

function footballStatus(short: string): 'upcoming' | 'live' | 'finished' {
  if (['NS', 'TBD'].includes(short)) return 'upcoming';
  if (['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(short)) return 'finished';
  return 'live';
}

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
          commenceTime: dt,
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

export async function GET(req: NextRequest) {
  const authError = verifyCronToken(req);
  if (authError) return authError;

  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) return NextResponse.json({ error: 'API_FOOTBALL_KEY not set' }, { status: 500 });

  const dates = [yesterday(), today(), tomorrow()];
  const { docs, errors } = await fetchFootball(apiKey, dates);

  let written = 0;
  for (let i = 0; i < docs.length; i += 400) {
    const batch = adminDb.batch();
    for (const doc of docs.slice(i, i + 400)) {
      batch.set(
        adminDb.doc(`matches/${doc.externalId}`),
        {
          externalId: doc.externalId, source: doc.source, sport: doc.sport,
          competition: doc.competition, country: doc.country, countryFlag: doc.countryFlag,
          home: doc.home, away: doc.away,
          commenceTime: doc.commenceTime,
          venue: doc.venue ?? null,
          status: doc.status,
          score: doc.score,
          minute: doc.minute,
          fixtureUpdatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      written++;
    }
    await batch.commit();
  }

  return NextResponse.json({
    ok: true,
    fixturesTotal: docs.length,
    fixturesWritten: written,
    errors,
  });
}
