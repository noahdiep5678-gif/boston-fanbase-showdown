export type TriviaQuestion = {
  prompt: string;
  options: [string, string, string];
  correct: 0 | 1 | 2;
  fact: string;
};

// Editorial practice content. Review before promoting any of it to scored play.
export const bostonTrivia: TriviaQuestion[] = [
  { prompt: 'Which river separates Boston and Cambridge?', options: ['Mystic River', 'Charles River', 'Neponset River'], correct: 1,
    fact: 'The Charles winds about 80 miles from Hopkinton before reaching Boston Harbor.' },
  { prompt: 'Which trail links historic sites along a red line through Boston?', options: ['Freedom Trail', 'Harborwalk', 'Emerald Necklace'], correct: 0,
    fact: 'The Freedom Trail runs about 2.5 miles and connects 16 historic sites.' },
  { prompt: 'Which neighborhood is home to the Old North Church?', options: ['Back Bay', 'Beacon Hill', 'North End'], correct: 2,
    fact: '“One if by land, two if by sea” — two lanterns hung in its steeple on April 18, 1775.' },
  { prompt: 'In what year did the Boston Tea Party take place?', options: ['1765', '1773', '1776'], correct: 1,
    fact: 'On December 16, 1773, colonists dumped 342 chests of tea into Boston Harbor.' },
  { prompt: 'What is considered the oldest public park in the United States?', options: ['Boston Common', 'Public Garden', 'Franklin Park'], correct: 0,
    fact: 'Boston Common dates to 1634 and was once used to graze cattle.' },
  { prompt: 'In what year did Fenway Park open?', options: ['1903', '1912', '1923'], correct: 1,
    fact: 'Fenway opened in April 1912 — just days after the Titanic sank.' },
  { prompt: 'What is Fenway Park’s famous left-field wall called?', options: ['Pesky’s Pole', 'The Green Monster', 'The Triangle'], correct: 1,
    fact: 'The Green Monster stands about 37 feet tall. Pesky’s Pole is the right-field foul pole.' },
  { prompt: 'Boston opened America’s first subway tunnel in which year?', options: ['1888', '1897', '1904'], correct: 1,
    fact: 'The Tremont Street Subway opened in 1897 and is still in use by the Green Line.' },
  { prompt: 'Which neighborhood is known for gas lamps and cobblestoned Acorn Street?', options: ['Beacon Hill', 'South End', 'Charlestown'], correct: 0,
    fact: 'Acorn Street is often called one of the most photographed streets in America.' },
  { prompt: 'Where are the “Make Way for Ducklings” statues?', options: ['Boston Common', 'Public Garden', 'Christopher Columbus Park'], correct: 1,
    fact: 'The statues honor Robert McCloskey’s 1941 children’s book.' },
  { prompt: 'The Boston Marathon is held on which holiday?', options: ['Memorial Day', 'Patriots’ Day', 'Evacuation Day'], correct: 1,
    fact: 'Patriots’ Day falls on the third Monday in April.' },
  { prompt: 'In which town does the Boston Marathon start?', options: ['Framingham', 'Hopkinton', 'Natick'], correct: 1,
    fact: 'Runners go 26.2 miles from Hopkinton to Boylston Street.' },
  { prompt: 'Which university was founded in Cambridge in 1636?', options: ['Harvard', 'MIT', 'Tufts'], correct: 0,
    fact: 'Harvard is the oldest institution of higher learning in the United States.' },
  { prompt: 'What is the USS Constitution’s nickname?', options: ['Old Glory', 'Old Ironsides', 'The Iron Lady'], correct: 1,
    fact: 'Launched in 1797, she is the oldest commissioned warship still afloat.' },
  { prompt: 'The Big Dig moved which highway underground through downtown?', options: ['I-90', 'I-93', 'Route 1'], correct: 1,
    fact: 'The elevated Central Artery came down after I-93 moved into tunnels.' },
  { prompt: 'What covers the dome of the Massachusetts State House?', options: ['Copper', 'Gold leaf', 'Bronze'], correct: 1,
    fact: 'Paul Revere’s company first sheathed it in copper. It was later covered in gold leaf.' },
  { prompt: 'In what year did the Great Molasses Flood hit the North End?', options: ['1899', '1919', '1938'], correct: 1,
    fact: 'A wave of molasses swept through the neighborhood in January 1919.' },
  { prompt: 'Which MBTA line ends at Alewife?', options: ['Red Line', 'Orange Line', 'Green Line'], correct: 0,
    fact: 'Alewife in Cambridge is the Red Line’s northern terminus.' },
  { prompt: 'Which landmark is nicknamed the “Cradle of Liberty”?', options: ['Old State House', 'Faneuil Hall', 'Old South Meeting House'], correct: 1,
    fact: 'Faneuil Hall hosted speeches by Samuel Adams and other revolutionaries.' },
  { prompt: 'Boston’s nickname “Beantown” comes from what?', options: ['Coffee roasters', 'Baked beans', 'Green bean farms'], correct: 1,
    fact: 'Colonial Boston was known for beans slow-baked in molasses.' },
  { prompt: 'Which arena sits on top of North Station?', options: ['TD Garden', 'Agganis Arena', 'Matthews Arena'], correct: 0,
    fact: 'TD Garden is home to both the Celtics and the Bruins.' },
  { prompt: 'The Citgo sign towers over which square?', options: ['Copley Square', 'Kenmore Square', 'Central Square'], correct: 1,
    fact: 'The sign is visible over the Green Monster during Red Sox games.' },
  { prompt: 'Which square is home to the Boston Public Library’s central branch?', options: ['Copley Square', 'Post Office Square', 'Dewey Square'], correct: 0,
    fact: 'Founded in 1848, it was the first large free municipal library in the U.S.' },
  { prompt: 'Who designed Boston’s Emerald Necklace park system?', options: ['Frederick Law Olmsted', 'Charles Bulfinch', 'H. H. Richardson'], correct: 0,
    fact: 'Olmsted also co-designed New York’s Central Park.' },
  { prompt: 'Boston cream pie was created at which hotel?', options: ['The Parker House', 'The Copley Plaza', 'The Ritz-Carlton'], correct: 0,
    fact: 'It is also the official state dessert of Massachusetts.' },
  { prompt: 'In what year did the Boston Massacre happen?', options: ['1770', '1775', '1781'], correct: 0,
    fact: 'It happened outside the Old State House in March 1770.' },
  { prompt: 'Which bridge has “salt-and-pepper shaker” towers?', options: ['Longfellow Bridge', 'Harvard Bridge', 'BU Bridge'], correct: 0,
    fact: 'The Longfellow carries the Red Line between Boston and Cambridge.' },
  { prompt: 'The Zakim Bridge’s full name also honors which battle?', options: ['Lexington', 'Bunker Hill', 'Dorchester Heights'], correct: 1,
    fact: 'Its full name is the Leonard P. Zakim Bunker Hill Memorial Bridge.' },
];

