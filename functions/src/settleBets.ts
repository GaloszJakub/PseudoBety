import { ScheduledEvent } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY || '';

interface Selection {
  matchId: string;
  pick: string;       // np. "1 · Arsenal", "X · Remis", "2 · City"
  odds: number;
  result?: 'won' | 'lost' | 'pending';
}

interface Bet {
  id: string;
  userId: string;
  stake: number;
  totalOdds: number;
  potentialWin: number;
  status: 'pending' | 'won' | 'lost';
  selections: Selection[];
}

function determineSelectionResult(
  pick: string,
  homeScore: number,
  awayScore: number
): 'won' | 'lost' {
  const lowerPick = pick.toLowerCase();

  if (lowerPick.startsWith('1 ·') || lowerPick.includes('home')) {
    return homeScore > awayScore ? 'won' : 'lost';
  }
  if (lowerPick.startsWith('x ·') || lowerPick.includes('remis') || lowerPick.includes('draw')) {
    return homeScore === awayScore ? 'won' : 'lost';
  }
  if (lowerPick.startsWith('2 ·') || lowerPick.includes('away')) {
    return awayScore > homeScore ? 'won' : 'lost';
  }

  return 'lost';
}

export async function settleBetsJob(_event: ScheduledEvent) {
  const db = getFirestore();

  // 1. Aktualizuj live mecze z API-Football
  if (API_FOOTBALL_KEY) {
    try {
      const res = await fetch('https://v3.football.api-sports.io/fixtures?live=all', {
        headers: { 'x-apisports-key': API_FOOTBALL_KEY },
      });

      if (res.ok) {
        const json = await res.json();
        const liveFixtures = json.response || [];
        const batch = db.batch();

        for (const f of liveFixtures) {
          const ref = db.doc(`matches/afoot-${f.fixture.id}`);
          batch.update(ref, {
            status: 'live',
            score: [f.goals.home ?? 0, f.goals.away ?? 0],
            minute: f.fixture.status.elapsed ? `${f.fixture.status.elapsed}'` : null,
            liveUpdatedAt: FieldValue.serverTimestamp(),
          });
        }
        await batch.commit();
        console.log(`settleBets: updated ${liveFixtures.length} live matches`);
      }
    } catch (err) {
      console.error('settleBets live update error:', err);
    }
  }

  // 2. Znajdź mecze zakończone w ostatnich 2h które mają wyniki
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const finishedSnap = await db.collection('matches')
    .where('status', '==', 'finished')
    .where('fixtureUpdatedAt', '>=', twoHoursAgo)
    .get();

  if (finishedSnap.empty) {
    console.log('settleBets: no recently finished matches');
    return;
  }

  const finishedMatches = new Map<string, { homeScore: number; awayScore: number }>();
  for (const doc of finishedSnap.docs) {
    const data = doc.data();
    if (data.score) {
      finishedMatches.set(doc.id, { homeScore: data.score[0], awayScore: data.score[1] });
    }
  }

  if (finishedMatches.size === 0) return;

  // 3. Znajdź pending zakłady na te mecze
  const pendingSnap = await db.collection('bets')
    .where('status', '==', 'pending')
    .get();

  if (pendingSnap.empty) return;

  console.log(`settleBets: checking ${pendingSnap.size} pending bets against ${finishedMatches.size} finished matches`);

  const batchSettle = db.batch();
  let settled = 0;

  for (const betDoc of pendingSnap.docs) {
    const bet = { id: betDoc.id, ...betDoc.data() } as Bet;

    // Sprawdź czy wszystkie selekcje mają wyniki
    const selectionsWithResults = bet.selections.map(sel => {
      const matchResult = finishedMatches.get(sel.matchId);
      if (!matchResult) return { ...sel, result: 'pending' as const };

      return {
        ...sel,
        result: determineSelectionResult(sel.pick, matchResult.homeScore, matchResult.awayScore),
      };
    });

    // Zakład rozliczamy tylko gdy wszystkie selekcje mają wynik (nie pending)
    const allSettled = selectionsWithResults.every(s => s.result !== 'pending');
    if (!allSettled) continue;

    const betWon = selectionsWithResults.every(s => s.result === 'won');
    const actualWin = betWon ? bet.potentialWin : 0;

    batchSettle.update(betDoc.ref, {
      status: betWon ? 'won' : 'lost',
      actualWin,
      selections: selectionsWithResults,
      settledAt: FieldValue.serverTimestamp(),
    });

    // Wypłać wygraną do salda użytkownika
    if (betWon) {
      const userRef = db.doc(`users/${bet.userId}`);
      batchSettle.update(userRef, {
        balance: FieldValue.increment(actualWin),
      });
    }

    settled++;
  }

  await batchSettle.commit();
  console.log(`settleBets: settled ${settled} bets`);
}
