'use client';
import { useState, useMemo, memo } from 'react';
import TeamCrest from '../shared/TeamCrest';
import SportIcon from '../shared/SportIcon';
import OddButton from '../shared/OddButton';
import { Match, get1x2 } from '@/lib/data';
import { Bet } from '../BetSlip';

interface Props {
  matches: Match[];
  onMatchClick: (id: string) => void;
  onAddBet: (bet: Bet) => void;
  selectedBets: Bet[];
}

const timeFilters = [
  { id: 'live', label: 'Live', count: 28 },
  { id: 'today', label: 'Dziś', count: 142 },
  { id: 'tomorrow', label: 'Jutro', count: 96 },
  { id: '3days', label: '3 dni', count: 248 },
  { id: 'week', label: 'Tydzień', count: 612 },
];

export default function UpcomingTable({ matches, onMatchClick, onAddBet, selectedBets }: Props) {
  const [activeSport, setActiveSport] = useState('all');
  const [activeFilter, setActiveFilter] = useState('today');

  const sportFilters = useMemo(() => [
    { id: 'all', label: 'Wszystkie', count: matches.length },
    { id: 'football', label: 'Piłka nożna', count: matches.filter(m => m.sport === 'football').length },
    { id: 'tennis', label: 'Tenis', count: matches.filter(m => m.sport === 'tennis').length },
    { id: 'basketball', label: 'Koszykówka', count: matches.filter(m => m.sport === 'basketball').length },
  ], [matches]);

  const grouped = useMemo(() => {
    const list = activeSport === 'all' ? matches : matches.filter(m => m.sport === activeSport);
    return list.reduce((acc, m) => {
      (acc[m.competition] = acc[m.competition] || []).push(m);
      return acc;
    }, {} as Record<string, Match[]>);
  }, [matches, activeSport]);

  return (
    <section>
      <div className="sec-head">
        <h2 className="sec-title">Nadchodzące</h2>
        <div style={{ display: 'flex', gap: 2, padding: 3, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--line-cool)', borderRadius: 0 }}>
          {timeFilters.map(f => (
            <button key={f.id} onClick={() => setActiveFilter(f.id)} style={{
              appearance: 'none', border: 0, borderRadius: 0,
              background: activeFilter === f.id ? 'var(--gold)' : 'transparent',
              color: activeFilter === f.id ? '#0d0f12' : 'var(--text-2)',
              font: '600 12px/1 var(--f-ui)', padding: '8px 12px',
              display: 'flex', alignItems: 'center', gap: 6,
              cursor: 'pointer', whiteSpace: 'nowrap'
            }}>
              {f.id === 'live' && <span className="live-dot" />}
              {f.label}
              <span className="mono" style={{ fontSize: 10, color: activeFilter === f.id ? 'rgba(10,17,36,0.65)' : 'var(--text-3)', fontWeight: 600 }}>{f.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 14, borderBottom: '1px solid var(--line-cool)' }}>
        {sportFilters.map(f => (
          <button key={f.id} onClick={() => setActiveSport(f.id)} style={{
            appearance: 'none', border: 0, background: 'transparent',
            color: activeSport === f.id ? 'var(--gold-bright)' : 'var(--text-2)',
            font: '600 13px/1 var(--f-ui)', padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
            position: 'relative',
            borderBottom: activeSport === f.id ? '2px solid var(--gold)' : '2px solid transparent',
            marginBottom: -1
          }}>
            {f.id !== 'all' && <span style={{ color: activeSport === f.id ? 'var(--gold)' : 'var(--text-3)' }}><SportIcon sport={f.id} size={13} /></span>}
            {f.label}
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>{f.count}</span>
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr 200px 70px', gap: 12, padding: '6px 12px', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 700 }}>
        <div>Godz.</div>
        <div>Drużyny</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, textAlign: 'center' }}>
          <span>1</span><span>X</span><span>2</span>
        </div>
        <div style={{ textAlign: 'right' }}>Więcej</div>
      </div>

      {Object.entries(grouped).map(([comp, ms]) => (
        <div key={comp} style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg-3)', border: '1px solid var(--line)', borderBottom: 0 }}>
            <span style={{ color: 'var(--gold)', display: 'flex' }}><SportIcon sport={ms[0].sport} size={12} /></span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--cream)', whiteSpace: 'nowrap' }}>{comp}</span>
            <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 700, background: 'var(--bg-2)', padding: '2px 6px' }}>{ms.length}</span>
            <span style={{ flex: 1 }} />
            <button style={{ appearance: 'none', border: 0, background: 'transparent', color: 'var(--gold)', font: '600 11px/1 var(--f-ui)', cursor: 'pointer' }}>Wszystkie →</button>
          </div>
          {ms.map(m => (
            <UpcomingRow key={m.id} match={m} onMatchClick={onMatchClick}
                         onAddBet={onAddBet} selectedBets={selectedBets} />
          ))}
        </div>
      ))}
    </section>
  );
}

