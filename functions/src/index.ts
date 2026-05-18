import { onSchedule } from 'firebase-functions/v2/scheduler';
import { initializeApp } from 'firebase-admin/app';
import { fetchOddsJob } from './fetchOdds';
import { fetchFixturesJob } from './fetchFixtures';
import { settleBetsJob } from './settleBets';

initializeApp();

// Co 10 min — kursy pre-match z The Odds API
export const fetchOdds = onSchedule(
  { schedule: 'every 10 minutes', region: 'europe-west3', timeoutSeconds: 60 },
  fetchOddsJob
);

// Co 60 min — nadchodzące mecze z API-Football
export const fetchFixtures = onSchedule(
  { schedule: 'every 60 minutes', region: 'europe-west3', timeoutSeconds: 120 },
  fetchFixturesJob
);

// Co 5 min — live wyniki + rozliczanie zakładów
export const settleBets = onSchedule(
  { schedule: 'every 5 minutes', region: 'europe-west3', timeoutSeconds: 120 },
  settleBetsJob
);
