const sparkline = (n: number, seed: number): number[] => {
  const out: number[] = [];
  let v = 50 + (seed % 30);
  for (let i = 0; i < n; i++) {
    v += (Math.sin(seed + i * 1.3) * 8) + (Math.cos(seed * 0.7 + i) * 5);
    v = Math.max(8, Math.min(92, v));
    out.push(v);
  }
  return out;
};

export interface Team {
  name: string;
  short?: string;
  code: string;
  logo?: string;
  color?: string;
  form?: string[];
}

export interface OddsValue {
  value: number;
  delta?: number;
  trend?: 'up' | 'down' | 'flat';
  history?: number[];
}

export interface Match {
  id: string;
  sport: string;
  competition: string;
  country?: string;
  countryFlag?: string;
  kickoff?: string;
  venue?: string;
  state?: string;
  minute?: string | null;
  home: Team;
  away: Team;
  aggregate?: string;
  score?: number[] | null;
  gameScore?: string;
  currentSet?: string;
  odds?: {
    home: OddsValue | number;
    draw?: OddsValue | number;
    away: OddsValue | number;
  };
  markets?: Market[];
  headline?: string;
  pulse?: string;
  topMarket?: string;
  topMarketOdds?: number;
  momentum?: number;
  pressure?: number[];
  stats?: Record<string, number[]>;
  eventStream?: { min: string; kind: string; team: string; text: string }[];
  heat?: number;
  tags?: string[];
}

export interface MarketOutcome {
  label: string;
  sub?: string;
  value: number;
  delta?: number;
  hot?: boolean;
}

export interface Market {
  name: string;
  subtitle: string;
  type: string;
  outcomes: MarketOutcome[];
}

export const featured: Match = {
  id: 'real-bayern',
  sport: 'football',
  competition: 'Liga Mistrzów · Półfinał · 2. mecz',
  venue: 'Santiago Bernabéu, Madryt',
  kickoff: 'Dziś · 21:00',
  state: 'upcoming',
  minute: null,
  home: { name: 'Real Madryt', short: 'RMA', code: 'RM', color: '#f5f5f5', form: ['W','W','D','W','W'] },
  away: { name: 'Bayern Monachium', short: 'BAY', code: 'BAY', color: '#dc0a2d', form: ['W','D','W','W','L'] },
  aggregate: 'Łącznie 2:2',
  score: null,
  odds: {
    home: { value: 2.10, delta: -0.15, trend: 'down', history: sparkline(20, 1) },
    draw: { value: 3.65, delta: +0.05, trend: 'up', history: sparkline(20, 2) },
    away: { value: 3.20, delta: +0.10, trend: 'up', history: sparkline(20, 3) }
  },
  headline: 'Dwie dynastie. Jedno miejsce w finale.',
  pulse: 'Obstawiło 18 421 osób',
  topMarket: 'BTTS — Tak',
  topMarketOdds: 1.72
};

export const liveMatches: Match[] = [
  {
    id: 'arsenal-city',
    sport: 'football',
    competition: 'Premier League',
    home: { name: 'Arsenal', short: 'ARS', code: 'ARS' },
    away: { name: 'Manchester City', short: 'MCI', code: 'MCI' },
    score: [1, 1],
    minute: "67'",
    momentum: 0.62,
    pressure: sparkline(40, 7),
    stats: { possession: [54, 46], shots: [9, 12], onTarget: [3, 5], corners: [4, 6] },
    odds: {
      home: { value: 3.40, delta: +0.6, trend: 'up' },
      draw: { value: 2.15, delta: -0.25, trend: 'down' },
      away: { value: 2.30, delta: -0.4, trend: 'down' }
    },
    eventStream: [
      { min: "63'", kind: 'corner', team: 'away', text: 'Rzut rożny dla City' },
      { min: "61'", kind: 'shot', team: 'away', text: 'Strzał Haalanda — obroniony' },
      { min: "58'", kind: 'card', team: 'home', text: 'Żółta kartka — Rice' }
    ]
  },
  {
    id: 'djokovic-alcaraz',
    sport: 'tennis',
    competition: 'Roland Garros · Półfinał',
    home: { name: 'N. Djoković', short: 'DJO', code: 'DJO' },
    away: { name: 'C. Alcaraz', short: 'ALC', code: 'ALC' },
    score: [1, 2],
    gameScore: '3:4',
    currentSet: 'Set 4',
    minute: "Set 4 · gem 8",
    momentum: 0.58,
    pressure: sparkline(40, 13),
    stats: { aces: [8, 14], firstServe: [68, 74], breaks: [2, 4], winners: [22, 31] },
    odds: {
      home: { value: 3.85, delta: +1.20, trend: 'up' },
      away: { value: 1.28, delta: -0.32, trend: 'down' }
    }
  },
  {
    id: 'lakers-celtics',
    sport: 'basketball',
    competition: 'NBA Finals · Gra 5',
    home: { name: 'LA Lakers', short: 'LAL', code: 'LAL' },
    away: { name: 'Boston Celtics', short: 'BOS', code: 'BOS' },
    score: [88, 91],
    minute: "Q4 · 04:12",
    momentum: 0.55,
    pressure: sparkline(40, 21),
    stats: { fg: [44, 48], threes: [11, 13], rebounds: [38, 41], ast: [22, 19] },
    odds: {
      home: { value: 2.80, delta: +0.30, trend: 'up' },
      away: { value: 1.42, delta: -0.18, trend: 'down' }
    }
  }
];

