export const fanSections = [
  {
    id: 'celtics', name: 'Celtics', color: '#087443', ink: '#FFFFFF',
    gameBackground: '#073B29', gameBackgroundDeep: '#03211A', surface: '#10513A', accent: '#7FE3AC',
    tagline: 'Banner 18 country',
  },
  {
    id: 'patriots', name: 'Patriots', color: '#153D80', ink: '#FFFFFF',
    gameBackground: '#102B57', gameBackgroundDeep: '#08162F', surface: '#1D4075', accent: '#FF6B7D',
    tagline: 'Foxborough faithful',
  },
  {
    id: 'bruins', name: 'Bruins', color: '#FFCA38', ink: '#201900',
    gameBackground: '#382900', gameBackgroundDeep: '#1A1300', surface: '#554000', accent: '#FFCA38',
    tagline: 'Black and gold forever',
  },
  {
    id: 'boston', name: 'Boston', color: '#713E42', ink: '#FFFFFF',
    gameBackground: '#47282D', gameBackgroundDeep: '#24131A', surface: '#60373D', accent: '#FFB59E',
    tagline: 'Wicked good city',
  },
] as const;

export type FanSection = (typeof fanSections)[number];
export type FanSectionId = FanSection['id'];
export type TeamId = Exclude<FanSectionId, 'boston'>;

export function getFanSection(value: unknown): FanSection | undefined {
  return fanSections.find((section) => section.id === value);
}

export const teamLogos = {
  celtics: require('../../assets/images/teams/celtics.png'),
  patriots: require('../../assets/images/teams/patriots.png'),
  bruins: require('../../assets/images/teams/bruins.png'),
} as const;

/** Bright gradients for the team pages on the home screen. */
export const pageGradients: Record<FanSectionId, readonly [string, string]> = {
  celtics: ['#0A8A50', '#055A33'],
  patriots: ['#1B4C9C', '#0C2654'],
  bruins: ['#FFD253', '#F2AE12'],
  boston: ['#83494E', '#4E2A30'],
};
