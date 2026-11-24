export const fanSections = [
  { id: 'bruins', name: 'Bruins', sport: 'Hockey', color: '#FFD166', description: 'Goals, assists, and Black-and-Gold knowledge.' },
  { id: 'celtics', name: 'Celtics', sport: 'Basketball', color: '#74D5A1', description: 'Championship rosters, stat lines, and Celtics history.' },
  { id: 'red-sox', name: 'Red Sox', sport: 'Baseball', color: '#FF8B95', description: 'Runs, records, and generations of Sox history.' },
  { id: 'patriots', name: 'Patriots', sport: 'Football', color: '#92B6FF', description: 'Spreads, memorable seasons, and Patriots knowledge.' },
  { id: 'boston', name: 'Boston', sport: 'City challenges', color: '#8CDED7', description: 'Neighborhoods, landmarks, and life around Boston.' },
] as const;

export type FanSection = (typeof fanSections)[number];
export type FanSectionId = FanSection['id'];

export function getFanSection(value: unknown): FanSection | undefined {
  return fanSections.find((section) => section.id === value);
}
