@AGENTS.md

# Bety — Polski bukmacher (papierowe pieniądze)

Strona bukmacherska na papierowe pieniądze. Użytkownicy obstawiają mecze, nie ma prawdziwych przelewów.

## Stack

- **Next.js App Router** (sprawdź wersję w package.json przed użyciem API)
- **TypeScript**
- **Firebase** — Firestore (dane meczów, zakłady), Auth (email/password + Google)
- **Firebase Admin SDK** — lazy init przez Proxy (JSON.parse tylko w runtime, nie w build time)
- **Vercel** — deployment (planowany)

## API

### api-sports.io — dane meczów (fixtures)
Klucz: `API_FOOTBALL_KEY` w `.env.local`
Limit: **100 req/dzień per sport**.
Aktualnie używamy tylko **football**: `v3.football.api-sports.io/fixtures?date=`
Doc prefix: `afoot-{id}`

### odds-api.io — kursy
Klucz: `ODDS_API_KEY` w `.env.local`
Limit: **100 req/godzinę** (free tier, max 2 bookmakers jednocześnie)
Bookmakers: `Bet365,22Bet`
Endpointy:
- `GET /v3/sports` — lista dostępnych sportów
- `GET /v3/events?sport={slug}&apiKey={key}` — lista eventów (bez kursów)
- `GET /v3/odds/multi?eventIds={ids}&bookmakers={bm}&apiKey={key}` — kursy dla max 10 eventów

Sport slug mapping (`src/lib/odds-helpers.ts`):
```
football → football, basketball → basketball, hockey → ice-hockey
nfl → american-football, volleyball → volleyball, handball → handball, mma → mixed-martial-arts
```

## Firestore — struktura

### `matches/{externalId}`
```
externalId: string          // "afoot-12345"
source: "api-football"
sport: string               // "football"
competition: string         // nazwa ligi
country: string | null
countryFlag: string | null  // URL flagi
home: { name, code, logo }
away: { name, code, logo }
commenceTime: Timestamp
venue: string | null
status: "upcoming" | "live" | "finished"
score: [homeGoals, awayGoals] | null
minute: string | null       // "67'"
fixtureUpdatedAt: Timestamp
odds: { home, draw|null, away } | null   // dopisuje fetch-odds
markets: Market[]                         // dopisuje fetch-odds
oddsUpdatedAt: Timestamp | null
```

### `users/{uid}`
```
email, displayName, balance (number, PLN), role ("user"|"admin")
isPrivate, suspended, suspendedReason, createdAt
```

### `bets/{id}`
```
userId, stake, totalOdds, potentialWin
status: "pending" | "won" | "lost"
createdAt, settledAt, actualWin
selections: [{ matchId, matchLabel, competition, market, marketType, pick, odds }]
```

## Crony (`src/app/api/cron/`)

Wszystkie chronione `Authorization: Bearer {CRON_SECRET}`.

| Route | Co robi | Kiedy | Budget |
|-------|---------|-------|--------|
| `fetch-fixtures` | Pobiera mecze yesterday/dziś/jutro z api-sports.io, pisze basic data do Firestore | **1×/dzień** rano | 3 req |
| `fetch-odds` | Czyta upcoming z Firestore, matchuje do odds-api.io, update tylko `odds`/`markets` | **co godzinę** | ~28 req/run |
| `settle-bets` | Rozlicza zakłady dla zakończonych meczów | co godzinę | — |
| `fetch-data` | Legacy: fixtures + odds w jednym (manual fallback) | ręcznie | ~21 req |

### fetch-fixtures — szczegóły
- 3 daty × 1 sport (football) = **3 req/run**
- Pisze ALL fixtures bez kursów (`merge: true`)
- Live + yesterday też zapisywane — `merge:true` zachowuje istniejące `odds/markets`

### fetch-odds — szczegóły
- Phase 1: czyta `status='upcoming'` z Firestore (max 500, window 48h)
- Phase 2: `/sports` + `/events` × 7 sportów = **8 req** → buduje name+time index
- Phase 3: trigram name match fixtures → eventIndex
- Phase 4: `/odds/multi` batch 10 IDs × max 20 batchy = **max 20 req**
- Phase 5: `batch.update()` tylko `odds`, `markets`, `oddsUpdatedAt`
- **Total: ~28 req/run**, Headroom: 72 req/h

### Shared helpers
`src/lib/odds-helpers.ts` — norm(), nameScore(), timeBucket(), parseMarkets(), deriveExtraMarkets(), typy OddsEvent/SlimEvent, MARKET_META, API_SPORT_TO_ODDS_SLUG

## Frontend — komponenty

