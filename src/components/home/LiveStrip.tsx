'use client';
import TeamCrest from '../shared/TeamCrest';
import SportIcon from '../shared/SportIcon';
import OddButton from '../shared/OddButton';
import PressureWave from '../shared/PressureWave';
import { Match, getOddsValue, getOddsDelta, get1x2 } from '@/lib/data';
import { Bet } from '../BetSlip';

interface Props {
  matches: Match[];
  onMatchClick: (id: string) => void;
  onAddBet: (bet: Bet) => void;
  selectedBets: Bet[];
}

export default function LiveStrip({ matches, onMatchClick, onAddBet, selectedBets }: Props) {
  return (
    <section>
      <div className="sec-head">
        <h2 className="sec-title">
          <span style={{ color: '#ff5e72' }}><span className="live-dot" style={{ marginRight: 6 }} /></span>
          Live <span className="sec-num">{matches.length}</span>
        </h2>
        <button className="sec-link">Wszystkie live →</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {matches.map(m => (
          <LiveRow key={m.id} match={m} onMatchClick={onMatchClick}
                   onAddBet={onAddBet} selectedBets={selectedBets} />
        ))}
      </div>
    </section>
  );
}

function LiveRow({ match, onMatchClick, onAddBet, selectedBets }: {
  match: Match;
  onMatchClick: (id: string) => void;
  onAddBet: (b: Bet) => void;
  selectedBets: Bet[];
}) {
  const isSelected = (id: string) => selectedBets.some(b => b.id === id);
  const o1x2 = get1x2(match);
  const hasDraw = o1x2.draw != null;
  const oddKeys = hasDraw ? ['home', 'draw', 'away'] : ['home', 'away'];
  const oddLabels = hasDraw ? ['1', 'X', '2'] : ['1', '2'];
  const oddValues = hasDraw ? [o1x2.home, o1x2.draw!, o1x2.away] : [o1x2.home, o1x2.away];

  const handleOdd = (k: string, i: number) => {
    const id = `${match.id}-1x2-${k}`;
    onAddBet({
      id, matchId: match.id,
      matchLabel: `${match.home.name} - ${match.away.name}`,
      competition: match.competition,
      market: 'Wynik meczu (live)',
      marketType: 'h2h',
      pick: `${oddLabels[i]} · ${k === 'home' ? match.home.name : k === 'away' ? match.away.name : 'Remis'}`,
      odds: oddValues[i]
    });
  };

  const cols = hasDraw ? '120px 1fr 130px 180px 44px' : '120px 1fr 130px 130px 44px';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, alignItems: 'center', padding: 'var(--row-pad-y, 10px) var(--row-pad-x, 12px)', background: 'var(--bg-2)', border: '1px solid var(--line)', borderLeft: '2px solid var(--live)', borderRadius: 0, cursor: 'pointer', position: 'relative', overflow: 'hidden', transition: 'background 0.10s' }}
         onClick={() => onMatchClick(match.id)}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span style={{ color: 'var(--gold)', display: 'flex' }}><SportIcon sport={match.sport} size={12} /></span>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{match.competition}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#ff8a8a', fontWeight: 700, letterSpacing: '0.04em', marginTop: 2, fontFamily: 'var(--f-mono)' }}>
            <span className="live-dot" />{match.minute}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        {[match.home, match.away].map((team, ti) => (
          <div key={ti} style={{ display: 'grid', gridTemplateColumns: '20px 1fr auto', gap: 8, alignItems: 'center' }}>
            <TeamCrest code={team.code} logo={team.logo} size={20} />
            <span style={{ fontSize: 13, color: 'var(--cream)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team.name}</span>
            {match.score && <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold-bright)', minWidth: 16, textAlign: 'right' }}>{match.score[ti]}</span>}
          </div>
        ))}
      </div>

      {match.pressure && (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <PressureWave data={match.pressure} height={22} />
          <div className="momentum-track" style={{ marginTop: 4 }}>
            <div className="home-side" style={{ width: `${(1 - (match.momentum || 0.5)) * 100}%` }} />
            <div className="away-side" style={{ width: `${(match.momentum || 0.5) * 100}%` }} />
            <div className="center" />
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${oddKeys.length}, minmax(0, 1fr))`, gap: 4 }}>
        {oddKeys.map((k, i) => {
          const id = `${match.id}-1x2-${k}`;
          return <OddButton key={k} label={oddLabels[i]}
                            value={oddValues[i]}
                            delta={undefined}
                            selected={isSelected(id)}
                            onClick={() => handleOdd(k, i)} />;
        })}
      </div>

      <button style={{ appearance: 'none', border: '1px solid var(--line-cool)', background: 'transparent', color: 'var(--text-2)', font: '600 11px var(--f-ui)', padding: 0, height: 44, borderRadius: 0, cursor: 'pointer' }}
              onClick={e => { e.stopPropagation(); onMatchClick(match.id); }}>
        +24
      </button>
    </div>
  );
}
