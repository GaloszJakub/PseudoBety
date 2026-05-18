'use client';
import { useState, useMemo } from 'react';
import TeamCrest from '../shared/TeamCrest';
import FormPills from '../shared/FormPills';
import OddButton from '../shared/OddButton';
import PressureWave from '../shared/PressureWave';
import { Match, Market, getOddsValue } from '@/lib/data';
import { Bet } from '../BetSlip';

const STAT_LABELS: Record<string, string> = {
  possession: 'Posiadanie', shots: 'Strzały', onTarget: 'Celne', corners: 'Rzuty rożne',
  aces: 'Asy serwisowe', firstServe: '1. serwis %', breaks: 'Breaki', winners: 'Winners',
  fg: 'Skuteczność %', threes: 'Za 3 pkt', rebounds: 'Zbiórki', ast: 'Asysty'
};

const marketCategories = ['Wszystkie', 'Popularne', '1X2', 'Gole', 'Strzelcy', 'Specjalne'];

interface Props {
  matchId: string;
  onBack: () => void;
  onAddBet: (bet: Bet) => void;
  selectedBets: Bet[];
  allMatches?: Match[];
}

export default function MatchDetailPage({ matchId, onBack, onAddBet, selectedBets, allMatches: firestoreMatches = [] }: Props) {
  const matchMap = useMemo(() => new Map(firestoreMatches.map(m => [m.id, m])), [firestoreMatches]);
  const match = matchMap.get(matchId);
  const [activeMarket, setActiveMarket] = useState('Wszystkie');

  if (!match) {
    return (
      <div className="page" style={{ paddingTop: 16 }}>
        <button style={{ appearance: 'none', border: 0, background: 'transparent', color: 'var(--text-2)', fontFamily: 'inherit', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', marginBottom: 16, cursor: 'pointer' }}
                onClick={onBack}>
          <span style={{ fontSize: 18 }}>←</span> Wróć
        </button>
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-3)' }}>Mecz nie znaleziony</div>
      </div>
    );
  }

  // Use Firestore markets if available, otherwise build from odds
  const markets: Market[] = match.markets && match.markets.length > 0
    ? match.markets
    : match.odds
    ? [{
        name: 'Wynik meczu (1X2)',
        subtitle: 'Pełny czas gry',
        type: 'h2h',
        outcomes: [
          { label: `1 · ${match.home.name}`, value: getOddsValue(match.odds.home) },
          ...(match.odds.draw != null ? [{ label: 'X · Remis', value: getOddsValue(match.odds.draw) }] : []),
          { label: `2 · ${match.away.name}`, value: getOddsValue(match.odds.away) },
        ],
      }]
    : [];
  const isSelected = (id: string) => selectedBets.some(b => b.id === id);

  return (
    <div className="page" style={{ paddingTop: 16 }}>
      <button style={{ appearance: 'none', border: 0, background: 'transparent', color: 'var(--text-2)', fontFamily: 'inherit', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', marginBottom: 16, cursor: 'pointer' }}
              onClick={onBack}>
        <span style={{ fontSize: 18 }}>←</span> Wróć
      </button>

      <div style={{ border: '1px solid var(--line)', borderRadius: 0, background: 'var(--bg-2)', padding: '20px 24px', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--gold)', background: 'var(--gold-soft)', padding: '3px 8px' }}>{match.competition}</span>
          {match.venue && <span style={{ color: 'var(--text-3)', fontSize: 12 }}>{match.venue}</span>}
          <span style={{ flex: 1 }} />
          <span style={{ color: 'var(--text-2)', fontSize: 12 }}>{match.kickoff || (match.minute ? `Live · ${match.minute}` : '')}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 24, padding: '16px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
            <TeamCrest code={match.home.code} logo={match.home.logo} size={56} />
            <div style={{ fontFamily: 'var(--f-ui)', fontSize: 18, fontWeight: 700, color: 'var(--cream)', lineHeight: 1.1 }}>{match.home.name}</div>
            {match.home.form && <FormPills form={match.home.form} size={12} />}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 160 }}>
            {match.score ? (
              <>
                <div className="mono" style={{ fontSize: 38, color: 'var(--gold-bright)', letterSpacing: '-0.02em', lineHeight: 1, fontWeight: 700 }}>{match.score[0]} : {match.score[1]}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: '0.10em', textTransform: 'uppercase' }}>{match.minute || match.gameScore}</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 36, color: 'var(--gold-bright)', letterSpacing: '-0.02em', lineHeight: 1, fontWeight: 700 }}>{match.kickoff?.split(' · ')[1] || match.kickoff}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: '0.10em', textTransform: 'uppercase' }}>{match.kickoff?.split(' · ')[0] || 'Wkrótce'}</div>
              </>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
            <TeamCrest code={match.away.code} logo={match.away.logo} size={56} />
            <div style={{ fontFamily: 'var(--f-ui)', fontSize: 18, fontWeight: 700, color: 'var(--cream)', lineHeight: 1.1 }}>{match.away.name}</div>
            {match.away.form && <FormPills form={match.away.form} size={12} />}
          </div>
        </div>

        {match.pressure && (
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--line-cool)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 600 }}>Presja w meczu</span>
              <span className="mono" style={{ color: 'var(--gold-bright)' }}>
                {Math.round((1 - (match.momentum || 0.5)) * 100)}% — {Math.round((match.momentum || 0.5) * 100)}%
              </span>
            </div>
            <PressureWave data={match.pressure} height={40} />
            <div className="momentum-track" style={{ marginTop: 6 }}>
              <div className="home-side" style={{ width: `${(1 - (match.momentum || 0.5)) * 100}%` }} />
              <div className="away-side" style={{ width: `${(match.momentum || 0.5) * 100}%` }} />
              <div className="center" />
            </div>
          </div>
        )}

        {match.stats && (
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--line-cool)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 28px' }}>
            {Object.entries(match.stats).map(([key, vals]) => (
              <StatBar key={key} label={STAT_LABELS[key] || key} home={vals[0]} away={vals[1]} />
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 0, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 0, marginBottom: 14, width: 'fit-content' }}>
        {marketCategories.map(c => (
          <button key={c} onClick={() => setActiveMarket(c)} style={{
            appearance: 'none', border: 0,
            background: activeMarket === c ? 'var(--gold)' : 'transparent',
            color: activeMarket === c ? '#0d0f12' : 'var(--text-2)',
            fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
            padding: '8px 16px', borderRadius: 0, cursor: 'pointer', transition: 'all 0.10s'
          }}>{c}</button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {markets.map((market, idx) => (
          <MarketBlock key={idx} market={market} match={match}
                       isSelected={isSelected} onAddBet={onAddBet} />
        ))}
      </div>
    </div>
  );
}

function StatBar({ label, home, away }: { label: string; home: number; away: number }) {
  const total = home + away || 1;
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'baseline', gap: 12, marginBottom: 5 }}>
        <span className="mono" style={{ fontSize: 13, color: 'var(--cream)', fontWeight: 600 }}>{home}</span>
        <span style={{ fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 600 }}>{label}</span>
        <span className="mono" style={{ fontSize: 13, color: 'var(--cream)', fontWeight: 600, textAlign: 'right' }}>{away}</span>
      </div>
      <div style={{ display: 'flex', gap: 4, height: 3 }}>
        <div style={{ width: `${(home / total) * 100}%`, background: 'var(--gold)' }} />
        <div style={{ width: `${(away / total) * 100}%`, background: 'var(--text-2)' }} />
      </div>
    </div>
  );
}

