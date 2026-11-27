import { useSyncExternalStore } from 'react';

import type { FanSectionId } from '@/constants/fan-sections';
import { bostonDate, shiftDate } from '@/lib/dates';
import { readJSON, writeJSON } from '@/lib/storage';

/**
 * On-device record of finished games. This is the fan's personal history only;
 * it is NOT an authoritative scoring ledger and never feeds shared standings.
 */
export type GameKind = 'wicked-smaht' | 'mystery-player' | 'timeline' | 'jersey-check' | 'who-came-first' | 'deep-cut' | 'boston-trivia' | 'where-in-boston' | 'predictions';

export type LedgerEntry = {
  id: string;
  game: GameKind;
  section: FanSectionId;
  /** Boston calendar date the result belongs to. */
  date: string;
  score: number;
  max: number;
  /** Practice results are shown in history but excluded from points and streaks. */
  practice: boolean;
  at: number;
  summary?: string;
};

const KEY = 'stadium-pulse:ledger:v1';
const LIMIT = 500;
const listeners = new Set<() => void>();
let cache: LedgerEntry[] | undefined;

function load(): LedgerEntry[] {
  if (!cache) {
    const raw = readJSON<unknown>(KEY, []);
    cache = Array.isArray(raw) ? (raw as LedgerEntry[]).filter((entry) => entry && typeof entry.id === 'string') : [];
  }
  return cache;
}

export function recordResult(entry: Omit<LedgerEntry, 'at' | 'date'> & { date?: string }) {
  const entries = load();
  if (entries.some((item) => item.id === entry.id)) return;
  cache = [{ ...entry, date: entry.date ?? bostonDate(), at: Date.now() }, ...entries].slice(0, LIMIT);
  writeJSON(KEY, cache);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useLedger() {
  return useSyncExternalStore(subscribe, load, load);
}

export function hasPlayed(entries: LedgerEntry[], game: GameKind, section: FanSectionId, date = bostonDate()) {
  return entries.some((entry) => entry.game === game && entry.section === section && entry.date === date && !entry.practice);
}

/** Games with one scored round per day. */
export const DAILY_GAMES: Record<FanSectionId, GameKind[]> = {
  celtics: ['wicked-smaht', 'mystery-player', 'timeline'],
  patriots: ['wicked-smaht', 'mystery-player', 'timeline'],
  bruins: ['wicked-smaht', 'mystery-player', 'timeline'],
  boston: ['boston-trivia', 'timeline', 'where-in-boston'],
};

/** Consecutive Boston days (ending today, or yesterday if today isn't played yet) with any scored daily result. */
export function dailyStreak(entries: LedgerEntry[], game: GameKind | GameKind[] | 'any', section?: FanSectionId) {
  const games = game === 'any' ? null : Array.isArray(game) ? game : [game];
  const days = new Set(entries
    .filter((entry) => (!games || games.includes(entry.game)) && !entry.practice && (!section || entry.section === section))
    .map((entry) => entry.date));
  let day = bostonDate();
  if (!days.has(day)) day = shiftDate(day, -1);
  let streak = 0;
  while (days.has(day)) {
    streak += 1;
    day = shiftDate(day, -1);
  }
  return streak;
}

export function summarize(entries: LedgerEntry[]) {
  const scored = entries.filter((entry) => !entry.practice);
  return {
    points: scored.reduce((sum, entry) => sum + entry.score, 0),
    played: entries.length,
    scoredPlayed: scored.length,
    perfect: scored.filter((entry) => entry.max > 0 && entry.score === entry.max).length,
    activeDays: new Set(entries.map((entry) => entry.date)).size,
  };
}