export const upcoming: Match[] = [
  {
    id: 'liverpool-united', sport: 'football', competition: 'Premier League',
    kickoff: 'Dziś 18:30',
    home: { name: 'Liverpool', short: 'LIV', code: 'LIV' },
    away: { name: 'Man United', short: 'MUN', code: 'MUN' },
    odds: { home: 1.65, draw: 4.20, away: 4.80 },
    heat: 12483, tags: ['Top mecz', 'Streaming']
  },
  {
    id: 'psg-marseille', sport: 'football', competition: 'Ligue 1',
    kickoff: 'Dziś 21:00',
    home: { name: 'PSG', short: 'PSG', code: 'PSG' },
    away: { name: 'Marseille', short: 'OM', code: 'OM' },
    odds: { home: 1.42, draw: 4.75, away: 6.50 },
    heat: 8210, tags: ['Klasyk']
  },
  {
    id: 'barca-atletico', sport: 'football', competition: 'La Liga',
    kickoff: 'Jutro 16:15',
    home: { name: 'FC Barcelona', short: 'BAR', code: 'BAR' },
    away: { name: 'Atlético', short: 'ATM', code: 'ATM' },
    odds: { home: 1.95, draw: 3.50, away: 3.80 },
    heat: 9120, tags: []
  },
  {
    id: 'sinner-medvedev', sport: 'tennis', competition: 'Roland Garros · Ćwierćfinał',
    kickoff: 'Jutro 14:00',
    home: { name: 'J. Sinner', short: 'SIN', code: 'SIN' },
    away: { name: 'D. Miedwiediew', short: 'MED', code: 'MED' },
    odds: { home: 1.55, away: 2.45 },
    heat: 4321, tags: ['Streaming']
  },
  {
    id: 'swiatek-gauff', sport: 'tennis', competition: 'Roland Garros · Półfinał',
    kickoff: 'Jutro 17:30',
    home: { name: 'I. Świątek', short: 'SWI', code: 'SWI' },
    away: { name: 'C. Gauff', short: 'GAU', code: 'GAU' },
    odds: { home: 1.38, away: 3.05 },
    heat: 15670, tags: ['🇵🇱 Polski mecz']
  },
  {
    id: 'warriors-nuggets', sport: 'basketball', competition: 'NBA',
    kickoff: 'Jutro 03:30',
    home: { name: 'Warriors', short: 'GSW', code: 'GSW' },
    away: { name: 'Nuggets', short: 'DEN', code: 'DEN' },
    odds: { home: 2.10, away: 1.75 },
    heat: 3210, tags: []
  },
  {
    id: 'bucks-heat', sport: 'basketball', competition: 'NBA',
    kickoff: 'Jutro 02:00',
    home: { name: 'Bucks', short: 'MIL', code: 'MIL' },
    away: { name: 'Heat', short: 'MIA', code: 'MIA' },
    odds: { home: 1.62, away: 2.30 },
    heat: 2890, tags: []
  },
  {
    id: 'chelsea-spurs', sport: 'football', competition: 'Premier League',
    kickoff: 'Niedz. 17:30',
    home: { name: 'Chelsea', short: 'CHE', code: 'CHE' },
    away: { name: 'Tottenham', short: 'TOT', code: 'TOT' },
    odds: { home: 2.05, draw: 3.60, away: 3.40 },
    heat: 6470, tags: ['Derby Londynu']
  }
];

