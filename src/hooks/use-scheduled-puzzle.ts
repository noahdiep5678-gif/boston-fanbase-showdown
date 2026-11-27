import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

type ScheduledPuzzle = { prompt: string; roster_data: unknown };

export function useScheduledPuzzle(category: string, date: string, enabled = true) {
  const [row, setRow] = useState<ScheduledPuzzle | null>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    async function load() {
      try {
        const { data, error } = await supabase.from('daily_puzzles')
          .select('prompt, roster_data').eq('team', category).eq('puzzle_date', date).maybeSingle();
        if (!active) return;
        if (error) throw error;
        setRow(data);
        setFailed(false);
      } catch {
        if (active) setFailed(true);
      }
    }
    void load();
    return () => { active = false; };
  }, [attempt, category, date, enabled]);

  return { row, failed, retry: () => setAttempt((value) => value + 1) };
}
