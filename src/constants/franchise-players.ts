import type { TeamId } from '@/constants/fan-sections';

/**
 * Notable franchise players for Mystery Player and Jersey Check.
 * `debut` is the first season with the team, written as the year the season began
 * (1998 = the 1998–99 NBA season). `titles` counts championships won with this team.
 * `number` is the primary number worn for this team.
 * Editorial content compiled for practice — review before any scored competition.
 */
export type FranchisePlayer = {
  name: string;
  position: string;
  number: string;
  debut: number;
  titles: number;
};

export type PositionGroups = Record<string, string>;

export const positionGroups: Record<TeamId, PositionGroups> = {
  celtics: { G: 'Backcourt', F: 'Frontcourt', C: 'Frontcourt' },
  patriots: {
    QB: 'Offense', RB: 'Offense', WR: 'Offense', TE: 'Offense', OL: 'Offense',
    DL: 'Defense', LB: 'Defense', DB: 'Defense', K: 'Special teams',
  },
  bruins: { C: 'Forward', LW: 'Forward', RW: 'Forward', D: 'Defense', G: 'Goalie' },
};

export const positionNames: Record<TeamId, Record<string, string>> = {
  celtics: { G: 'Guard', F: 'Forward', C: 'Center' },
  patriots: {
    QB: 'Quarterback', RB: 'Running back', WR: 'Wide receiver', TE: 'Tight end', OL: 'Offensive line',
    DL: 'Defensive line', LB: 'Linebacker', DB: 'Defensive back', K: 'Kicker',
  },
  bruins: { C: 'Center', LW: 'Left wing', RW: 'Right wing', D: 'Defense', G: 'Goalie' },
};