export const matchMarkets: Record<string, Market[]> = {
  'real-bayern': [
    {
      name: 'Wynik meczu', subtitle: '1X2 · czas regulaminowy', type: '1x2',
      outcomes: [
        { label: 'Real Madryt', sub: '1', value: 2.10, delta: -0.15 },
        { label: 'Remis', sub: 'X', value: 3.65, delta: +0.05 },
        { label: 'Bayern Monachium', sub: '2', value: 3.20, delta: +0.10 }
      ]
    },
    {
      name: 'Podwójna szansa', subtitle: 'Bezpieczniej', type: 'dc',
      outcomes: [
        { label: 'Real lub Remis', sub: '1X', value: 1.38 },
        { label: 'Real lub Bayern', sub: '12', value: 1.32 },
        { label: 'Remis lub Bayern', sub: 'X2', value: 1.72 }
      ]
    },
    {
      name: 'Obie strzelą gola', subtitle: 'BTTS', type: 'btts',
      outcomes: [
        { label: 'Tak', sub: 'GG', value: 1.72, hot: true },
        { label: 'Nie', sub: 'NG', value: 2.05 }
      ]
    },
    {
      name: 'Liczba goli', subtitle: 'Łącznie w meczu', type: 'totals',
      outcomes: [
        { label: 'Pow. 1.5', value: 1.22 },
        { label: 'Pon. 1.5', value: 4.10 },
        { label: 'Pow. 2.5', value: 1.78 },
        { label: 'Pon. 2.5', value: 2.05 },
        { label: 'Pow. 3.5', value: 2.95 },
        { label: 'Pon. 3.5', value: 1.42 }
      ]
    },
    {
      name: 'Strzelec gola', subtitle: 'W dowolnym momencie', type: 'scorers',
      outcomes: [
        { label: 'V. Jr', sub: 'Real', value: 2.20 },
        { label: 'Bellingham', sub: 'Real', value: 2.85 },
        { label: 'Mbappé', sub: 'Real', value: 1.95, hot: true },
        { label: 'Kane', sub: 'Bayern', value: 2.10 },
        { label: 'Musiala', sub: 'Bayern', value: 3.80 },
        { label: 'Sané', sub: 'Bayern', value: 4.20 }
      ]
    },
    {
      name: 'Dokładny wynik', subtitle: '90 min', type: 'cs',
      outcomes: [
        { label: '1:0', value: 9.50 },
        { label: '2:1', value: 8.50 },
        { label: '2:0', value: 11.0 },
        { label: '1:1', value: 6.50, hot: true },
        { label: '0:1', value: 13.0 },
        { label: '1:2', value: 14.0 }
      ]
    }
  ]
};

export const getOddsValue = (o: OddsValue | number | undefined): number =>
  o == null ? 0 : typeof o === 'object' ? o.value : o;

export const getOddsDelta = (o: OddsValue | number | undefined): number | undefined =>
  o == null || typeof o === 'number' ? undefined : o.delta;

export interface Odds1x2 {
  home: number;
  draw: number | null;
  away: number;
}

export function get1x2(match: Match): Odds1x2 {
  if (match.odds) {
    return {
      home: getOddsValue(match.odds.home),
      draw: match.odds.draw != null ? getOddsValue(match.odds.draw) : null,
      away: getOddsValue(match.odds.away),
    };
  }
  const h2h = match.markets?.find(m => m.type === 'h2h');
  if (h2h) {
    const outcomes = h2h.outcomes;
    const home = outcomes.find(o => o.label === match.home.name || o.label === '1')?.value ?? 0;
    const away = outcomes.find(o => o.label === match.away.name || o.label === '2')?.value ?? 0;
    const drawO = outcomes.find(o => o.label === 'Draw' || o.label === 'X' || o.label === 'Remis');
    return { home, draw: drawO?.value ?? null, away };
  }
  return { home: 0, draw: null, away: 0 };
}
