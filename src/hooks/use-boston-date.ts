import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { bostonDate } from '@/lib/dates';

export function useBostonDate() {
  const [date, setDate] = useState(bostonDate);
  useEffect(() => {
    const update = () => setDate(bostonDate());
    const timer = setInterval(update, 15_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') update();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);

  return date;
}
