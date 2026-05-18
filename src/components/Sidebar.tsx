'use client';
import { useState, useMemo, memo, startTransition, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import SportIcon from './shared/SportIcon';

const SPORT_LABELS: Record<string, string> = {
  football:   'Piłka nożna',
  tennis:     'Tenis',
  basketball: 'Koszykówka',
  baseball:   'Baseball',
  hockey:     'Hokej',
  volleyball: 'Siatkówka',
  handball:   'Piłka ręczna',
  mma:        'MMA',
  nfl:        'NFL',
  other:      'Inne',
};

interface Props {
  activeSport: string;
  onSportChange: (s: string) => void;
  activeLeague: string | null;
  onLeagueChange: (l: string | null) => void;
  sportData: Record<string, Set<string>>;
  countryFlags?: Record<string, Record<string, string>>;
  liveCount: number;
}

const sbRowStyle: React.CSSProperties = {
  appearance: 'none', border: 0, background: 'transparent',
  color: 'var(--text)', font: '500 13px/1 var(--f-ui)',
  padding: '8px 10px', borderRadius: 0,
  display: 'flex', alignItems: 'center', gap: 10,
  cursor: 'pointer', textAlign: 'left', width: '100%',
};
const sbLabelStyle: React.CSSProperties = {
  flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};
const sbCountStyle: React.CSSProperties = {
  fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--text-3)',
  fontWeight: 500, fontVariantNumeric: 'tabular-nums',
};

const LEAGUE_ROW_H = 30;
const MAX_VISIBLE_H = 260;

const LeagueButton = memo(function LeagueButton({
  league, active, onSelect,
}: { league: string; active: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      style={{
        appearance: 'none', border: 0, background: 'transparent',
        font: `${active ? '700' : '500'} 12px/1 var(--f-ui)`,
        color: active ? 'var(--gold-bright)' : 'var(--text-2)',
        padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6,
        cursor: 'pointer', width: '100%', textAlign: 'left', height: LEAGUE_ROW_H,
      }}>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{league}</span>
    </button>
  );
});

const SportSection = memo(function SportSection({
  sport, leagues, isOpen, isActive, activeLeague,
  onSportChange, onLeagueChange, onToggle,
}: {
  sport: string;
  leagues: string[];
  isOpen: boolean;
  isActive: boolean;
  activeLeague: string | null;
  onSportChange: (s: string) => void;
  onLeagueChange: (l: string | null) => void;
  onToggle: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: leagues.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => LEAGUE_ROW_H,
    overscan: 5,
    enabled: isOpen,
  });

  const listH = Math.min(leagues.length * LEAGUE_ROW_H, MAX_VISIBLE_H);

  return (
    <div>
      <button
        className={'sb-row' + (isActive ? ' active' : '')}
        onClick={onToggle}
        style={sbRowStyle}>
        <span style={{ color: 'var(--text-2)', width: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <SportIcon sport={sport} size={14} />
        </span>
        <span style={sbLabelStyle}>{SPORT_LABELS[sport] || sport}</span>
        <span style={sbCountStyle}>{leagues.length}</span>
        <span style={{ color: 'var(--text-3)', fontSize: 16, lineHeight: 1, display: 'inline-block', transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>›</span>
      </button>

      {isOpen && (
        <div style={{ marginLeft: 22, borderLeft: '1px solid var(--line-cool)' }}>
          <button
            onClick={() => onLeagueChange(null)}
            style={{
              appearance: 'none', border: 0, background: 'transparent',
              font: `${activeLeague === null && isActive ? '700' : '500'} 12px/1 var(--f-ui)`,
              color: activeLeague === null && isActive ? 'var(--gold-bright)' : 'var(--text-2)',
              padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6,
              cursor: 'pointer', width: '100%', textAlign: 'left', height: LEAGUE_ROW_H,
            }}>
            <span style={{ flex: 1 }}>Wszystkie ligi</span>
            <span style={sbCountStyle}>{leagues.length}</span>
          </button>

          <div
            ref={scrollRef}
            style={{ height: listH, overflowY: 'auto', overflowX: 'hidden' }}>
            <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
              {virtualizer.getVirtualItems().map(vi => (
                <div key={vi.key} style={{ position: 'absolute', top: vi.start, left: 0, width: '100%', height: vi.size }}>
                  <LeagueButton
                    league={leagues[vi.index]}
                    active={activeLeague === leagues[vi.index]}
                    onSelect={() => { onSportChange(sport); onLeagueChange(leagues[vi.index]); }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default function Sidebar({ activeSport, onSportChange, activeLeague, onLeagueChange, sportData, liveCount }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const sports = useMemo(() =>
    Object.entries(sportData)
      .map(([sport, set]) => ({ sport, leagues: Array.from(set).sort() }))
      .sort((a, b) => b.leagues.length - a.leagues.length),
    [sportData]
  );

  const totalCount = useMemo(() =>
    sports.reduce((s, { leagues }) => s + leagues.length, 0),
    [sports]
  );

  const toggle = (sport: string) =>
    startTransition(() => {
      setExpanded(prev => ({ ...prev, [sport]: !prev[sport] }));
    });

  return (
    <aside style={{
      width: 220, flexShrink: 0,
      borderRight: '1px solid var(--line-cool)',
      background: 'var(--bg-1)',
      padding: '10px 0 20px',
      overflowY: 'auto',
      height: '100%',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', padding: '0 8px' }}>

        <button
          className={'sb-row sb-row-top' + (activeSport === 'all' ? ' active' : '')}
          onClick={() => onSportChange('all')}
          style={sbRowStyle}>
          <span style={sbLabelStyle}>Wszystkie sporty</span>
          <span style={sbCountStyle}>{totalCount}</span>
        </button>

        <button
          className={'sb-row sb-row-top' + (activeSport === 'live' ? ' active' : '')}
          onClick={() => onSportChange('live')}
          style={sbRowStyle}>
          <span className="live-dot" />
          <span style={sbLabelStyle}>Live</span>
          {liveCount > 0 && <span style={sbCountStyle}>{liveCount}</span>}
        </button>

        <div style={{ height: 1, background: 'var(--line-cool)', margin: '8px 4px' }} />

        {sports.map(({ sport, leagues }) => (
          <SportSection
            key={sport}
            sport={sport}
            leagues={leagues}
            isOpen={!!expanded[sport]}
            isActive={activeSport === sport}
            activeLeague={activeLeague}
            onSportChange={onSportChange}
            onLeagueChange={onLeagueChange}
            onToggle={() => toggle(sport)}
          />
        ))}

        {totalCount === 0 && (
          <div style={{ padding: '20px 10px', fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>
            Ładowanie...
          </div>
        )}
      </div>

    </aside>
  );
}
