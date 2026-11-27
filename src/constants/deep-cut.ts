import type { FanSectionId } from '@/constants/fan-sections';
import { franchisePlayers } from '@/constants/franchise-players';
import { celtics2024Answers, puzzles } from '@/constants/wicked-smaht-puzzles';

/**
 * Deep Cut: open-ended prompts where rarer correct answers score more.
 * Every prompt uses a closed, complete answer list so a right answer is never marked wrong.
 * Rarity tiers are editorial (1 = household name, 2 = real fan, 3 = deep cut) — review before scored play.
 */
export type Tier = 1 | 2 | 3;
export type DeepCutAnswer = { name: string; tier: Tier; aliases?: string[] };
export type DeepCutPrompt = { id: string; prompt: string; answers: DeepCutAnswer[] };

export const tierPoints: Record<Tier, number> = { 1: 100, 2: 250, 3: 500 };
export const tierNames: Record<Tier, string> = { 1: 'Popular pick', 2: 'Real fan', 3: 'Deep cut' };

function tiers(list: Record<Tier, (string | DeepCutAnswer)[]>): DeepCutAnswer[] {
  return ([1, 2, 3] as Tier[]).flatMap((tier) =>
    list[tier].map((item) => typeof item === 'string' ? { name: item, tier } : { ...item, tier }));
}

/** Championship rosters: franchise legends are popular picks, everyone else is a deep cut. */
function roster(id: string, prompt: string, names: string[], team: 'celtics' | 'patriots' | 'bruins'): DeepCutPrompt {
  const stars = new Set(franchisePlayers[team].map((p) => normalizeAnswer(p.name)));
  return { id, prompt, answers: names.map((name) => ({ name, tier: stars.has(normalizeAnswer(name)) ? 1 : 3 })) };
}

