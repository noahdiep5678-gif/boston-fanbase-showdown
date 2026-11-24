import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { getFanSection, type FanSection, type TeamId } from '@/constants/fan-sections';
import { franchisePlayers, positionGroups, positionNames, seasonLabel, type FranchisePlayer } from '@/constants/franchise-players';
import { shareText } from '@/lib/share';
import { seededRandom, usePersistentState } from '@/lib/daily';
import { bostonDate, formatCountdown, msUntilBostonMidnight } from '@/lib/dates';
import { recordResult } from '@/lib/stats';
import { Button, Card, FadeIn, PressableScale, Row, Screen, Stat, Tag, useRevealOnFocus } from '@/ui/components';
import { haptic } from '@/ui/haptics';
import { palette, radius, space, type } from '@/ui/tokens';

const MAX_GUESSES = 6;

type Mark = 'hit' | 'near' | 'miss';

/** Lowercase, accent-free, letters and digits only: "Pastrňák" → "pastrnak". */
function fold(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

type Clue = { label: string; value: string; mark: Mark; arrow?: '↑' | '↓' };

function compare(team: TeamId, guess: FranchisePlayer, answer: FranchisePlayer): Clue[] {
  const groups = positionGroups[team];
  const numeric = (n: string) => Number(n);
  const arrow = (g: number, a: number) => (a > g ? '↑' : a < g ? '↓' : undefined);
  const gNum = numeric(guess.number);
  const aNum = numeric(answer.number);
  return [
    {
      label: 'Pos', value: guess.position,
      mark: guess.position === answer.position ? 'hit' : groups[guess.position] === groups[answer.position] ? 'near' : 'miss',
    },
    {
      label: 'No.', value: `#${guess.number}`,
      mark: guess.number === answer.number ? 'hit' : Math.abs(gNum - aNum) <= 5 ? 'near' : 'miss',
      arrow: guess.number === answer.number ? undefined : arrow(gNum, aNum) ?? (guess.number.length < answer.number.length ? '↑' : '↓'),
    },
    {
      label: 'Debut', value: `’${String(guess.debut).slice(2)}`,
      mark: guess.debut === answer.debut ? 'hit' : Math.abs(guess.debut - answer.debut) <= 4 ? 'near' : 'miss',
      arrow: arrow(guess.debut, answer.debut),
    },
    {
      label: 'Titles', value: String(guess.titles),
      mark: guess.titles === answer.titles ? 'hit' : Math.abs(guess.titles - answer.titles) <= 1 ? 'near' : 'miss',
      arrow: arrow(guess.titles, answer.titles),
    },
  ];
}

export default function MysteryPlayerRoute() {
  const { sport, mode } = useLocalSearchParams<{ sport?: string; mode?: string }>();
  const [round, setRound] = useState(0);
  const section = getFanSection(sport);
  if (!section || section.id === 'boston') return <Redirect href="/" />;
  const practice = mode === 'practice';
  return (
    <MysteryPlayer key={`${section.id}:${practice ? `practice:${round}` : 'daily'}`} section={section} team={section.id}
      practice={practice} onNewRound={() => setRound((value) => value + 1)} />
  );
}

function MysteryPlayer({ section, team, practice, onNewRound }: { section: FanSection; team: TeamId; practice: boolean; onNewRound: () => void }) {
  const date = bostonDate();
  const players = franchisePlayers[team];
  const [seed] = useState(() => practice ? `${Math.random()}` : `mystery:${team}:${date}`);
  const answer = useMemo(() => players[Math.floor(seededRandom(seed)() * players.length)], [players, seed]);
  const [guesses, setGuesses] = usePersistentState<string[]>(practice ? null : `daily:mystery:${team}:${date}`, []);
  const [query, setQuery] = useState('');
  const [shareError, setShareError] = useState('');
  const [ms, setMs] = useState(msUntilBostonMidnight);
  const [searchRef, revealSearch] = useRevealOnFocus();

  const guessed = guesses.map((name) => players.find((p) => p.name === name)).filter((p): p is FranchisePlayer => !!p);
  const solved = guessed.some((p) => p.name === answer.name);
  const finished = solved || guessed.length >= MAX_GUESSES;
  const score = solved ? (MAX_GUESSES - guessed.length + 1) * 100 : 0;

  const suggestions = useMemo(() => {
    const q = fold(query);
    if (!q) return [];
    return players.filter((p) => !guesses.includes(p.name) && p.name.split(/[\s.-]+/).some((w) => fold(w).startsWith(q))).slice(0, 5);
  }, [guesses, players, query]);

  useEffect(() => {
    if (!finished) return;
    recordResult({
      id: practice ? `mystery:${team}:practice:${seed}` : `mystery:${team}:${date}`,
      game: 'mystery-player', section: team, score, max: MAX_GUESSES * 100, practice,
      summary: solved ? `Solved in ${guessed.length}` : 'Not solved',
    });
    if (practice) return;
    const timer = setInterval(() => setMs(msUntilBostonMidnight()), 1000);
    return () => clearInterval(timer);
  }, [date, finished, guessed.length, practice, score, seed, solved, team]);

  function guess(player: FranchisePlayer) {
    if (finished || guesses.includes(player.name)) return;
    if (player.name === answer.name) haptic.success(); else haptic.tap();
    setGuesses([...guesses, player.name]);
    setQuery('');
    revealSearch();
  }

  const grid = guessed.map((p) => compare(team, p, answer).map((c) => c.mark === 'hit' ? '🟩' : c.mark === 'near' ? '🟨' : '⬛').join('')).join('\n');

  async function share() {
    try {
      setShareError('');
      await shareText(`Stadium Pulse · Mystery ${section.name}${practice ? ' (practice)' : ` · ${date}`}\n${solved ? `${guessed.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`}\n${grid}`);
    } catch {
      setShareError('Sharing could not open.');
    }
  }

  return (
    <Screen
      section={section}
      back={{ pathname: '/fan-challenges', params: { sport: team } }}
      backLabel={`${section.name} challenges`}
      eyebrow={practice ? `${section.name} · Practice` : `${section.name} · Daily · ${date}`}
      title={`Mystery ${section.name}`}
      right={<Tag label={`${guessed.length}/${MAX_GUESSES}`} tone="accent" />}
    >
      <Card>
        <Text style={type.heading}>Guess the {section.name} legend.</Text>
        <Text style={type.small}>
          Each guess compares position, jersey number, debut season, and titles with the team.
          Green is exact. Yellow is close. Arrows point toward the answer.
        </Text>
      </Card>

      {guessed.length > 0 && (
        <View style={styles.board}>
          {guessed.map((player, index) => (
            <FadeIn key={player.name} delay={0} style={styles.guessRow}>
              <Text style={[type.body, styles.guessName, player.name === answer.name && { color: palette.success }]} numberOfLines={1}>
                {index + 1}. {player.name}
              </Text>
              <View style={styles.clues}>
                {compare(team, player, answer).map((clue) => (
                  <View key={clue.label} style={[styles.clue,
                    clue.mark === 'hit' && styles.hit, clue.mark === 'near' && styles.near]}
                    accessible accessibilityLabel={`${clue.label} ${clue.value}, ${clue.mark === 'hit' ? 'match' : clue.mark === 'near' ? 'close' : 'no match'}${clue.arrow ? clue.arrow === '↑' ? ', answer is higher' : ', answer is lower' : ''}`}>
                    <Text style={[styles.clueLabel, clue.mark !== 'miss' && styles.clueLabelOn]}>{clue.label}</Text>
                    <Text style={[styles.clueValue, clue.mark !== 'miss' && { color: palette.dark }]}>
                      {clue.value}{clue.arrow ? ` ${clue.arrow}` : ''}
                    </Text>
                  </View>
                ))}
              </View>
            </FadeIn>
          ))}
        </View>
      )}

      {!finished ? (
        <View ref={searchRef} collapsable={false} style={styles.stack}>
          <TextInput
            onFocus={revealSearch}
            accessibilityLabel={`Search ${section.name} players`}
            placeholder={`Guess ${guessed.length + 1} of ${MAX_GUESSES} — type a name…`}
            placeholderTextColor={palette.textFaint}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="words"
            keyboardAppearance="dark"
            returnKeyType="search"
            onSubmitEditing={() => suggestions.length === 1 && guess(suggestions[0])}
            style={[styles.input, { borderColor: query ? section.accent : palette.border }]}
          />
          {suggestions.length > 0 && (
            <View style={styles.suggestions}>
              {suggestions.map((player) => (
                <PressableScale key={player.name} feedback={null} onPress={() => guess(player)}
                  accessibilityRole="button" accessibilityLabel={`Guess ${player.name}`} style={styles.suggestion}>
                  <Text style={styles.suggestionText}>{player.name}</Text>
                  <Text style={type.small}>Guess</Text>
                </PressableScale>
              ))}
            </View>
          )}
          {!!query && suggestions.length === 0 && (
            <Text style={type.small}>No match in the {section.name} player pool ({players.length} legends and stars).</Text>
          )}
        </View>
      ) : (
        <FadeIn style={styles.stack}>
          <Card tone={solved ? 'success' : 'danger'} style={styles.center}>
            <Text style={type.eyebrow}>{solved ? `Got it in ${guessed.length}` : 'The answer was'}</Text>
            <Text style={type.display}>{answer.name}</Text>
            <Text style={type.muted}>
              {positionNames[team][answer.position]} · #{answer.number} · debuted {seasonLabel(team, answer.debut)} · {answer.titles} {answer.titles === 1 ? 'title' : 'titles'}
            </Text>
          </Card>
          <Row>
            <Stat value={score} label="Points" color={section.accent} />
            {!practice && <Stat value={formatCountdown(ms)} label="Next player" />}
          </Row>
          <Button label="Share result" icon="↗" onPress={share} />
          {practice
            ? <Button label="New mystery player" variant="secondary" onPress={onNewRound} />
            : <Button label="Play a practice round" variant="secondary" onPress={() => router.push({ pathname: '/mystery-player', params: { sport: team, mode: 'practice' } })} />}
          {!!shareError && <Text style={type.small}>{shareError}</Text>}
        </FadeIn>
      )}
      <Text style={type.small}>
        {practice ? 'Practice round — doesn’t count toward your stats.' : 'One mystery player per team, every day. Resets at midnight Boston time.'}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  center: { alignItems: 'center', paddingVertical: space.xl, gap: space.xs },
  board: { gap: space.md },
  guessRow: { gap: 6 },
  guessName: { fontWeight: '700' },
  clues: { flexDirection: 'row', gap: 6 },
  clue: {
    flex: 1, minHeight: 54, borderRadius: radius.sm, backgroundColor: palette.overlayStrong,
    alignItems: 'center', justifyContent: 'center', paddingVertical: 6,
  },
  hit: { backgroundColor: palette.success },
  near: { backgroundColor: palette.gold },
  clueLabel: { color: palette.textFaint, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  clueLabelOn: { color: 'rgba(11,13,18,0.6)' },
  clueValue: { color: palette.text, fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  input: {
    color: palette.text, backgroundColor: palette.overlay, borderWidth: 1.5,
    borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: 15, fontSize: 17,
  },
  suggestions: { borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: palette.border, backgroundColor: palette.overlay },
  suggestion: {
    minHeight: 50, paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border,
  },
  suggestionText: { color: palette.text, fontSize: 16, fontWeight: '600' },
});
