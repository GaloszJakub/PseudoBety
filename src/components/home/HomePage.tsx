'use client';
import TopEventsRow from './TopEventsRow';
import LiveStrip from './LiveStrip';
import UpcomingTable from './UpcomingTable';
import type { Match } from '@/lib/data';
import { Bet } from '../BetSlip';

interface Props {
  onMatchClick: (id: string) => void;
  onAddBet: (bet: Bet) => void;
  selectedBets: Bet[];
  liveMatches: Match[];
  upcomingMatches: Match[];
}

export default function HomePage({ onMatchClick, onAddBet, selectedBets, liveMatches, upcomingMatches }: Props) {
  const allMatches = [...liveMatches, ...upcomingMatches];
  const hasData = allMatches.length > 0;

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--section-gap, 22px)' }}>
      {hasData && (
        <TopEventsRow matches={allMatches} onMatchClick={onMatchClick}
                      onAddBet={onAddBet} selectedBets={selectedBets} />
      )}
      {liveMatches.length > 0 && (
        <LiveStrip matches={liveMatches} onMatchClick={onMatchClick}
                   onAddBet={onAddBet} selectedBets={selectedBets} />
      )}
      {upcomingMatches.length > 0 ? (
        <UpcomingTable matches={upcomingMatches} onMatchClick={onMatchClick}
                       onAddBet={onAddBet} selectedBets={selectedBets} />
      ) : !hasData ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
          Ładowanie meczy...
        </div>
      ) : null}
    </div>
  );
}