export const franchisePlayers: Record<TeamId, FranchisePlayer[]> = {
  celtics: [
    { name: 'Bill Russell', position: 'C', number: '6', debut: 1956, titles: 11 },
    { name: 'Bob Cousy', position: 'G', number: '14', debut: 1950, titles: 6 },
    { name: 'Tom Heinsohn', position: 'F', number: '15', debut: 1956, titles: 8 },
    { name: 'Sam Jones', position: 'G', number: '24', debut: 1957, titles: 10 },
    { name: 'John Havlicek', position: 'F', number: '17', debut: 1962, titles: 8 },
    { name: 'Jo Jo White', position: 'G', number: '10', debut: 1969, titles: 2 },
    { name: 'Dave Cowens', position: 'C', number: '18', debut: 1970, titles: 2 },
    { name: 'Larry Bird', position: 'F', number: '33', debut: 1979, titles: 3 },
    { name: 'Kevin McHale', position: 'F', number: '32', debut: 1980, titles: 3 },
    { name: 'Robert Parish', position: 'C', number: '00', debut: 1980, titles: 3 },
    { name: 'Dennis Johnson', position: 'G', number: '3', debut: 1983, titles: 2 },
    { name: 'Antoine Walker', position: 'F', number: '8', debut: 1996, titles: 0 },
    { name: 'Paul Pierce', position: 'F', number: '34', debut: 1998, titles: 1 },
    { name: 'Kendrick Perkins', position: 'C', number: '43', debut: 2003, titles: 1 },
    { name: 'Rajon Rondo', position: 'G', number: '9', debut: 2006, titles: 1 },
    { name: 'Kevin Garnett', position: 'F', number: '5', debut: 2007, titles: 1 },
    { name: 'Ray Allen', position: 'G', number: '20', debut: 2007, titles: 1 },
    { name: 'Isaiah Thomas', position: 'G', number: '4', debut: 2014, titles: 0 },
    { name: 'Marcus Smart', position: 'G', number: '36', debut: 2014, titles: 0 },
    { name: 'Al Horford', position: 'C', number: '42', debut: 2016, titles: 1 },
    { name: 'Jaylen Brown', position: 'G', number: '7', debut: 2016, titles: 1 },
    { name: 'Jayson Tatum', position: 'F', number: '0', debut: 2017, titles: 1 },
    { name: 'Derrick White', position: 'G', number: '9', debut: 2021, titles: 1 },
    { name: 'Jrue Holiday', position: 'G', number: '4', debut: 2023, titles: 1 },
    { name: 'Kristaps Porziņģis', position: 'C', number: '8', debut: 2023, titles: 1 },
  ],
  patriots: [
    { name: 'John Hannah', position: 'OL', number: '73', debut: 1973, titles: 0 },
    { name: 'Andre Tippett', position: 'LB', number: '56', debut: 1982, titles: 0 },
    { name: 'Drew Bledsoe', position: 'QB', number: '11', debut: 1993, titles: 1 },
    { name: 'Troy Brown', position: 'WR', number: '80', debut: 1993, titles: 3 },
    { name: 'Willie McGinest', position: 'LB', number: '55', debut: 1994, titles: 3 },
    { name: 'Ty Law', position: 'DB', number: '24', debut: 1995, titles: 3 },
    { name: 'Tedy Bruschi', position: 'LB', number: '54', debut: 1996, titles: 3 },
    { name: 'Adam Vinatieri', position: 'K', number: '4', debut: 1996, titles: 3 },
    { name: 'Kevin Faulk', position: 'RB', number: '33', debut: 1999, titles: 3 },
    { name: 'Tom Brady', position: 'QB', number: '12', debut: 2000, titles: 6 },
    { name: 'Richard Seymour', position: 'DL', number: '93', debut: 2001, titles: 3 },
    { name: 'Vince Wilfork', position: 'DL', number: '75', debut: 2004, titles: 2 },
    { name: 'Corey Dillon', position: 'RB', number: '28', debut: 2004, titles: 1 },
    { name: 'Logan Mankins', position: 'OL', number: '70', debut: 2005, titles: 0 },
    { name: 'Stephen Gostkowski', position: 'K', number: '3', debut: 2006, titles: 3 },
    { name: 'Randy Moss', position: 'WR', number: '81', debut: 2007, titles: 0 },
    { name: 'Wes Welker', position: 'WR', number: '83', debut: 2007, titles: 0 },
    { name: 'Matthew Slater', position: 'WR', number: '18', debut: 2008, titles: 3 },
    { name: 'Julian Edelman', position: 'WR', number: '11', debut: 2009, titles: 3 },
    { name: 'Rob Gronkowski', position: 'TE', number: '87', debut: 2010, titles: 3 },
    { name: 'Devin McCourty', position: 'DB', number: '32', debut: 2010, titles: 3 },
    { name: 'Dont’a Hightower', position: 'LB', number: '54', debut: 2012, titles: 3 },
    { name: 'James White', position: 'RB', number: '28', debut: 2014, titles: 3 },
    { name: 'Malcolm Butler', position: 'DB', number: '21', debut: 2014, titles: 2 },
    { name: 'Mac Jones', position: 'QB', number: '10', debut: 2021, titles: 0 },
    { name: 'Drake Maye', position: 'QB', number: '10', debut: 2024, titles: 0 },
  ],
  bruins: [
    { name: 'Eddie Shore', position: 'D', number: '2', debut: 1926, titles: 2 },
    { name: 'Milt Schmidt', position: 'C', number: '15', debut: 1936, titles: 2 },
    { name: 'Johnny Bucyk', position: 'LW', number: '9', debut: 1957, titles: 2 },
    { name: 'Gerry Cheevers', position: 'G', number: '30', debut: 1965, titles: 2 },
    { name: 'Bobby Orr', position: 'D', number: '4', debut: 1966, titles: 2 },
    { name: 'Phil Esposito', position: 'C', number: '7', debut: 1967, titles: 2 },
    { name: 'Ken Hodge', position: 'RW', number: '8', debut: 1967, titles: 2 },
    { name: 'Brad Park', position: 'D', number: '22', debut: 1975, titles: 0 },
    { name: 'Rick Middleton', position: 'RW', number: '16', debut: 1976, titles: 0 },
    { name: 'Ray Bourque', position: 'D', number: '77', debut: 1979, titles: 0 },
    { name: 'Cam Neely', position: 'RW', number: '8', debut: 1986, titles: 0 },
    { name: 'Adam Oates', position: 'C', number: '12', debut: 1991, titles: 0 },
    { name: 'Tim Thomas', position: 'G', number: '30', debut: 2002, titles: 1 },
    { name: 'Patrice Bergeron', position: 'C', number: '37', debut: 2003, titles: 1 },
    { name: 'Zdeno Chára', position: 'D', number: '33', debut: 2006, titles: 1 },
    { name: 'David Krejčí', position: 'C', number: '46', debut: 2006, titles: 1 },
    { name: 'Milan Lucic', position: 'LW', number: '17', debut: 2007, titles: 1 },
    { name: 'Tuukka Rask', position: 'G', number: '40', debut: 2007, titles: 1 },
    { name: 'Brad Marchand', position: 'LW', number: '63', debut: 2009, titles: 1 },
    { name: 'Torey Krug', position: 'D', number: '47', debut: 2011, titles: 0 },
    { name: 'David Pastrňák', position: 'RW', number: '88', debut: 2014, titles: 0 },
    { name: 'Charlie McAvoy', position: 'D', number: '73', debut: 2016, titles: 0 },
    { name: 'Jeremy Swayman', position: 'G', number: '1', debut: 2020, titles: 0 },
    { name: 'Hampus Lindholm', position: 'D', number: '27', debut: 2021, titles: 0 },
  ],
};

/** "1998" for NFL; "1998–99" for NBA/NHL seasons that span two years. */
export function seasonLabel(team: TeamId, year: number) {
  if (team === 'patriots') return String(year);
  return `${year}–${String((year + 1) % 100).padStart(2, '0')}`;
}
