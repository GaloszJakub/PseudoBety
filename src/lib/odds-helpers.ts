// Shared helpers for odds-api.io integration

export interface OddsApiOutcome {
  home?: string; away?: string; draw?: string;
  hdp?: number; over?: string; under?: string;
  yes?: string; no?: string;
}

export interface OddsApiMarket {
  name: string;
  updatedAt: string;
  odds: OddsApiOutcome[];
}

export interface OddsEvent {
  id: number;
  home: string;
  away: string;
  date: string;
  status: string;
  sport: { name: string; slug: string };
  league: { name: string; slug: string };
  bookmakers: Record<string, OddsApiMarket[]>;
}

export interface SlimEvent {
  id: number;
  home: string;
  away: string;
  date: string;
}

// map api-sports.io sport name → odds-api.io slug
export const API_SPORT_TO_ODDS_SLUG: Record<string, string> = {
  football: 'football',
  basketball: 'basketball',
  hockey: 'ice-hockey',
  nfl: 'american-football',
  volleyball: 'volleyball',
  handball: 'handball',
  mma: 'mixed-martial-arts',
};

export const MARKET_META: Record<string, { name: string; subtitle: string }> = {
  h2h:           { name: 'Wynik meczu (1X2)',  subtitle: 'Pełny czas gry' },
  totals:        { name: 'Liczba goli',         subtitle: 'Ponad / Poniżej' },
  spreads:       { name: 'Handicap',            subtitle: 'Wyrównanie' },
  btts:          { name: 'Obie strzelą gola',   subtitle: 'BTTS · pełny czas' },
  double_chance: { name: 'Podwójna szansa',     subtitle: 'Wynik meczu' },
  draw_no_bet:   { name: 'Remis bez zakładu',   subtitle: 'Zwrot przy remisie' },
};

export function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function nameScore(a: string, b: string): number {
  if (a === b) return 3;
  if (a.includes(b) || b.includes(a)) return 2;
  const triA = new Set<string>();
  for (let i = 0; i <= a.length - 3; i++) triA.add(a.slice(i, i + 3));
  let shared = 0;
  for (let i = 0; i <= b.length - 3; i++) if (triA.has(b.slice(i, i + 3))) shared++;
  const total = Math.max(triA.size + Math.max(b.length - 2, 0), 1);
  return shared / total;
}

export const timeBucket = (ms: number): number => Math.floor(ms / 7_200_000);
export const r2 = (n: number): number => Math.round(n * 100) / 100;

export function deriveExtraMarkets(
  homeTeam: string, awayTeam: string,
  homePrice: number, drawPrice: number | null, awayPrice: number,
): object[] {
  const extra: object[] = [];
  const pH = 1 / homePrice;
  const pA = 1 / awayPrice;
  const pD = drawPrice ? 1 / drawPrice : 0;
  const or = pH + pA + pD || 1;
  const nH = pH / or, nA = pA / or, nD = pD / or;

  if (drawPrice) {
    extra.push({
      type: 'double_chance', ...MARKET_META['double_chance'],
      outcomes: [
        { label: `1X · ${homeTeam} lub Remis`, value: r2(1 / (nH + nD)) },
        { label: `12 · ${homeTeam} lub ${awayTeam}`, value: r2(1 / (nH + nA)) },
        { label: `X2 · Remis lub ${awayTeam}`, value: r2(1 / (nD + nA)) },
      ],
    });
    extra.push({
      type: 'draw_no_bet', ...MARKET_META['draw_no_bet'],
      outcomes: [
        { label: `DNB · ${homeTeam}`, value: r2(1 / (nH / (nH + nA))) },
        { label: `DNB · ${awayTeam}`, value: r2(1 / (nA / (nH + nA))) },
      ],
    });
  }
  return extra;
}

export function parseMarkets(event: OddsEvent): {
  odds: { home: number; draw: number | null; away: number } | null;
  markets: object[];
} {
  const bms = Object.values(event.bookmakers ?? {});
  if (bms.length === 0) return { odds: null, markets: [] };

  const bmMarkets = bms[0];
  let odds: { home: number; draw: number | null; away: number } | null = null;
  const markets: object[] = [];

  for (const m of bmMarkets) {
    const o0 = m.odds?.[0];
    if (!o0) continue;

    if (m.name === 'ML') {
      const h = parseFloat(o0.home ?? '0');
      const a = parseFloat(o0.away ?? '0');
      const d = o0.draw ? parseFloat(o0.draw) : null;
      if (!h || !a) continue;
      odds = { home: h, draw: d, away: a };
      const outcomes: object[] = [
        { label: `1 · ${event.home}`, value: h },
        ...(d ? [{ label: 'X · Remis', value: d }] : []),
        { label: `2 · ${event.away}`, value: a },
      ];
      markets.push({ type: 'h2h', ...MARKET_META['h2h'], outcomes });

    } else if (m.name === 'Totals') {
      const byPoint: Record<number, object[]> = {};
      for (const o of m.odds) {
        const pt = o.hdp ?? 2.5;
        if (!byPoint[pt]) byPoint[pt] = [];
        byPoint[pt].push(
          { label: `Ponad ${pt}`, sub: `${pt} goli`, value: parseFloat(o.over ?? '0') },
          { label: `Poniżej ${pt}`, sub: `${pt} goli`, value: parseFloat(o.under ?? '0') },
        );
      }
      const outcomes: object[] = [];
      for (const pt of Object.keys(byPoint).sort((a, b) => Number(a) - Number(b))) {
        outcomes.push(...byPoint[Number(pt)]);
      }
      if (outcomes.length > 0) markets.push({ type: 'totals', ...MARKET_META['totals'], outcomes });

    } else if (m.name === 'Asian Handicap') {
      const outcomes = m.odds.map((o: OddsApiOutcome) => {
        const hdp = o.hdp ?? 0;
        return {
          label: hdp === 0
            ? `${event.home} 0`
            : hdp > 0
              ? `${event.home} +${hdp}`
              : `${event.away} +${Math.abs(hdp)}`,
          value: parseFloat(o.home ?? '0'),
        };
      }).filter((o: any) => o.value > 0);
      if (outcomes.length > 0) markets.push({ type: 'spreads', ...MARKET_META['spreads'], outcomes });

    } else if (m.name === 'Both Teams to Score') {
      const outcomes: object[] = [];
      for (const o of m.odds) {
        if (o.yes) outcomes.push({ label: 'Tak', value: parseFloat(o.yes) });
        if (o.no) outcomes.push({ label: 'Nie', value: parseFloat(o.no) });
      }
      if (outcomes.length > 0) markets.push({ type: 'btts', ...MARKET_META['btts'], outcomes });
    }
  }

  if (odds) markets.push(...deriveExtraMarkets(event.home, event.away, odds.home, odds.draw, odds.away));
  return { odds, markets };
}