export const deepCutPrompts: Record<FanSectionId, DeepCutPrompt[]> = {
  celtics: [
    { id: 'celtics-retired', prompt: 'Name anyone the Celtics honored with a retired number or banner.', answers: tiers({
      1: ['Bill Russell', 'Larry Bird', 'Paul Pierce', 'Kevin Garnett', 'Bob Cousy', 'John Havlicek', 'Kevin McHale', 'Robert Parish'],
      2: ['Dave Cowens', 'Sam Jones', 'Jo Jo White', 'Tom Heinsohn', 'Dennis Johnson', 'Cedric Maxwell', 'Reggie Lewis', 'K.C. Jones', { name: 'Red Auerbach', tier: 2, aliases: ['Arnold Auerbach'] }],
      3: [{ name: 'Satch Sanders', tier: 3, aliases: ['Tom Sanders', 'Thomas Sanders'] }, 'Don Nelson', 'Bill Sharman', 'Ed Macauley', 'Frank Ramsey', 'Jim Loscutoff', 'Walter Brown', 'Johnny Most'],
    }) },
    { id: 'celtics-title-coaches', prompt: 'Name a head coach who won an NBA title with the Celtics.', answers: tiers({
      1: ['Red Auerbach', 'Doc Rivers', 'Joe Mazzulla'],
      2: ['K.C. Jones', 'Tom Heinsohn', 'Bill Russell'],
      3: ['Bill Fitch'],
    }) },
    { id: 'celtics-finals-mvp', prompt: 'Name a Celtic who won NBA Finals MVP.', answers: tiers({
      1: ['Larry Bird', 'Paul Pierce', 'Jaylen Brown'],
      2: ['John Havlicek'],
      3: ['Jo Jo White', 'Cedric Maxwell'],
    }) },
    roster('celtics-2008', 'Name anyone from the 2008 Celtics championship roster.', puzzles.celtics?.answers ?? [], 'celtics'),
    roster('celtics-2024', 'Name anyone from the 2024 Celtics championship roster.', celtics2024Answers, 'celtics'),
  ],
  patriots: [
    { id: 'patriots-retired', prompt: 'Name a player whose number the Patriots have retired.', answers: tiers({
      1: ['Tom Brady'],
      2: ['John Hannah', 'Gino Cappelletti', 'Mike Haynes'],
      3: ['Steve Nelson', 'Bruce Armstrong', 'Jim Lee Hunt', 'Bob Dee'],
    }) },
    { id: 'patriots-sb-qb', prompt: 'Name a quarterback who started a Super Bowl for the Patriots.', answers: tiers({
      1: ['Tom Brady'], 2: ['Drew Bledsoe'], 3: ['Tony Eason'],
    }) },
    { id: 'patriots-sb-mvp', prompt: 'Name a Patriot who was named Super Bowl MVP.', answers: tiers({
      1: ['Tom Brady'], 2: ['Julian Edelman'], 3: ['Deion Branch'],
    }) },
    { id: 'patriots-sb-coach', prompt: 'Name a head coach who took the Patriots to a Super Bowl.', answers: tiers({
      1: ['Bill Belichick'], 2: ['Bill Parcells'], 3: ['Raymond Berry'],
    }) },
    roster('patriots-2001', 'Name anyone from the 2001 Patriots championship roster.', puzzles.patriots?.answers ?? [], 'patriots'),
  ],
  bruins: [
    { id: 'bruins-retired', prompt: 'Name a Bruin whose number was retired by 2022.', answers: tiers({
      1: ['Bobby Orr', 'Ray Bourque', 'Phil Esposito', 'Cam Neely'],
      2: ['Johnny Bucyk', 'Milt Schmidt', 'Eddie Shore', 'Willie O’Ree', 'Terry O’Reilly'],
      3: ['Rick Middleton', 'Dit Clapper', 'Lionel Hitchman'],
    }) },
    { id: 'bruins-cup-coach', prompt: 'Name a head coach who won the Stanley Cup with the Bruins.', answers: tiers({
      1: ['Claude Julien'], 2: ['Harry Sinden'], 3: ['Tom Johnson', 'Art Ross', 'Cooney Weiland', 'Cy Denneny'],
    }) },
    { id: 'bruins-conn-smythe', prompt: 'Name a Bruin who won the Conn Smythe Trophy.', answers: tiers({
      1: ['Bobby Orr'], 2: ['Tim Thomas'], 3: [],
    }) },
    roster('bruins-2011', 'Name anyone who played for Boston in the 2011 Stanley Cup playoffs.', puzzles.bruins?.answers ?? [], 'bruins'),
  ],
  boston: [
    { id: 'boston-neighborhoods', prompt: 'Name an official Boston neighborhood.', answers: tiers({
      1: ['Back Bay', 'Beacon Hill', 'North End', 'South End', { name: 'South Boston', tier: 1, aliases: ['Southie'] }, 'Charlestown', 'Dorchester', { name: 'Fenway', tier: 1, aliases: ['Fenway-Kenmore', 'Kenmore'] }],
      2: [{ name: 'Jamaica Plain', tier: 2, aliases: ['JP'] }, { name: 'East Boston', tier: 2, aliases: ['Eastie'] }, 'Roxbury', 'Allston', 'Brighton', 'Chinatown', 'Downtown', 'West End'],
      3: ['Bay Village', 'Hyde Park', 'Mattapan', 'Mission Hill', 'Roslindale', 'West Roxbury', 'Leather District', { name: 'South Boston Waterfront', tier: 3, aliases: ['Seaport', 'Seaport District'] }],
    }) },
    { id: 'boston-freedom-trail', prompt: 'Name a stop on the Freedom Trail.', answers: tiers({
      1: ['Boston Common', 'Faneuil Hall', 'Old North Church', 'Paul Revere House', 'USS Constitution', 'Bunker Hill Monument'],
      2: [{ name: 'Massachusetts State House', tier: 2, aliases: ['State House'] }, 'Old State House', 'Old South Meeting House', 'Boston Massacre Site', 'Granary Burying Ground'],
      3: ['Park Street Church', 'King’s Chapel', 'King’s Chapel Burying Ground', { name: 'Boston Latin School site', tier: 3, aliases: ['Boston Latin School', 'Benjamin Franklin statue', 'First Public School'] }, 'Old Corner Bookstore', 'Copp’s Hill Burying Ground'],
    }) },
    { id: 'boston-mbta', prompt: 'Name an MBTA rapid-transit line.', answers: tiers({
      1: [{ name: 'Red Line', tier: 1, aliases: ['Red'] }, { name: 'Orange Line', tier: 1, aliases: ['Orange'] }, { name: 'Green Line', tier: 1, aliases: ['Green'] }],
      2: [{ name: 'Blue Line', tier: 2, aliases: ['Blue'] }],
      3: [{ name: 'Silver Line', tier: 3, aliases: ['Silver'] }, { name: 'Mattapan Line', tier: 3, aliases: ['Mattapan Trolley', 'Ashmont-Mattapan'] }],
    }) },
  ],
};

/** Lowercase, no accents, letters and digits only. */
export function normalizeAnswer(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function editDistance(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length];
}

export type MatchResult =
  | { kind: 'match'; answer: DeepCutAnswer }
  | { kind: 'ambiguous'; options: DeepCutAnswer[] }
  | { kind: 'miss' };

/** Accepts full names, aliases, small typos, and unambiguous last names. */
export function matchAnswer(input: string, answers: DeepCutAnswer[]): MatchResult {
  const guess = normalizeAnswer(input);
  if (guess.length < 2) return { kind: 'miss' };
  const keys = (answer: DeepCutAnswer) => [answer.name, ...(answer.aliases ?? [])].map(normalizeAnswer);

  const exact = answers.find((answer) => keys(answer).includes(guess));
  if (exact) return { kind: 'match', answer: exact };

  const tolerance = guess.length >= 8 ? 2 : guess.length >= 5 ? 1 : 0;
  if (tolerance) {
    const close = answers.filter((answer) => keys(answer).some((key) => editDistance(key, guess) <= tolerance));
    if (close.length === 1) return { kind: 'match', answer: close[0] };
  }

  const byLast = answers.filter((answer) => {
    const words = answer.name.split(/[\s.]+/).filter(Boolean);
    return words.length > 1 && normalizeAnswer(words[words.length - 1]) === guess;
  });
  if (byLast.length === 1) return { kind: 'match', answer: byLast[0] };
  if (byLast.length > 1) return { kind: 'ambiguous', options: byLast };
  return { kind: 'miss' };
}
