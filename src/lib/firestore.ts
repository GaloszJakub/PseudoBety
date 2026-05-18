import {
  collection, query, where, orderBy, onSnapshot,
  doc, getDoc, getDocs, addDoc, updateDoc,
  serverTimestamp, Timestamp, limit
} from 'firebase/firestore';
import { db } from './firebase';
import type { Match, Market } from './data';

// ─── Matches ───────────────────────────────────────────────────────────

function toKickoff(ts: any): string {
  if (!ts) return '';
  const date: Date = ts?.toDate?.() ?? new Date(ts);
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

function docToMatch(d: any): Match {
  const data = d.data();
  return {
    id: d.id,
    ...data,
    kickoff: toKickoff(data.commenceTime),
  } as Match;
}


export async function getMatchMarkets(matchId: string): Promise<Market[]> {
  const snap = await getDocs(
    collection(db, 'matches', matchId, 'markets')
  );
  return snap.docs.map(d => d.data() as Market);
}

// ─── User ──────────────────────────────────────────────────────────────

export async function getUserBalance(uid: string): Promise<number> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data().balance ?? 0) : 0;
}

export function subscribeToUserBalance(uid: string, cb: (balance: number) => void) {
  return onSnapshot(doc(db, 'users', uid), snap => {
    cb(snap.exists() ? (snap.data().balance ?? 0) : 0);
  });
}

// ─── Bets ──────────────────────────────────────────────────────────────

export interface BetPayload {
  userId: string;
  stake: number;
  totalOdds: number;
  potentialWin: number;
  selections: {
    matchId: string;
    matchLabel: string;
    competition: string;
    market: string;
    pick: string;
    odds: number;
  }[];
}

export async function placeBet(payload: BetPayload) {
  return addDoc(collection(db, 'bets'), {
    ...payload,
    status: 'pending',
    createdAt: serverTimestamp(),
    settledAt: null,
    actualWin: null,
  });
}

export function subscribeToUserBets(
  uid: string,
  cb: (bets: any[]) => void
) {
  const q = query(
    collection(db, 'bets'),
    where('userId', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(20)
  );
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}
