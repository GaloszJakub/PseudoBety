'use client';
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

export default function TopEventsRow({ matches, onMatchClick, onAddBet, selectedBets }: Props) {
  const events = matches.slice(0, 3);
  const isSelected = (id: string) => selectedBets.some(b => b.id === id);

  return (
    <section>
      <div className="sec-head">
        <h2 className="sec-title"><span className="sec-mark">⚜</span> Top wydarzenia</h2>
        <button className="sec-link">Wszystkie →</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {events.map(m => (
          <TopEventCard key={m.id} match={m} onClick={() => onMatchClick(m.id)}
                        onAddBet={onAddBet} isSelected={isSelected} />
        ))}
      </div>
    </section>
  );
}

function TopEventCard({ match, onClick, onAddBet, isSelected }: {
  match: Match;
  onClick: () => void;
  onAddBet: (b: Bet) => void;
  isSelected: (id: string) => boolean;
}) {
  const isLive = match.state !== 'upcoming' && match.score;
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
      market: 'Wynik meczu',
      marketType: 'h2h',
      pick: `${oddLabels[i]} · ${k === 'home' ? match.home.name : k === 'away' ? match.away.name : 'Remis'}`,
      odds: oddValues[i]
    });
  };

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 0, background: 'var(--bg-2)', padding: 'var(--card-pad, 14px)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 'var(--row-gap, 10px)', transition: 'background 0.10s' }}
         onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-2)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <span style={{ color: 'var(--gold)' }}><SportIcon sport={match.sport} size={11} /></span>
          <span>{match.competition}</span>
        </div>
        {isLive ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#ff8a8a', fontWeight: 700, fontFamily: 'var(--f-mono)', fontSize: 11, flexShrink: 0 }}>
            <span className="live-dot" />{match.minute}
          </span>
        ) : (
          <span style={{ color: 'var(--gold)', fontFamily: 'var(--f-mono)', fontWeight: 600, fontSize: 11, flexShrink: 0 }}>
            {match.kickoff?.replace(' · ', ' ') || ''}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[match.home, match.away].map((team, ti) => (
          <div key={ti} style={{ display: 'grid', gridTemplateColumns: '26px 1fr auto', alignItems: 'center', gap: 10 }}>
            <TeamCrest code={team.code} logo={team.logo} size={26} />
            <span style={{ fontSize: 'var(--type-row, 14px)', fontWeight: 600, color: 'var(--cream)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team.name}</span>
            {isLive && match.score && <span className="mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--gold-bright)' }}>{match.score[ti]}</span>}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${oddKeys.length}, 1fr)`, gap: 4, marginTop: 2 }}>
        {oddKeys.map((k, i) => {
          const id = `${match.id}-1x2-${k}`;
          return <OddButton key={k} label={oddLabels[i]} value={oddValues[i]} delta={undefined}
                            selected={isSelected(id)} onClick={() => handleOdd(k, i)} />;
        })}
      </div>
    </div>
  );
}
