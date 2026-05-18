import { ScheduledEvent } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const ODDS_API_KEY = process.env.ODDS_API_KEY || '';
const SPORTS = ['soccer_epl', 'soccer_france_ligue_one', 'soccer_spain_la_liga',
                'soccer_germany_bundesliga', 'soccer_italy_serie_a', 'soccer_uefa_champs_league',
                'tennis_atp_french_open', 'basketball_nba'];

interface OddsGame {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: {
    markets: {
      key: string;
      outcomes: { name: string; price: number }[];
    }[];
  }[];
}

function extractOdds(game: OddsGame) {
  const bookmaker = game.bookmakers?.[0];
  if (!bookmaker) return null;
  const h2h = bookmaker.markets.find(m => m.key === 'h2h');
  if (!h2h) return null;

  const outcomes = h2h.outcomes;
  const home = outcomes.find(o => o.name === game.home_team)?.price;
  const away = outcomes.find(o => o.name === game.away_team)?.price;
  const draw = outcomes.find(o => o.name === 'Draw')?.price;

  if (!home || !away) return null;
  return { home, draw: draw ?? null, away };
}

function sportCategory(sportKey: string): string {
  if (sportKey.startsWith('soccer')) return 'football';
  if (sportKey.startsWith('tennis')) return 'tennis';
  if (sportKey.startsWith('basketball')) return 'basketball';
  return 'other';
}

export async function fetchOddsJob(_event: ScheduledEvent) {
  if (!ODDS_API_KEY) {
    console.warn('ODDS_API_KEY not set — skipping fetchOdds');
    return;
  }

  const db = getFirestore();
  const batch = db.batch();
  let written = 0;

  for (const sport of SPORTS) {
    try {
      const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds/` +
        `?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h&oddsFormat=decimal&dateFormat=iso`;

      const res = await fetch(url);
      if (!res.ok) {
        console.error(`fetchOdds [${sport}]: ${res.status} ${await res.text()}`);
        continue;
      }

      const games: OddsGame[] = await res.json();

      for (const game of games) {
        const odds = extractOdds(game);
        if (!odds) continue;

        const ref = db.doc(`matches/${game.id}`);
        batch.set(ref, {
          externalId: game.id,
          sport: sportCategory(game.sport_key),
          competition: game.sport_title,
          homeTeam: game.home_team,
          awayTeam: game.away_team,
          home: { name: game.home_team, code: game.home_team.slice(0, 3).toUpperCase() },
          away: { name: game.away_team, code: game.away_team.slice(0, 3).toUpperCase() },
          commenceTime: new Date(game.commence_time),
          odds,
          status: 'upcoming',
          oddsUpdatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        written++;
      }
    } catch (err) {
      console.error(`fetchOdds [${sport}] error:`, err);
    }
  }

  await batch.commit();
  console.log(`fetchOdds: wrote ${written} matches`);
}
