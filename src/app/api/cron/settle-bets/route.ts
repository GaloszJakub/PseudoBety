import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { verifyCronToken } from '@/lib/cron-auth';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY || '';

const dateOffset = (ms: number) => new Date(Date.now() + ms).toISOString().split('T')[0];
const yesterday = () => dateOffset(-86400000);
const today = () => dateOffset(0);

function footballStatus(short: string): 'upcoming' | 'live' | 'finished' {
  if (['NS', 'TBD'].includes(short)) return 'upcoming';
  if (['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(short)) return 'finished';
  return 'live';
}

interface Selection {
  matchId: string;
  matchLabel?: string;
  pick: string;
  marketType?: string;
  odds: number;
  result?: 'won' | 'lost' | 'pending' | 'push';
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

type FinishedMatch = { score: [number, number]; home: string; away: string };

function resolveSelection(sel: Selection, m: FinishedMatch): 'won' | 'lost' | 'push' {
  const pick = sel.pick.toLowerCase();
  const mt = sel.marketType || 'h2h';
  const [homeScore, awayScore] = m.score;

  if (mt === 'h2h') {
    if (pick.startsWith('1 ·')) return homeScore > awayScore ? 'won' : 'lost';
    if (pick.startsWith('x ·') || pick.includes('remis')) return homeScore === awayScore ? 'won' : 'lost';
    if (pick.startsWith('2 ·')) return awayScore > homeScore ? 'won' : 'lost';
  }

  if (mt === 'totals') {
    const match = pick.match(/(\d+\.?\d*)/);
    const line = match ? parseFloat(match[1]) : 2.5;
    const total = homeScore + awayScore;
    if (total === line) return 'push';
    if (pick.startsWith('ponad')) return total > line ? 'won' : 'lost';
    if (pick.startsWith('poniżej')) return total < line ? 'won' : 'lost';
  }

  if (mt === 'btts') {
    const bothScored = homeScore > 0 && awayScore > 0;
    if (pick === 'tak') return bothScored ? 'won' : 'lost';
    if (pick === 'nie') return !bothScored ? 'won' : 'lost';
  }

  if (mt === 'double_chance') {
    if (pick.startsWith('1x')) return homeScore >= awayScore ? 'won' : 'lost';
    if (pick.startsWith('12')) return homeScore !== awayScore ? 'won' : 'lost';
    if (pick.startsWith('x2')) return awayScore >= homeScore ? 'won' : 'lost';
  }

  if (mt === 'draw_no_bet') {
    if (homeScore === awayScore) return 'push';
    const pickedHome = pick.includes(m.home);
    if (pickedHome) return homeScore > awayScore ? 'won' : 'lost';
    return awayScore > homeScore ? 'won' : 'lost';
  }

  if (mt === 'spreads') {
    // label formats from parseMarkets: "{home} 0", "{home} +{N}", "{away} +{N}"
    const hdpMatch = pick.match(/\s([+-]?\d+\.?\d*)\s*$/);
    const hdp = hdpMatch ? parseFloat(hdpMatch[1]) : 0;
    const pickedHome = pick.startsWith(m.home);
    const effective = pickedHome
      ? homeScore + hdp - awayScore
      : awayScore + hdp - homeScore;
    if (effective > 0) return 'won';
    if (effective === 0) return 'push';
    return 'lost';
  }

  return 'lost';
}

export async function GET(req: NextRequest) {
  const authError = verifyCronToken(req);
  if (authError) return authError;

  // 1. Aktualizuj mecze: live=all + yesterday + today (żeby złapać zakończone z wynikami)
  let liveUpdated = 0;
  if (API_FOOTBALL_KEY) {
    const urls = [
      'https://v3.football.api-sports.io/fixtures?live=all',
      `https://v3.football.api-sports.io/fixtures?date=${yesterday()}`,
      `https://v3.football.api-sports.io/fixtures?date=${today()}`,
    ];
    for (const url of urls) {
      try {
        const res = await fetch(url, {
          headers: { 'x-apisports-key': API_FOOTBALL_KEY },
          next: { revalidate: 0 },
        });
        if (!res.ok) continue;
        const json = await res.json();
        const fixtures = json.response || [];
        const batch = adminDb.batch();
        for (const f of fixtures) {
          const status = footballStatus(f.fixture.status.short);
          const ref = adminDb.doc(`matches/afoot-${f.fixture.id}`);
          batch.set(ref, {
            status,
            score: [f.goals.home ?? 0, f.goals.away ?? 0],
            minute: f.fixture.status.elapsed ? `${f.fixture.status.elapsed}'` : null,
            liveUpdatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
          liveUpdated++;
        }
        await batch.commit();
      } catch (_) {}
    }
  }

  // 2. Pobierz pending zakłady
  const pendingSnap = await adminDb.collection('bets')
    .where('status', '==', 'pending')
    .get();

  if (pendingSnap.empty) {
    return NextResponse.json({ ok: true, liveUpdated, finishedMatches: 0, settled: 0 });
  }

  // Zbierz unikalne ID meczów z oczekujących zakładów
  const matchIds = new Set<string>();
  for (const betDoc of pendingSnap.docs) {
    const bet = betDoc.data() as Bet;
    if (Array.isArray(bet.selections)) {
      for (const sel of bet.selections) {
        if (sel.matchId) {
          matchIds.add(sel.matchId);
        }
      }
    }
  }

  // Pobierz z bazy wyłącznie mecze powiązane z oczekującymi zakładami
  const finishedMap = new Map<string, FinishedMatch>();
  if (matchIds.size > 0) {
    const refs = Array.from(matchIds).map(id => adminDb.doc(`matches/${id}`));
    const matchSnaps = await adminDb.getAll(...refs);
    for (const snap of matchSnaps) {
      if (snap.exists) {
        const d = snap.data();
        if (d && d.status === 'finished' && d.score) {
          finishedMap.set(snap.id, {
            score: [d.score[0], d.score[1]],
            home: (d.home?.name || '').toLowerCase(),
            away: (d.away?.name || '').toLowerCase(),
          });
        }
      }
    }
  }

  const batch = adminDb.batch();
  let settled = 0;

  for (const betDoc of pendingSnap.docs) {
    const bet = { id: betDoc.id, ...betDoc.data() } as Bet;

    const resolved = bet.selections.map(sel => {
      const m = finishedMap.get(sel.matchId);
      if (!m) return { ...sel, result: 'pending' as const };
      return { ...sel, result: resolveSelection(sel, m) };
    });

    if (resolved.some(s => s.result === 'pending')) continue;

    // Push legs count as odds=1 (refund), non-push must all be won
    const newTotalOdds = resolved.reduce(
      (acc, s) => acc * (s.result === 'push' ? 1 : s.odds),
      1,
    );
    const nonPush = resolved.filter(s => s.result !== 'push');
    const allWon = nonPush.length === 0 ? true : nonPush.every(s => s.result === 'won');

    const actualWin = allWon ? bet.stake * newTotalOdds : 0;
    const status: 'won' | 'lost' = allWon ? 'won' : 'lost';

    batch.update(betDoc.ref, {
      status,
      actualWin,
      selections: resolved,
      settledAt: FieldValue.serverTimestamp(),
    });

    if (actualWin > 0) {
      batch.update(adminDb.doc(`users/${bet.userId}`), {
        balance: FieldValue.increment(actualWin),
      });
    }
    settled++;
  }

  await batch.commit();

  return NextResponse.json({ ok: true, liveUpdated, finishedMatches: finishedMap.size, settled });
}
