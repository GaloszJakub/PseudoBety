'use client';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import TopBar from './TopBar';
import Sidebar from './Sidebar';
import BetSlip, { Bet } from './BetSlip';
import HomePage from './home/HomePage';
import MatchDetailPage from './match/MatchDetailPage';
import DepositModal from './DepositModal';
import ProfilePage from './profile/ProfilePage';
import AdminPage from './admin/AdminPage';
import { useAuth } from '@/lib/AuthContext';
import type { Match } from '@/lib/data';

const fetcher = (url: string) => fetch(url).then(r => r.json());

function pageFromPath(path: string): string {
  if (path === '/profile') return 'profile';
  if (path === '/admin') return 'admin';
  const pm = path.match(/^\/profile\/(.+)$/);
  if (pm) return `profile:${pm[1]}`;
  const m = path.match(/^\/match\/(.+)$/);
  return m ? m[1] : 'home';
}

export default function App() {
  const { user, balance, role, suspended, suspendedReason } = useAuth();
  const [page, setPage] = useState<string>('home');

  useEffect(() => {
    setPage(pageFromPath(window.location.pathname));
  }, []);
  const [bets, setBets] = useState<Bet[]>([]);
  const [toast, setToast] = useState<{ pick: string; odds: number } | null>(null);
  const [activeSport, setActiveSport] = useState('all');
  const [activeLeague, setActiveLeague] = useState<string | null>(null);
  const [depositOpen, setDepositOpen] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // SWR for all matches — cached 60s, no Firestore reads per client
  const { data: matchesData } = useSWR<{ live: Match[]; upcoming: Match[] }>(
    '/api/matches',
    fetcher,
    { refreshInterval: 3_600_000, dedupingInterval: 1_800_000 }
  );
  const liveMatches: Match[] = matchesData?.live ?? [];
  const upcomingMatches: Match[] = matchesData?.upcoming ?? [];

  useEffect(() => {
    const onPop = () => {
      const p = pageFromPath(window.location.pathname);
      setPage(p);
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((target: string) => {
    if (target === 'home') {
      window.history.pushState(null, '', '/');
    } else if (target === 'profile') {
      window.history.pushState(null, '', '/profile');
    } else if (target === 'admin') {
      window.history.pushState(null, '', '/admin');
    } else if (target.startsWith('profile:')) {
      window.history.pushState(null, '', `/profile/${target.slice(8)}`);
    } else {
      window.history.pushState(null, '', `/match/${target}`);
    }
    setPage(target);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  const goBack = useCallback(() => { window.history.back(); }, []);

  const handleAddBet = useCallback((bet: Bet) => {
    setBets(prev => {
      const existing = prev.find(b => b.id === bet.id);
      if (existing) return prev.filter(b => b.id !== bet.id);
      const filtered = prev.filter(b => !(b.matchId === bet.matchId && b.market === bet.market));
      return [...filtered, bet];
    });
    setToast({ pick: bet.pick, odds: bet.odds });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }, []);

  const handleRemoveBet = useCallback((id: string) => {
    setBets(prev => prev.filter(b => b.id !== id));
  }, []);

  const handleSportChange = useCallback((sport: string) => {
    setActiveSport(sport);
    setActiveLeague(null);
    setPage(prev => {
      if (prev !== 'home') {
        window.history.pushState(null, '', '/');
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
        return 'home';
      }
      return prev;
    });
  }, []);

  const handleLeagueChange = useCallback((league: string | null) => {
    setActiveLeague(league);
    setPage(prev => {
      if (prev !== 'home') {
        window.history.pushState(null, '', '/');
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
        return 'home';
      }
      return prev;
    });
  }, []);

  const allMatches = useMemo(() => [...liveMatches, ...upcomingMatches], [liveMatches, upcomingMatches]);

  const hasOdds = (m: Match) =>
    !!(m.odds || m.markets?.some(mk => mk.type === 'h2h'));

  const matchesWithOdds = useMemo(() =>
    allMatches.filter(hasOdds), [allMatches]);

  // sport → Set<league> — only matches with odds (mirrors homepage filter)
  const sportData = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const m of matchesWithOdds) {
      if (!map[m.sport]) map[m.sport] = new Set();
      map[m.sport].add(m.competition);
    }
    return map;
  }, [matchesWithOdds]);

  // sport → country → flagUrl
  const countryFlags = useMemo(() => {
    const map: Record<string, Record<string, string>> = {};
    for (const m of matchesWithOdds) {
      if (!m.country || !m.countryFlag) continue;
      if (!map[m.sport]) map[m.sport] = {};
      map[m.sport][m.country] = m.countryFlag;
    }
    return map;
  }, [matchesWithOdds]);

  const filterMatch = (m: Match) => {
    if (!hasOdds(m)) return false;
    if (activeSport === 'live') return false;
    if (activeSport !== 'all' && activeSport !== 'favorites' && m.sport !== activeSport) return false;
    if (activeLeague && m.competition !== activeLeague) return false;
    return true;
  };

  const filteredLive = activeSport === 'live'
    ? liveMatches
    : liveMatches.filter(filterMatch);

  const filteredUpcoming = activeSport === 'live'
    ? []
    : upcomingMatches.filter(filterMatch);

  if (suspended && user) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: 'var(--bg-1)', color: 'var(--cream)' }}>
        <div style={{ fontSize: 40 }}>🔒</div>
        <div style={{ fontFamily: 'var(--f-ui)', fontSize: 22, fontWeight: 800 }}>Konto zawieszone</div>
        {suspendedReason && <div style={{ fontSize: 14, color: 'var(--text-2)' }}>Powód: {suspendedReason}</div>}
        <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Skontaktuj się z administratorem</div>
        <button onClick={() => { import('@/lib/firebase').then(({ auth }) => auth.signOut()); }} style={{ appearance: 'none', border: '1px solid var(--line)', background: 'transparent', color: 'var(--text-2)', fontFamily: 'inherit', fontSize: 13, padding: '10px 20px', cursor: 'pointer', marginTop: 8 }}>
          Wyloguj się
        </button>
      </div>
    );
  }

  return (
    <div className="app-shell" data-density="compact">
      <TopBar bets={bets} onHome={() => navigate('home')} currentPage={page}
              onProfile={() => navigate('profile')} onDeposit={() => setDepositOpen(true)}
              onAdmin={role === 'admin' ? () => navigate('admin') : undefined}
              balance={balance} user={user} />

      <div className="app-body">
        <Sidebar
          activeSport={activeSport} onSportChange={handleSportChange}
          activeLeague={activeLeague} onLeagueChange={handleLeagueChange}
          sportData={sportData} countryFlags={countryFlags} liveCount={liveMatches.length}
        />

        <main className="app-main">
          {page === 'home' ? (
            <HomePage onMatchClick={navigate} onAddBet={handleAddBet} selectedBets={bets}
                      liveMatches={filteredLive} upcomingMatches={filteredUpcoming} />
          ) : page === 'profile' ? (
            <ProfilePage />
          ) : page === 'admin' ? (
            <AdminPage onViewProfile={uid => navigate(`profile:${uid}`)} />
          ) : page.startsWith('profile:') ? (
            <ProfilePage userId={page.slice(8)} onBack={goBack} />
          ) : (
            <MatchDetailPage matchId={page} onBack={goBack}
                             onAddBet={handleAddBet} selectedBets={bets}
                             allMatches={allMatches} />
          )}
        </main>

        <BetSlip bets={bets} onRemove={handleRemoveBet} onClear={() => setBets([])} />
      </div>

      {depositOpen && <DepositModal onClose={() => setDepositOpen(false)} />}

      <div className={'bet-toast' + (toast ? ' show' : '')}>
        <span style={{ color: 'var(--gold-bright)' }}>⚜</span>
        <span>Dodano: <strong style={{ color: 'var(--gold-bright)' }}>{toast?.pick}</strong></span>
        <span className="mono" style={{ color: 'var(--gold-bright)', fontWeight: 700 }}>
          {toast?.odds?.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
