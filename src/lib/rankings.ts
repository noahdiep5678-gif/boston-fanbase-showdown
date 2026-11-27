import type { FanSection } from '@/constants/fan-sections';
import { getFanId } from '@/lib/fan-session';
import { supabase } from '@/lib/supabase';

type RankedRound = {
  p_game: 'wicked-smaht' | 'timeline' | 'mystery-player' | 'boston-trivia' | 'where-in-boston';
  p_section: FanSection['id'];
  p_date: string;
  p_answers: readonly string[] | readonly number[] | readonly { latitude: number; longitude: number }[];
};

export type Ranking = {
  place: number;
  fan_name: string;
  points: number;
  rounds: number;
  is_you: boolean;
};

const queueKey = 'stadium-pulse:ranked-rounds';
type QueuedRound = { round: RankedRound; savedAt: number; sent?: boolean };
let syncing: Promise<void> = Promise.resolve();

function readQueue(): Record<string, QueuedRound> {
  try {
    return JSON.parse(localStorage.getItem(queueKey) ?? '{}');
  } catch {
    return {};
  }
}

function saveQueue(queue: Record<string, QueuedRound>) {
  localStorage.setItem(queueKey, JSON.stringify(queue));
}

export function queueRankedRound(round: RankedRound) {
  const key = `${round.p_game}:${round.p_section}:${round.p_date}`;
  try {
    const queue = readQueue();
    if (queue[key]) return;
    queue[key] = { round, savedAt: Date.now() };
    saveQueue(queue);
  } catch {
    return;
  }
  void syncRankedRounds();
}

export function syncRankedRounds() {
  syncing = syncing.catch(() => {}).then(async () => {
    const queue = readQueue();
    for (const [key, entry] of Object.entries(queue)) {
      if (Date.now() - entry.savedAt > 3 * 86400000) {
        const latest = readQueue();
        delete latest[key];
        saveQueue(latest);
        continue;
      }
      if (entry.sent) continue;
      await getFanId();
      const { error } = await supabase.rpc('submit_ranked_daily', entry.round);
      if (error && error.code !== '22023') throw error;
      saveQueue({ ...readQueue(), [key]: { ...entry, sent: true } });
    }
  }).catch(() => {
    // Keep offline submissions for the next attempt.
  });
  return syncing;
}
