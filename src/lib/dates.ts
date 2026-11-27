const BOSTON = 'America/New_York';

/** YYYY-MM-DD for the given instant in Boston. */
export function bostonDate(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BOSTON, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Calendar date string shifted by whole days (date-only arithmetic, no time zones). */
export function shiftDate(date: string, days: number) {
  const [y, m, d] = date.split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return shifted.toISOString().slice(0, 10);
}

/** Milliseconds until the next midnight in Boston. */
export function msUntilBostonMidnight(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BOSTON, hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23',
  }).formatToParts(now);
  const value = (type: string) => Number(parts.find((entry) => entry.type === type)?.value ?? 0);
  const elapsed = value('hour') * 3600 + value('minute') * 60 + value('second');
  return Math.max(0, (86_400 - elapsed) * 1000 - now.getMilliseconds());
}

export function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export const bostonGameTime = new Intl.DateTimeFormat('en-US', {
  timeZone: BOSTON, weekday: 'short', month: 'short', day: 'numeric',
  hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
});

export const bostonShortDate = new Intl.DateTimeFormat('en-US', {
  timeZone: BOSTON, month: 'short', day: 'numeric',
});
