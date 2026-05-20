'use client';
import { useState, useEffect } from 'react';
import {
  collection, query, where, orderBy, limit, onSnapshot,
  doc, getDoc, updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';

type BetStatus = 'pending' | 'won' | 'lost';
type Filter = 'all' | BetStatus;

interface Selection {
  matchId: string;
  matchLabel: string;
  market: string;
  pick: string;
  odds: number;
  result?: string;
  score?: [number, number];
}

interface UserBet {
  id: string;
  stake: number;
  totalOdds: number;
  potentialWin: number;
  actualWin: number | null;
  status: BetStatus;
  createdAt: any;
  selections: Selection[];
}

interface PublicProfile {
  uid: string;
  displayName: string;
  email?: string;
  role: string;
  isPrivate: boolean;
  balance?: number;
  createdAt?: any;
}

const STATUS_COLORS: Record<BetStatus, string> = {
  pending: 'var(--text-3)',
  won: '#4caf82',
  lost: 'var(--down, #e05555)',
};

const STATUS_LABELS: Record<BetStatus, string> = {
  pending: 'Oczekuje',
  won: 'Wygrana',
  lost: 'Przegrana',
};

interface Props {
  userId?: string;
  onBack?: () => void;
}

export default function ProfilePage({ userId, onBack }: Props) {
  const { user, balance, role: myRole, isPrivate: myIsPrivate } = useAuth();

  const isOwnProfile = !userId || userId === user?.uid;
  const viewerIsAdmin = myRole === 'admin';

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [bets, setBets] = useState<UserBet[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [profileLoading, setProfileLoading] = useState(!isOwnProfile);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  // Load foreign profile
  useEffect(() => {
    if (isOwnProfile || !userId) return;
    setProfileLoading(true);
    getDoc(doc(db, 'users', userId)).then(snap => {
      if (snap.exists()) {
        const d = snap.data();
        setProfile({
          uid: snap.id,
          displayName: d.displayName || d.email?.split('@')[0] || '?',
          email: d.email,
          role: d.role || 'user',
          isPrivate: d.isPrivate ?? false,
          balance: d.balance,
          createdAt: d.createdAt,
        });
      }
      setProfileLoading(false);
    });
  }, [userId, isOwnProfile]);

  // Load bets — own or foreign (if allowed)
  useEffect(() => {
    const targetUid = isOwnProfile ? user?.uid : userId;
    if (!targetUid) return;

    // Foreign private profile: only admin sees bets
    if (!isOwnProfile && !viewerIsAdmin && profile?.isPrivate) return;

    const q = query(
      collection(db, 'bets'),
      where('userId', '==', targetUid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    return onSnapshot(q, snap => {
      setBets(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserBet)));
    });
  }, [userId, isOwnProfile, user?.uid, viewerIsAdmin, profile?.isPrivate]);

  const togglePrivacy = async () => {
    if (!user || !isOwnProfile) return;
    setSavingPrivacy(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { isPrivate: !myIsPrivate });
    } finally {
      setSavingPrivacy(false);
    }
  };

  // ── Derived stats ───────────────────────────────────────────────────────────

  const displayName = isOwnProfile
    ? (user?.displayName || user?.email?.split('@')[0] || '?')
    : (profile?.displayName || '?');

  const displayRole = isOwnProfile ? myRole : (profile?.role || 'user');
  const displayPrivate = isOwnProfile ? myIsPrivate : (profile?.isPrivate ?? false);
  const displayBalance = isOwnProfile ? balance : (viewerIsAdmin ? profile?.balance : undefined);

  const totalStaked = bets.reduce((s, b) => s + (b.status !== 'pending' ? b.stake : 0), 0);
  const totalWon = bets.reduce((s, b) => s + (b.actualWin ?? 0), 0);
  const wonCount = bets.filter(b => b.status === 'won').length;
  const settledCount = bets.filter(b => b.status !== 'pending').length;
  const winRate = settledCount > 0 ? (wonCount / settledCount * 100) : 0;
  const roi = totalStaked > 0 ? ((totalWon - totalStaked) / totalStaked * 100) : 0;

  const filtered = filter === 'all' ? bets : bets.filter(b => b.status === filter);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Not logged in ───────────────────────────────────────────────────────────

  if (!isOwnProfile && profileLoading) {
    return <div className="page" style={{ paddingTop: 40, textAlign: 'center', color: 'var(--text-3)' }}>Ładowanie...</div>;
  }

  if (!isOwnProfile && !profile) {
    return <div className="page" style={{ paddingTop: 40, textAlign: 'center', color: 'var(--text-3)' }}>Użytkownik nie znaleziony</div>;
  }

  if (!isOwnProfile && displayPrivate && !viewerIsAdmin) {
    return (
      <div className="page" style={{ paddingTop: 20 }}>
        {onBack && (
          <button onClick={onBack} style={{ appearance: 'none', border: 0, background: 'transparent', color: 'var(--text-2)', fontFamily: 'inherit', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', marginBottom: 16, cursor: 'pointer' }}>
            <span style={{ fontSize: 18 }}>←</span> Wróć
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
          <div style={{ width: 52, height: 52, background: 'var(--gold-soft)', border: '2px solid var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--f-ui)', fontSize: 22, fontWeight: 800, color: 'var(--gold-bright)' }}>
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontFamily: 'var(--f-ui)', fontSize: 20, fontWeight: 800, color: 'var(--cream)' }}>{displayName}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Profil prywatny</div>
          </div>
        </div>
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-3)', border: '1px solid var(--line)', background: 'var(--bg-2)' }}>
          🔒 Ten profil jest prywatny
        </div>
      </div>
    );
  }

  if (isOwnProfile && !user) {
    return <div className="page" style={{ paddingTop: 40, textAlign: 'center', color: 'var(--text-3)' }}>Zaloguj się, aby zobaczyć profil</div>;
  }

  return (
    <div className="page" style={{ paddingTop: 20 }}>
      {!isOwnProfile && onBack && (
        <button onClick={onBack} style={{ appearance: 'none', border: 0, background: 'transparent', color: 'var(--text-2)', fontFamily: 'inherit', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', marginBottom: 16, cursor: 'pointer' }}>
          <span style={{ fontSize: 18 }}>←</span> Wróć
        </button>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <div style={{ width: 52, height: 52, background: 'var(--gold-soft)', border: '2px solid var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--f-ui)', fontSize: 22, fontWeight: 800, color: 'var(--gold-bright)', flexShrink: 0 }}>
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--f-ui)', fontSize: 20, fontWeight: 800, color: 'var(--cream)' }}>{displayName}</span>
            {displayRole === 'admin' && (
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#0d0f12', background: 'var(--gold)', padding: '3px 8px' }}>Admin</span>
            )}
            {displayPrivate && (
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', border: '1px solid var(--line-cool)', padding: '3px 8px' }}>Prywatny</span>
            )}
          </div>
          {(!isOwnProfile && !viewerIsAdmin) ? null : (
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{isOwnProfile ? user?.email : profile?.email}</div>
          )}
        </div>

        {/* Privacy toggle — own profile only */}
        {isOwnProfile && (
          <button onClick={togglePrivacy} disabled={savingPrivacy} style={{
            appearance: 'none', border: '1px solid var(--line-cool)', background: myIsPrivate ? 'rgba(212,175,55,0.1)' : 'var(--bg-2)',
            color: myIsPrivate ? 'var(--gold-bright)' : 'var(--text-2)',
            fontFamily: 'inherit', fontSize: 12, fontWeight: 600, padding: '8px 14px',
            cursor: 'pointer', letterSpacing: '0.04em', whiteSpace: 'nowrap',
          }}>
            {myIsPrivate ? '🔒 Prywatny' : '🌐 Publiczny'}
          </button>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${displayBalance !== undefined ? 4 : 3}, 1fr)`, gap: 10, marginBottom: 24 }}>
        {[
          ...(displayBalance !== undefined ? [{ label: 'Saldo', val: `${displayBalance.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} PLN`, highlight: true }] : []),
          { label: 'Łącznie postawiono', val: `${totalStaked.toFixed(2)} PLN` },
          { label: 'Skuteczność', val: `${winRate.toFixed(1)}%` },
          { label: 'ROI', val: `${roi > 0 ? '+' : ''}${roi.toFixed(1)}%`, color: roi >= 0 ? '#4caf82' : '#e05555' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', padding: '14px 16px' }}>
            <div style={{ fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 600, marginBottom: 6 }}>{s.label}</div>
            <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: (s as any).color || ((s as any).highlight ? 'var(--gold-bright)' : 'var(--cream)') }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Bets */}
      <div style={{ display: 'flex', gap: 0, background: 'var(--bg-2)', border: '1px solid var(--line)', marginBottom: 14, width: 'fit-content' }}>
        {(['all', 'pending', 'won', 'lost'] as Filter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            appearance: 'none', border: 0,
            background: filter === f ? 'var(--gold)' : 'transparent',
            color: filter === f ? '#0d0f12' : 'var(--text-2)',
            fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
            padding: '8px 16px', cursor: 'pointer',
          }}>
            {f === 'all' ? 'Wszystkie' : STATUS_LABELS[f]}
            <span className="mono" style={{ marginLeft: 6, opacity: 0.7, fontSize: 11 }}>
              {f === 'all' ? bets.length : bets.filter(b => b.status === f).length}
            </span>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.length === 0 && (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>Brak kuponów</div>
        )}
        {filtered.map(bet => (
          <div key={bet.id} style={{ border: '1px solid var(--line)', background: 'var(--bg-1)' }}>
            <div onClick={() => toggleExpand(bet.id)} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: 16, alignItems: 'center', padding: '12px 16px', cursor: 'pointer', background: 'var(--bg-2)', borderBottom: expanded.has(bet.id) ? '1px solid var(--line)' : 0 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                color: STATUS_COLORS[bet.status], border: `1px solid ${STATUS_COLORS[bet.status]}`,
                padding: '3px 8px',
              }}>{STATUS_LABELS[bet.status]}</div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{bet.selections.length}× selekcja</div>
                <div className="mono" style={{ fontSize: 13, color: 'var(--cream)', fontWeight: 700 }}>kurs {bet.totalOdds.toFixed(2)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Stawka</div>
                <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cream)' }}>{bet.stake} PLN</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{bet.status === 'won' ? 'Wygrana' : 'Możliwa'}</div>
                <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: bet.status === 'won' ? '#4caf82' : 'var(--gold-bright)' }}>
                  {(bet.actualWin ?? bet.potentialWin).toFixed(2)} PLN
                </div>
              </div>
            </div>
            {expanded.has(bet.id) && (
              <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {bet.selections.map((sel, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, padding: '8px 10px', background: 'var(--bg-2)', border: '1px solid var(--line)' }}>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>{sel.market}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--cream)' }}>{sel.pick}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span>{sel.matchLabel}</span>
                        {sel.score && (
                          <span style={{ color: 'var(--gold-bright)', fontWeight: 700 }}>
                            ({sel.score[0]}:{sel.score[1]})
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <div className="mono" style={{ fontSize: 14, fontWeight: 800, color: 'var(--gold-bright)' }}>{sel.odds.toFixed(2)}</div>
                      {sel.result && sel.result !== 'pending' && (
                        <div style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          color: sel.result === 'won' ? '#4caf82' : sel.result === 'push' ? 'var(--text-3)' : 'var(--down, #e05555)'
                        }}>
                          {sel.result === 'won' ? 'Trafiony' : sel.result === 'push' ? 'Zwrot' : 'Chybiony'}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {bet.createdAt && (
                  <div style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'right' }}>
                    {bet.createdAt.toDate?.()?.toLocaleString('pl-PL') ?? ''}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