function MarketBlock({ market, match, isSelected, onAddBet }: {
  market: Market; match: Match;
  isSelected: (id: string) => boolean;
  onAddBet: (b: Bet) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const cols = market.type === 'totals' ? 2 :
               market.outcomes.length <= 3 ? market.outcomes.length :
               market.outcomes.length === 4 ? 2 :
               market.outcomes.length === 6 ? 3 : 3;

  const handleClick = (oc: typeof market.outcomes[0]) => {
    const id = `${match.id}-${market.type}-${oc.label}`;
    onAddBet({
      id, matchId: match.id,
      matchLabel: `${match.home.name} vs ${match.away.name}`,
      competition: match.competition,
      market: market.name,
      marketType: market.type,
      pick: oc.label + (oc.sub ? ` (${oc.sub})` : ''),
      odds: oc.value
    });
  };

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 0, background: 'var(--bg-1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', cursor: 'pointer', background: 'var(--bg-2)', borderBottom: collapsed ? 0 : '1px solid var(--line)', transition: 'background 0.10s' }}
           onClick={() => setCollapsed(!collapsed)}>
        <div>
          <div style={{ fontFamily: 'var(--f-ui)', fontSize: 15, fontWeight: 700, color: 'var(--cream)', lineHeight: 1.2 }}>{market.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: '0.04em', marginTop: 2 }}>{market.subtitle}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 600 }}>{market.outcomes.length} opcji</span>
          <span style={{ color: 'var(--text-2)', fontSize: 14, transition: 'transform 0.2s', display: 'inline-block', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▾</span>
        </div>
      </div>
      {!collapsed && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 6, padding: '12px 14px' }}>
          {market.outcomes.map((oc, i) => {
            const id = `${match.id}-${market.type}-${oc.label}`;
            return <OddButton key={i} label={oc.label} sub={oc.sub} value={oc.value}
                              delta={oc.delta} hot={oc.hot}
                              selected={isSelected(id)} onClick={() => handleClick(oc)} />;
          })}
        </div>
      )}
    </div>
  );
}
