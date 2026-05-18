import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { verifyCronToken } from '@/lib/cron-auth';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY || '';

interface Selection {
  matchId: string;
  matchLabel?: string;
  pick: string;
  marketType?: string;
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

function resolveSelection(sel: Selection, homeScore: number, awayScore: number): 'won' | 'lost' {
  const pick = sel.pick.toLowerCase();
  const mt = sel.marketType || 'h2h';

  if (mt === 'h2h') {
    if (pick.startsWith('1 ·')) return homeScore > awayScore ? 'won' : 'lost';
    if (pick.startsWith('x ·') || pick.includes('remis')) return homeScore === awayScore ? 'won' : 'lost';
    if (pick.startsWith('2 ·')) return awayScore > homeScore ? 'won' : 'lost';
  }

  if (mt === 'totals') {
    const m = pick.match(/(\d+\.?\d*)/);
    const line = m ? parseFloat(m[1]) : 2.5;
    const total = homeScore + awayScore;
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
    if (homeScore === awayScore) return 'lost';
    const homeTeam = (sel.matchLabel || '').split(' vs ')[0].toLowerCase();
    const pickedHome = pick.includes(homeTeam) || pick.includes('dnb ·') && pick.split('dnb · ')[1]?.trim() === homeTeam;
    if (pickedHome) return homeScore > awayScore ? 'won' : 'lost';
    return awayScore > homeScore ? 'won' : 'lost';
  }

  if (mt === 'spreads') {
    const m = pick.match(/([+-]?\d+\.?\d*)$/);
    const handicap = m ? parseFloat(m[1]) : 0;
    const homeTeam = (sel.matchLabel || '').split(' vs ')[0].toLowerCase();
    const pickedHome = pick.startsWith(homeTeam);
    if (pickedHome) return (homeScore + handicap) > awayScore ? 'won' : 'lost';
    return (awayScore + Math.abs(handicap)) > homeScore ? 'won' : 'lost';
  }

  // Legacy: h2h without marketType
  if (pick.startsWith('1 ·')) return homeScore > awayScore ? 'won' : 'lost';
  if (pick.startsWith('x ·') || pick.includes('remis')) return homeScore === awayScore ? 'won' : 'lost';
  if (pick.startsWith('2 ·')) return awayScore > homeScore ? 'won' : 'lost';
  return 'lost';
}

export async function GET(req: NextRequest) {
  const authError = verifyCronToken(req);
  if (authError) return authError;

  // 1. Aktualizuj live mecze
  let liveUpdated = 0;
  if (API_FOOTBALL_KEY) {
    try {
      const res = await fetch('https://v3.football.api-sports.io/fixtures?live=all', {
        headers: { 'x-apisports-key': API_FOOTBALL_KEY },
        next: { revalidate: 0 },
      });
      if (res.ok) {
        const json = await res.json();
        const fixtures = json.response || [];
        const batch = adminDb.batch();
        for (const f of fixtures) {
          const short = f.fixture.status.short;
          const isFinished = ['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(short);
          const isLive = !isFinished && !['NS', 'TBD'].includes(short);
          const ref = adminDb.doc(`matches/afoot-${f.fixture.id}`);
          batch.update(ref, {
            status: isFinished ? 'finished' : isLive ? 'live' : 'upcoming',
            score: [f.goals.home ?? 0, f.goals.away ?? 0],
            minute: f.fixture.status.elapsed ? `${f.fixture.status.elapsed}'` : null,
            liveUpdatedAt: FieldValue.serverTimestamp(),
          });
          liveUpdated++;
        }
        await batch.commit();
      }
    } catch (_) {}
  }

  // 2. Pobierz zakończone mecze
  const finishedSnap = await adminDb.collection('matches')
    .where('status', '==', 'finished')
    .get();

  const finishedMap = new Map<string, [number, number]>();
  for (const doc of finishedSnap.docs) {
    const d = doc.data();
    if (d.score) finishedMap.set(doc.id, [d.score[0], d.score[1]]);
  }

  // 3. Rozlicz pending zakłady
  const pendingSnap = await adminDb.collection('bets')
    .where('status', '==', 'pending')
    .get();

  const batch = adminDb.batch();
  let settled = 0;

  for (const betDoc of pendingSnap.docs) {
    const bet = { id: betDoc.id, ...betDoc.data() } as Bet;

    const resolved = bet.selections.map(sel => {
      const result = finishedMap.get(sel.matchId);
      if (!result) return { ...sel, result: 'pending' as const };
      return { ...sel, result: resolveSelection(sel, result[0], result[1]) };
    });

    if (resolved.some(s => s.result === 'pending')) continue;

    const won = resolved.every(s => s.result === 'won');
    const actualWin = won ? bet.potentialWin : 0;

    batch.update(betDoc.ref, {
      status: won ? 'won' : 'lost',
      actualWin,
      selections: resolved,
      settledAt: FieldValue.serverTimestamp(),
    });

    if (won) {
      batch.update(adminDb.doc(`users/${bet.userId}`), {
        balance: FieldValue.increment(actualWin),
      });
    }
    settled++;
  }

  await batch.commit();

  return NextResponse.json({ ok: true, liveUpdated, settled });
}