```
src/
  components/
    App.tsx                 # root — SWR /api/matches (1h refresh), URL navigation
    TopBar.tsx              # balance, deposit, kupony dropdown, avatar menu
    Sidebar.tsx             # data-driven — tylko ligi z meczami z kursami (matchesWithOdds)
    BetSlip.tsx             # sticky, Firestore runTransaction (atomic bet + debit)
    DepositModal.tsx        # presets 100/500/1000/5000 PLN, increment balance
    home/
      HomePage.tsx          # LiveStrip + TopEventsRow + UpcomingTable (bez PromoBanner)
      LiveStrip.tsx
      TopEventsRow.tsx
      UpcomingTable.tsx
    match/
      MatchDetailPage.tsx   # markety h2h/totals/spreads/btts/dc/dnb, totals zawsze 2 kolumny
    profile/
      ProfilePage.tsx       # historia zakładów, statsy (balance/staked/won/winrate/ROI)
    admin/
      AdminPage.tsx
    shared/
      TeamCrest.tsx / OddButton.tsx / SportIcon.tsx
  lib/
    data.ts                 # typy Match, Market, Team; helpers get1x2, getOddsValue
    firebase-admin.ts       # lazy Proxy init
    firebase.ts             # client SDK
    firestore.ts            # subscribeToUserBets, subscribeToUserBalance, placeBet (nieużywane)
    AuthContext.tsx          # onSnapshot balance, ensureUserDoc w onAuthStateChanged (fix persisted sessions)
    cron-auth.ts            # verifyCronToken
    odds-helpers.ts         # shared odds logic
  app/
    api/matches/route.ts    # in-memory cache 5min, limit 200 live + 500 upcoming
    match/[id]/page.tsx     # SSR route dla deep-link
    profile/page.tsx        # SSR shell
```

### Kluczowe wzorce

**SWR matches** (`App.tsx`):
```typescript
useSWR('/api/matches', fetcher, { refreshInterval: 3_600_000, dedupingInterval: 1_800_000 })
```

**hasOdds filter** — na stronie i w sidebar widać TYLKO mecze z `odds` lub `markets`.

**Sidebar leagues** — bierze z `matchesWithOdds` (nie `allMatches`) — brak lig bez kursów.

**Sidebar klik ligi/sportu** → navigate do home jeśli jesteś na innej stronie.

**Totals kolumny** — zawsze 2 (`market.type === 'totals' ? 2 : ...`).

**BetSlip transaction** — `runTransaction`: read userBalance → debit → write bet. Throws jeśli saldo < stake.

**AuthContext** — `ensureUserDoc(u)` w `onAuthStateChanged` (fix: bez tego persisted session user nie miał doca → "niewystarczające saldo").

**Live matches** — w `fetch-data` i `fetch-fixtures`: live → zawsze write, `merge:true` zachowuje odds.

### Layout — sticky BetSlip
```css
html, body { height: 100%; overflow: hidden; }
.app-shell { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
.app-body  { display: flex; flex: 1; overflow: hidden; min-height: 0; }
.app-main  { flex: 1; overflow-y: auto; }
```

## Zmienne środowiskowe (`.env.local`)

```
NEXT_PUBLIC_FIREBASE_PROJECT_ID=bety-app-prod
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}  # MUSI być w jednej linii!
CRON_SECRET=HuxfEaXhSCtuZgOEcM3ggO7cOaJ4dLqimLKqFeFeykY=
ODDS_API_KEY=810771958902d388739c70939125c2fdf0063dd25b5b22ebbc7c45600bd1ad38
API_FOOTBALL_KEY=c6a4cf5ba2d10c33d027e3381a9597e1
```

## Co jest zrobione

- [x] Auth (email/password + Google)
- [x] fetch-fixtures (1×/dzień, football, 3 daty)
- [x] fetch-odds (co godzinę, trigram match, odds/multi batch, shared lib)
- [x] settle-bets (rozliczanie zakładów)
- [x] `/api/matches` in-memory cache 5 min
- [x] SWR 1h refresh na froncie
- [x] BetSlip — postaw zakład (Firestore transaction, atomic debit)
- [x] Deposit modal (presets PLN, increment balance)
- [x] Profile page (historia zakładów, statsy)
- [x] TopBar — kupony dropdown (pending bets live via onSnapshot)
- [x] AuthContext — live balance via onSnapshot + fix ensureUserDoc
- [x] Sidebar — tylko ligi z kursami, klik → navigate home
- [x] Totals market — 2 kolumny
- [x] Usunięty PromoBanner i bonus powitalny z sidebar
- [x] Mecze live → zawsze write (zachowują odds via merge)

## Co zostało do zrobienia

- [ ] Fix settle-bets: `resolveSelection` per marketType (totals/btts/spreads/dc/dnb)
- [ ] Fix settle-bets: push `status:'finished'` na meczach
- [ ] Deploy na Vercel
- [ ] Cron-job.org setup (fetch-fixtures 1×/dzień, fetch-odds co godzinę, settle-bets co godzinę)
- [ ] Re-enable inne sporty (basketball, hockey) gdy potrzebne
- [ ] Usunąć `fetch-data/route.ts` po potwierdzeniu że nowe crony działają

## Znane problemy / gotchas

- `FIREBASE_SERVICE_ACCOUNT_KEY` — **jedna linia** w `.env.local`
- odds-api.io free tier: max 2 bookmakers per request
- `fetch-odds` używa `batch.update()` — doc musi istnieć (created by fetch-fixtures)
- settle-bets rozlicza tylko h2h (1/X/2) — inne markety → automatycznie `lost` (BUG)
- Mecze bez kursów nie są widoczne na stronie (hasOdds filter) — normalne zachowanie
