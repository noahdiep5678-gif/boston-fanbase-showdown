export const fanSections = [
  { id: 'celtics', name: 'Celtics', color: '#087443', ink: '#FFFFFF', gameBackground: '#073B29', surface: '#10513A' },
  { id: 'patriots', name: 'Patriots', color: '#153D80', ink: '#FFFFFF', gameBackground: '#102B57', surface: '#1D4075' },
  { id: 'bruins', name: 'Bruins', color: '#FFCA38', ink: '#201900', gameBackground: '#382900', surface: '#554000' },
  { id: 'boston', name: 'Boston', color: '#713E42', ink: '#FFFFFF', gameBackground: '#47282D', surface: '#60373D' },
] as const;

export type FanSection = (typeof fanSections)[number];
export type FanSectionId = FanSection['id'];

export function getFanSection(value: unknown): FanSection | undefined {
  return fanSections.find((section) => section.id === value);
}
