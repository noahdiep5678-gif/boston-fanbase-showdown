import type { Href } from 'expo-router';

import type { FanSection } from '@/constants/fan-sections';
import type { GameKind } from '@/lib/stats';

export type GameCadence = 'daily' | 'practice' | 'endless' | 'live';

export type GameEntry = {
  game: GameKind;
  title: string;
  subtitle: string;
  icon: string;
  href: Href;
  cadence: GameCadence;
};

/** Every game offered in a section, in menu order. */
export function gamesFor(section: FanSection): GameEntry[] {
  if (section.id === 'boston') {
    return [
      { game: 'boston-trivia', title: 'Boston Trivia', subtitle: 'Five new questions on the city every day — history, landmarks, and lore.', icon: '?', href: '/boston-trivia', cadence: 'daily' },
      { game: 'deep-cut', title: 'Deep Cut', subtitle: 'Name a neighborhood, a Freedom Trail stop, a T line — the rarer your answer, the more it scores.', icon: '💎', href: { pathname: '/deep-cut', params: { sport: 'boston' } }, cadence: 'daily' },
      { game: 'timeline', title: 'Timeline', subtitle: 'Put five moments in Boston history in order. One shot a day.', icon: '⇅', href: { pathname: '/timeline', params: { sport: 'boston' } }, cadence: 'daily' },
      { game: 'where-in-boston', title: 'Where in Boston?', subtitle: 'Drop pins on five landmarks. Closer pins score more.', icon: '◎', href: '/where-in-boston', cadence: 'practice' },
    ];
  }
  const sport = section.id;
  return [
    { game: 'wicked-smaht', title: 'Wicked Smaht', subtitle: `Name 10 players from a famous ${section.name} roster. Five misses and you’re out.`, icon: '10', href: { pathname: '/wicked-smaht', params: { sport } }, cadence: 'daily' },
    { game: 'mystery-player', title: `Mystery ${section.name}`, subtitle: 'Guess the legend in six tries. Every guess reveals position, number, era, and titles clues.', icon: '?', href: { pathname: '/mystery-player', params: { sport } }, cadence: 'daily' },
    { game: 'deep-cut', title: 'Deep Cut', subtitle: 'Open-ended prompts on a 25-second clock. Rarer correct answers score up to 5× more.', icon: '💎', href: { pathname: '/deep-cut', params: { sport } }, cadence: 'daily' },
    { game: 'timeline', title: 'Timeline', subtitle: `Put five ${section.name} moments in order, earliest first. One shot a day.`, icon: '⇅', href: { pathname: '/timeline', params: { sport } }, cadence: 'daily' },
    { game: 'who-came-first', title: 'Who Came First?', subtitle: `Two ${section.name} greats — who joined the team first? Keep the streak alive.`, icon: '⏱', href: { pathname: '/who-came-first', params: { sport } }, cadence: 'endless' },
    { game: 'jersey-check', title: 'Jersey Check', subtitle: 'Quick-fire: who wore the number? Ten seconds per jersey, faster earns more.', icon: '#', href: { pathname: '/jersey-check', params: { sport } }, cadence: 'practice' },
    {
      game: 'predictions', title: 'Game Predictions',
      subtitle: sport === 'celtics' ? 'Over or under on the next Celtics game. Results after the final buzzer.' : `Practice picks while live ${section.name} picks get built.`,
      icon: '↗', href: { pathname: '/sports-predictions', params: { sport } }, cadence: sport === 'celtics' ? 'live' : 'practice',
    },
  ];
}
