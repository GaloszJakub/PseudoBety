import { ScheduledEvent } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY || '';

// Liga Mistrzów=2, Premier League=39, La Liga=140, Bundesliga=78, Serie A=135, Ligue 1=61,
// Roland Garros=1062(tennis), NBA=12(basketball)
const FOOTBALL_LEAGUES = [2, 39, 140, 78, 135, 61];

interface ApiFixture {
  fixture: {
    id: number;
    date: string;
    status: { short: string; elapsed: number | null };
    venue: { name: string; city: string };
  };
  league: { id: number; name: string; country: string };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  goals: { home: number | null; away: number | null };
}

function statusMap(short: string): 'upcoming' | 'live' | 'finished' {
  if (['NS', 'TBD'].includes(short)) return 'upcoming';
  if (['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(short)) return 'finished';
  return 'live';
}

export async function fetchFixturesJob(_event: ScheduledEvent) {
  if (!API_FOOTBALL_KEY) {
    console.warn('API_FOOTBALL_KEY not set — skipping fetchFixtures');
    return;
  }

  const db = getFirestore();

  // Pobierz mecze na dziś + jutro
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const dates = [today, tomorrow].map(d => d.toISOString().split('T')[0]);

  let written = 0;

  for (const date of dates) {
    for (const leagueId of FOOTBALL_LEAGUES) {
      try {
        const res = await fetch(
          `https://v3.football.api-sports.io/fixtures?date=${date}&league=${leagueId}&season=2024`,
          { headers: { 'x-apisports-key': API_FOOTBALL_KEY } }
        );

        if (!res.ok) {
          console.error(`fetchFixtures [league ${leagueId} ${date}]: ${res.status}`);
          continue;
        }

        const json = await res.json();
        const fixtures: ApiFixture[] = json.response || [];
        const batch = db.batch();

        for (const f of fixtures) {
          const status = statusMap(f.fixture.status.short);
          const ref = db.doc(`matches/afoot-${f.fixture.id}`);

          batch.set(ref, {
            externalId: `afoot-${f.fixture.id}`,
            apiFootballId: f.fixture.id,
            sport: 'football',
            competition: f.league.name,
            home: {
              name: f.teams.home.name,
              code: f.teams.home.name.slice(0, 3).toUpperCase(),
            },
            away: {
              name: f.teams.away.name,
              code: f.teams.away.name.slice(0, 3).toUpperCase(),
            },
            commenceTime: new Date(f.fixture.date),
            venue: `${f.fixture.venue.name}, ${f.fixture.venue.city}`,
            status,
            score: status !== 'upcoming'
              ? [f.goals.home ?? 0, f.goals.away ?? 0]
              : null,
            minute: f.fixture.status.elapsed ? `${f.fixture.status.elapsed}'` : null,
            fixtureUpdatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
          written++;
        }

        await batch.commit();
      } catch (err) {
        console.error(`fetchFixtures [${leagueId}/${date}] error:`, err);
      }
    }
  }

  console.log(`fetchFixtures: wrote ${written} fixtures`);
}
