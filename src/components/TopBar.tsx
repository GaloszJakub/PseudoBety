'use client';
import { useState, useEffect, useRef } from 'react';
import type { User } from 'firebase/auth';
import { useAuth } from '@/lib/AuthContext';
import { subscribeToUserBets } from '@/lib/firestore';
import AuthModal from './AuthModal';

interface Bet { id: string; odds: number; }

interface Props {
  bets: Bet[];
  onHome: () => void;
  onProfile: () => void;
  onDeposit: () => void;
  onAdmin?: () => void;
  currentPage: string;
  balance?: number;
  user?: User | null;
}

export default function TopBar({ bets, onHome, onProfile, onDeposit, onAdmin, currentPage, balance = 0, user }: Props) {
  const { logout } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [avatarMenu, setAvatarMenu] = useState(false);
  const [betsOpen, setBetsOpen] = useState(false);
  const [activeBets, setActiveBets] = useState<any[]>([]);
  const betsRef = useRef<HTMLDivElement>(null);
  const initials = user?.displayName?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || '?';

  useEffect(() => {
    if (!user) { setActiveBets([]); return; }
    return subscribeToUserBets(user.uid, bets => setActiveBets(bets));
  }, [user?.uid]);

  useEffect(() => {
    if (!betsOpen) return;
    const handler = (e: MouseEvent) => {
      if (betsRef.current && !betsRef.current.contains(e.target as Node)) setBetsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [betsOpen]);

  const pendingBets = activeBets.filter(b => b.status === 'pending');

  return (
    <>
      <header className="topbar">
        <div className="brand" onClick={onHome} style={{ cursor: 'pointer' }}>
          <div className="brand-mark">b</div>
          <div className="brand-name">be<b>ty</b></div>
        </div>

        <nav className="nav-tabs">
          <button className={'nav-tab' + (currentPage === 'home' ? ' active' : '')} onClick={onHome}>Lobby</button>
          <button className="nav-tab"><span className="live-dot" style={{ marginRight: 6 }} />Live</button>
          <button className="nav-tab">Sporty</button>
        </nav>

        <div className="topbar-search">
          <span style={{ fontSize: 13 }}>⌕</span>
          <span>Szukaj drużyny, ligi, zawodnika...</span>
        </div>

        <div className="user-chips">
          {user ? (
            <>
              <div className="balance-chip">
                <span className="label">Saldo</span>
                <span className="amt">{balance.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} PLN</span>
              </div>
              <button className="deposit-btn" onClick={onDeposit}>+ Wpłać</button>
              <div ref={betsRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setBetsOpen(v => !v)}
                  style={{
                    appearance: 'none', border: '1px solid var(--line)',
                    background: betsOpen ? 'var(--bg-2)' : 'transparent',
                    color: 'var(--cream)', fontFamily: 'inherit',
                    fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
                    padding: '0 12px', height: 36, borderRadius: 0,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                  }}
                >
                  <span style={{ fontSize: 14 }}>🎫</span>
                  <span>Kupony</span>
                  {pendingBets.length > 0 && (
                    <span style={{
                      background: 'var(--gold)', color: '#0d0f12',
                      fontFamily: 'var(--f-mono)', fontSize: 10, fontWeight: 800,
                      padding: '1px 5px', borderRadius: 0, minWidth: 18, textAlign: 'center',
                    }}>{pendingBets.length}</span>
                  )}
                </button>
                {betsOpen && (
                  <div style={{
                    position: 'absolute', top: 44, right: 0,
                    background: 'var(--bg-2)', border: '1px solid var(--line)',
                    width: 320, zIndex: 60, maxHeight: 480, overflowY: 'auto',
                  }}>
                    <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line-cool)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 700 }}>
                      Aktywne kupony ({pendingBets.length})
                    </div>
                    {pendingBets.length === 0 ? (
                      <div style={{ padding: '24px 14px', fontSize: 13, color: 'var(--text-3)', textAlign: 'center' }}>
                        Brak aktywnych kuponów
                      </div>
                    ) : (
                      pendingBets.map(bet => {
                        const totalOdds = (bet.totalOdds as number) ?? 1;
                        const stake = bet.stake as number;
                        const potentialWin = bet.potentialWin as number;
                        const createdAt = bet.createdAt?.toDate?.();
                        const timeStr = createdAt
                          ? createdAt.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
                          : '';
                        const dateStr = createdAt
                          ? createdAt.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })
                          : '';
                        const selections = (bet.selections ?? []) as any[];
                        return (
                          <div key={bet.id} style={{ padding: '12px 14px', borderBottom: '1px solid var(--line-cool)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <span style={{ background: 'rgba(212,175,55,0.15)', color: 'var(--gold-bright)', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', padding: '2px 6px', textTransform: 'uppercase' }}>
                                  {selections.length > 1 ? `AKO ×${selections.length}` : 'Pojedynczy'}
                                </span>
                                <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{dateStr} {timeStr}</span>
                              </div>
                              <span className="mono" style={{ fontSize: 14, fontWeight: 800, color: 'var(--gold-bright)' }}>{totalOdds.toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                              {selections.map((sel: any, i: number) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                  <div style={{ fontSize: 11, color: 'var(--text-2)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                    <span style={{ color: 'var(--cream)', fontWeight: 600 }}>{sel.pick}</span>
                                    <span style={{ color: 'var(--text-3)', margin: '0 4px' }}>·</span>
                                    <span>{sel.matchLabel}</span>
                                  </div>
                                  <span className="mono" style={{ fontSize: 11, color: 'var(--gold)', flexShrink: 0 }}>{(sel.odds as number).toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, paddingTop: 8, borderTop: '1px dashed var(--line-cool)' }}>
                              <span style={{ color: 'var(--text-3)' }}>Stawka: <span className="mono" style={{ color: 'var(--text-2)' }}>{stake} PLN</span></span>
                              <span style={{ color: 'var(--text-3)' }}>Możliwa wygrana: <span className="mono" style={{ color: 'var(--gold-bright)', fontWeight: 700 }}>{potentialWin.toFixed(2)} PLN</span></span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <div className="user-avatar" onClick={() => setAvatarMenu(v => !v)}
                     style={{ cursor: 'pointer' }}>
                  {initials}
                </div>
                {avatarMenu && (
                  <div style={{
                    position: 'absolute', top: 44, right: 0,
                    background: 'var(--bg-2)', border: '1px solid var(--line)',
                    minWidth: 160, zIndex: 60
                  }}>
                    <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line-cool)', fontSize: 12, color: 'var(--text-2)' }}>
                      {user.email}
                    </div>
                    <button onClick={() => { onProfile(); setAvatarMenu(false); }} style={{
                      appearance: 'none', border: 0, background: 'transparent',
                      width: '100%', textAlign: 'left', padding: '10px 14px',
                      fontSize: 13, color: 'var(--cream)', cursor: 'pointer',
                      fontFamily: 'inherit', fontWeight: 600
                    }}>Mój profil</button>
                    {onAdmin && (
                      <button onClick={() => { onAdmin(); setAvatarMenu(false); }} style={{
                        appearance: 'none', border: 0, background: 'transparent',
                        width: '100%', textAlign: 'left', padding: '10px 14px',
                        fontSize: 13, color: 'var(--gold)', cursor: 'pointer',
                        fontFamily: 'inherit', fontWeight: 600
                      }}>⚙ Panel admina</button>
                    )}
                    <button onClick={() => { logout(); setAvatarMenu(false); }} style={{
                      appearance: 'none', border: 0, background: 'transparent',
                      width: '100%', textAlign: 'left', padding: '10px 14px',
                      fontSize: 13, color: 'var(--down)', cursor: 'pointer',
                      fontFamily: 'inherit', fontWeight: 600
                    }}>Wyloguj się</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <button onClick={() => setAuthOpen(true)} style={{
                appearance: 'none', border: '1px solid var(--line)',
                background: 'var(--bg-2)', color: 'var(--cream)',
                fontFamily: 'var(--f-ui)', fontWeight: 700, fontSize: 13,
                padding: '0 16px', height: 36, borderRadius: 0, cursor: 'pointer'
              }}>
                Zaloguj się
              </button>
              <button onClick={() => setAuthOpen(true)} className="deposit-btn">
                Zarejestruj
              </button>
            </>
          )}
        </div>
      </header>

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </>
  );
}