const UpcomingRow = memo(function UpcomingRow({ match, onMatchClick, onAddBet, selectedBets }: {
  match: Match; onMatchClick: (id: string) => void;
  onAddBet: (b: Bet) => void; selectedBets: Bet[];
}) {
  const isSelected = (id: string) => selectedBets.some(b => b.id === id);
  const o1x2 = get1x2(match);
  const hasDraw = o1x2.draw != null;
  const oddCols = hasDraw ? 3 : 2;
  const oddLabels = hasDraw ? ['1', 'X', '2'] : ['1', '2'];
  const oddKeys = hasDraw ? ['home', 'draw', 'away'] : ['home', 'away'];
  const oddValues = hasDraw ? [o1x2.home, o1x2.draw!, o1x2.away] : [o1x2.home, o1x2.away];

  const handleOdd = (k: string, i: number) => {
    const id = `${match.id}-1x2-${k}`;
    onAddBet({
      id, matchId: match.id,
      matchLabel: `${match.home.name} - ${match.away.name}`,
      competition: match.competition,
      market: 'Wynik meczu',
      marketType: 'h2h',
      pick: `${oddLabels[i]} · ${k === 'home' ? match.home.name : k === 'away' ? match.away.name : 'Remis'}`,
      odds: oddValues[i]
    });
  };

  const tags = match.tags || [];
  const isPolish = tags.some(t => t.includes('Pol'));
  const kickParts = (match.kickoff || '').split(' ');

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr 200px 70px', gap: 12, alignItems: 'center', padding: 'var(--row-pad-y, 8px) var(--row-pad-x, 12px)', background: 'var(--bg-1)', border: '1px solid var(--line)', borderTop: 0, cursor: 'pointer', transition: 'background 0.10s' }}
         onClick={() => onMatchClick(match.id)}>

      <div className="mono">
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--cream)' }}>{kickParts[1] || kickParts[0]}</div>
        <div style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{kickParts[0]}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--row-gap, 4px)', minWidth: 0 }}>
        {[match.home, match.away].map((team, ti) => (
          <div key={ti} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--type-row, 13px)', fontWeight: 600, color: 'var(--cream)', overflow: 'hidden' }}>
            <TeamCrest code={team.code} logo={team.logo} size={20} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{team.name}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 10, color: 'var(--text-3)' }}>
          {isPolish && <span style={{ fontSize: 12 }}>🇵🇱</span>}
          {tags.filter(t => !t.includes('Pol')).slice(0, 1).map(t => (
            <span key={t} style={{ fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-2)', background: 'var(--bg-3)', border: '1px solid var(--line)', padding: '2px 5px', fontWeight: 700 }}>{t}</span>
          ))}
          <span className="mono" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: 'var(--text-3)' }}>◉</span>{match.heat?.toLocaleString('pl-PL')}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${oddCols}, 1fr)`, gap: 4 }}>
        {oddKeys.map((k, i) => (
          <OddButton key={k} label={oddLabels[i]}
                     value={oddValues[i]}
                     selected={isSelected(`${match.id}-1x2-${k}`)}
                     onClick={() => handleOdd(k, i)} />
        ))}
        {!hasDraw && <div />}
      </div>

      <button style={{ appearance: 'none', border: '1px solid var(--line-cool)', background: 'transparent', color: 'var(--text-2)', font: '600 11px/1 var(--f-ui)', padding: 0, height: 40, borderRadius: 0, cursor: 'pointer' }}
              onClick={e => { e.stopPropagation(); onMatchClick(match.id); }}>
        +28 →
      </button>
    </div>
  );
});