export type BostonLocation = {
  name: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  latitude: number;
  longitude: number;
  hint: string;
};

// Practice targets. Coordinates are approximate and should be reviewed before scored play.
export const bostonLocations: BostonLocation[] = [
  { name: 'Fenway Park', difficulty: 'Easy', latitude: 42.3467, longitude: -71.0972, hint: 'America’s oldest active ballpark, opened in 1912.' },
  { name: 'TD Garden', difficulty: 'Easy', latitude: 42.3662, longitude: -71.0621, hint: 'Built on top of North Station.' },
  { name: 'Boston Marathon finish line', difficulty: 'Easy', latitude: 42.3498, longitude: -71.0788, hint: 'Painted on Boylston Street by the Boston Public Library.' },
  { name: 'Massachusetts State House', difficulty: 'Easy', latitude: 42.3577, longitude: -71.0636, hint: 'Its gold dome overlooks Boston Common.' },
  { name: 'Faneuil Hall', difficulty: 'Easy', latitude: 42.3600, longitude: -71.0568, hint: 'The Cradle of Liberty, beside Quincy Market.' },
  { name: 'Old North Church', difficulty: 'Medium', latitude: 42.3663, longitude: -71.0544, hint: 'Its steeple held the North End’s two lanterns.' },
  { name: 'Bunker Hill Monument', difficulty: 'Medium', latitude: 42.3763, longitude: -71.0607, hint: 'A 221-foot granite obelisk in Charlestown.' },
  { name: 'USS Constitution', difficulty: 'Medium', latitude: 42.3725, longitude: -71.0566, hint: 'Docked at the Charlestown Navy Yard.' },
  { name: 'New England Aquarium', difficulty: 'Medium', latitude: 42.3591, longitude: -71.0498, hint: 'On Central Wharf along the waterfront.' },
  { name: 'Make Way for Ducklings statues', difficulty: 'Medium', latitude: 42.3555, longitude: -71.0698, hint: 'In the Public Garden near Charles Street.' },
  { name: 'Isabella Stewart Gardner Museum', difficulty: 'Medium', latitude: 42.3382, longitude: -71.0990, hint: 'In the Fenway, home of an unsolved 1990 art heist.' },
  { name: 'MIT Great Dome', difficulty: 'Medium', latitude: 42.3597, longitude: -71.0921, hint: 'Across the Charles from Back Bay, in Cambridge.' },
  { name: 'Harvard Yard', difficulty: 'Hard', latitude: 42.3745, longitude: -71.1170, hint: 'The historic heart of Harvard in Cambridge.' },
  { name: 'Fort Independence', difficulty: 'Hard', latitude: 42.3384, longitude: -71.0105, hint: 'A granite fort on Castle Island in South Boston.' },
  { name: 'JFK Presidential Library', difficulty: 'Hard', latitude: 42.3163, longitude: -71.0343, hint: 'On Columbia Point in Dorchester, next to UMass Boston.' },
  { name: 'Arnold Arboretum', difficulty: 'Hard', latitude: 42.3076, longitude: -71.1199, hint: 'Harvard’s 281-acre tree museum in Jamaica Plain.' },
  { name: 'Franklin Park Zoo', difficulty: 'Hard', latitude: 42.3025, longitude: -71.0862, hint: 'Inside Olmsted’s largest Boston park.' },
];

/** Fisher–Yates shuffle returning a new array. */
export function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
