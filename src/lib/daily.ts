import { useEffect, useState } from 'react';

import { readJSON, writeJSON } from '@/lib/storage';

/** Deterministic PRNG so every fan gets the same daily puzzle for a given date. */
export function seededRandom(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** State that persists per key (e.g. one daily puzzle on one date) on this device. A null key keeps it in memory only. */
export function usePersistentState<T>(key: string | null, initial: T) {
  const [state, setState] = useState<T>(() => key ? readJSON<T>(key, initial) : initial);
  useEffect(() => { if (key) writeJSON(key, state); }, [key, state]);
  return [state, setState] as const;
}
