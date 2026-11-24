import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useReducer, useState } from 'react';
import { Keyboard, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { getFanSection, type FanSection } from '@/constants/fan-sections';
import { celtics2024Answers, puzzles } from '@/constants/wicked-smaht-puzzles';
import { shareText } from '@/lib/share';
import { bostonDate, formatCountdown, msUntilBostonMidnight } from '@/lib/dates';
import { recordResult } from '@/lib/stats';
import { supabase } from '@/lib/supabase';
import { Button, Card, FadeIn, PressableScale, Row, Screen, Stat, Tag, useRevealOnFocus } from '@/ui/components';
import { haptic } from '@/ui/haptics';
import { palette, radius, space, type } from '@/ui/tokens';

const GOAL = 10;
const MAX_MISTAKES = 5;
const SUGGESTIONS = 5;

type Puzzle = NonNullable<(typeof puzzles)[string]>;

function normalize(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
}

/* --------------------------------------------------------------- game state */

type GameState = {
  found: string[];
  wrong: string[];
  /** Guess outcomes in the order they were made, for the share grid. */
  order: ('hit' | 'miss')[];
  finished: boolean;
  message: string;
  last?: 'hit' | 'miss' | 'repeat';
};
type GameAction = { type: 'guess'; player: string } | { type: 'finish' };
const initialState: GameState = { found: [], wrong: [], order: [], finished: false, message: '' };

function gameReducer(state: GameState, action: GameAction, puzzle: Puzzle): GameState {
  if (state.finished) return state;
  if (action.type === 'finish') {
    return { ...state, finished: true, message: 'Challenge finished. Answers revealed below.', last: undefined };
  }
  const player = puzzle.players.find((name) => normalize(name) === normalize(action.player));
  if (!player) return state;
  if ([...state.found, ...state.wrong].some((name) => normalize(name) === normalize(player))) {
    return { ...state, message: 'Already tried. No attempt lost.', last: 'repeat' };
  }
  if (puzzle.answers.some((answer) => normalize(answer) === normalize(player))) {
    const found = [...state.found, player];
    return {
      ...state, found, order: [...state.order, 'hit'], last: 'hit',
      finished: found.length === GOAL,
      message: found.length === GOAL ? 'Wicked Smaht! All 10 found.' : `Correct — ${player}!`,
    };
  }
  const wrong = [...state.wrong, player];
  return {
    ...state, wrong, order: [...state.order, 'miss'], last: 'miss',
    finished: wrong.length === MAX_MISTAKES,
    message: wrong.length === MAX_MISTAKES ? 'Five wrong answers. Challenge over.' : `${player} wasn’t on the ${puzzle.roster}.`,
  };
}

function restoreResult(storageKey: string | undefined, puzzle: Puzzle): GameState {
  if (!storageKey) return initialState;
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return initialState;
    const guesses: unknown = JSON.parse(saved);
    if (!Array.isArray(guesses) || guesses.length > GOAL + MAX_MISTAKES) return initialState;
    let game = initialState;
    for (const player of guesses) {
      if (typeof player !== 'string') return initialState;
      game = gameReducer(game, { type: 'guess', player }, puzzle);
    }
    return { ...game, finished: true, message: 'You completed today’s puzzle.', last: undefined };
  } catch {
    return initialState;
  }
}

/* ------------------------------------------------------------ daily loading */

function celtics2024Puzzle(original: Puzzle): Puzzle {
  const players = new Map(original.players.map((name) => [normalize(name), name]));
  for (const name of celtics2024Answers) players.set(normalize(name), name);
  return {
    ...original,
    year: '2024',
    roster: '2024 Celtics championship roster',
    prompt: 'Name 10 players from the 2024 Celtics championship roster.',
    answers: celtics2024Answers,
    players: Array.from(players.values()).sort((a, b) => a.localeCompare(b)),
    answerSource: 'https://en.wikipedia.org/wiki/2023%E2%80%9324_Boston_Celtics_season',
  };
}

function puzzleFromRow(row: { prompt: string; roster_data: unknown }, original: Puzzle): Puzzle | undefined {
  if (row.roster_data == null) {
    if (row.prompt === original.prompt) return original;
    if (original.name === 'Celtics') {
      const alternate = celtics2024Puzzle(original);
      if (row.prompt === alternate.prompt) return alternate;
    }
    return undefined;
  }
  if (typeof row.roster_data !== 'object') return undefined;
  const data = row.roster_data as Record<string, unknown>;
  if (typeof data.year !== 'string' || !/^\d{4}$/.test(data.year)
      || typeof data.roster !== 'string' || !data.roster.trim()
      || typeof data.answerSource !== 'string' || !data.answerSource.startsWith('https://')
      || !row.prompt.trim() || !Array.isArray(data.answers)) return undefined;

  const answers: string[] = [];
  const answerIds = new Set<string>();
  for (const name of data.answers) {
    if (typeof name !== 'string') return undefined;
    const id = normalize(name);
    if (!id || answerIds.has(id)) return undefined;
    answerIds.add(id);
    answers.push(name.trim());
  }
  if (answers.length < GOAL) return undefined;
  const players = new Map(original.players.map((name) => [normalize(name), name]));
  for (const name of answers) players.set(normalize(name), name);
  return {
    ...original,
    prompt: row.prompt,
    year: data.year,
    roster: data.roster,
    answerSource: data.answerSource,
    answers,
    players: Array.from(players.values()).sort((a, b) => a.localeCompare(b)),
  };
}

type DailyLoad =
  | { status: 'loading' }
  | { status: 'ready'; date: string; puzzle: Puzzle }
  | { status: 'unavailable'; message: string; canRetry: boolean };

export default function WickedSmahtScreen() {
  const { sport } = useLocalSearchParams<{ sport?: string }>();
  const id = sport ?? 'celtics';
  const puzzle = typeof id === 'string' && Object.prototype.hasOwnProperty.call(puzzles, id) ? puzzles[id] : undefined;
  const section = getFanSection(id);
  if (!puzzle || !section) return <Redirect href="/" />;
  return <DailyTeamPuzzle key={id} section={section} puzzle={puzzle} />;
}

function DailyTeamPuzzle({ section, puzzle }: { section: FanSection; puzzle: Puzzle }) {
  const date = bostonDate();
  const [load, setLoad] = useState<DailyLoad>({ status: 'loading' });
  const [retry, setRetry] = useState(0);
  const [practice, setPractice] = useState(false);

  useEffect(() => {
    let active = true;
    async function fetchPuzzle() {
      try {
        const { data, error } = await supabase
          .from('daily_puzzles')
          .select('prompt, roster_data')
          .eq('team', section.id)
          .eq('puzzle_date', date)
          .maybeSingle();
        if (!active) return;
        if (error) {
          console.warn('Daily team puzzle:', error.message);
          setLoad({ status: 'unavailable', message: 'Couldn’t reach today’s puzzle.', canRetry: true });
        } else if (!data) {
          setLoad({ status: 'unavailable', message: `No ${puzzle.name} daily puzzle is scheduled for today.`, canRetry: false });
        } else {
          const selected = puzzleFromRow(data, puzzle);
          setLoad(selected
            ? { status: 'ready', date, puzzle: selected }
            : { status: 'unavailable', message: 'Today’s puzzle is unavailable.', canRetry: false });
        }
      } catch (error) {
        if (!active) return;
        console.warn('Daily team puzzle:', error);
        setLoad({ status: 'unavailable', message: 'Couldn’t reach today’s puzzle.', canRetry: true });
      }
    }
    void fetchPuzzle();
    return () => { active = false; };
  }, [date, puzzle, retry, section.id]);

  if (load.status === 'ready' && load.date === date) {
    return <RosterPuzzle key={`${date}:${load.puzzle.year}`} section={section} puzzle={load.puzzle} dailyDate={date} />;
  }
  if (practice) {
    return <RosterPuzzle key="practice" section={section} puzzle={puzzle} />;
  }

  return (
    <Screen section={section} back={{ pathname: '/fan-challenges', params: { sport: section.id } }}
      backLabel={`${section.name} challenges`} eyebrow={`${section.name} · Daily`} title="Wicked Smaht">
      {load.status !== 'unavailable' ? (
        <Card><Text style={type.muted}>Loading today’s {puzzle.name} puzzle…</Text></Card>
      ) : (
        <FadeIn style={styles.stack}>
          <Card>
            <Text style={type.heading}>{load.message}</Text>
            <Text style={type.muted}>
              Warm up with a practice round instead: {puzzle.prompt.replace(/^Name 10/, 'name 10')} Practice doesn’t count toward your streak.
            </Text>
          </Card>
          <Button label="Play practice round" onPress={() => setPractice(true)} />
          {load.canRetry && (
            <Button label="Try again" variant="secondary" onPress={() => { setLoad({ status: 'loading' }); setRetry((v) => v + 1); }} />
          )}
        </FadeIn>
      )}
    </Screen>
  );
}

/* ------------------------------------------------------------------ the game */

function useCountdown(active: boolean) {
  const [ms, setMs] = useState(() => msUntilBostonMidnight());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setMs(msUntilBostonMidnight()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return ms;
}

function RosterPuzzle({ section, puzzle, dailyDate }: { section: FanSection; puzzle: Puzzle; dailyDate?: string }) {
  const storageKey = dailyDate ? `wicked-smaht:${section.id}:${dailyDate}:${puzzle.year}` : undefined;
  const [game, dispatch] = useReducer(
    (state: GameState, action: GameAction) => gameReducer(state, action, puzzle),
    storageKey,
    (key) => restoreResult(key, puzzle),
  );
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [shareError, setShareError] = useState('');
  const [searchRef, revealSearch] = useRevealOnFocus();
  const countdown = useCountdown(game.finished && !!dailyDate);
  const tried = useMemo(() => new Set([...game.found, ...game.wrong].map(normalize)), [game.found, game.wrong]);
  const points = game.found.length * 100;
  const remaining = MAX_MISTAKES - game.wrong.length;
  const accent = section.accent;

  const suggestions = useMemo(() => {
    const q = normalize(query);
    if (!q) return [];
    const words = (name: string) => name.split(/[\s.-]+/).map(normalize);
    const starts = puzzle.players.filter((name) => words(name).some((word) => word.startsWith(q)));
    const contains = puzzle.players.filter((name) => !starts.includes(name) && normalize(name).includes(q));
    return [...starts, ...contains].slice(0, SUGGESTIONS);
  }, [puzzle.players, query]);

  useEffect(() => {
    if (!storageKey || !game.finished) return;
    try {
      // Saved in guess order so the share grid restores faithfully.
      const ordered: string[] = [];
      let hit = 0;
      let miss = 0;
      for (const outcome of game.order) ordered.push(outcome === 'hit' ? game.found[hit++] : game.wrong[miss++]);
      localStorage.setItem(storageKey, JSON.stringify(ordered));
    } catch (error) {
      console.warn('Could not save daily result:', error);
    }
  }, [storageKey, game]);

  useEffect(() => {
    if (!game.finished) return;
    recordResult({
      id: dailyDate ? `wicked-smaht:${section.id}:${dailyDate}` : `wicked-smaht:${section.id}:practice:${Date.now()}`,
      game: 'wicked-smaht', section: section.id, date: dailyDate,
      score: points, max: GOAL * 100, practice: !dailyDate,
      summary: `${game.found.length}/${GOAL} players · ${game.wrong.length} misses`,
    });
  }, [dailyDate, game.finished, game.found.length, game.wrong.length, points, section.id]);

  function choose(name: string) {
    if (game.finished || tried.has(normalize(name))) return;
    haptic.select();
    setSelected(name);
    setQuery('');
    Keyboard.dismiss();
  }

  function submit() {
    if (!selected || game.finished) return;
    const isHit = puzzle.answers.some((answer) => normalize(answer) === normalize(selected));
    if (isHit) haptic.success(); else haptic.error();
    dispatch({ type: 'guess', player: selected });
    setSelected(null);
  }

  const grid = game.order.map((outcome) => outcome === 'hit' ? '🟩' : '🟥').join('');

  async function shareScore() {
    try {
      setShareError('');
      await shareText(`Stadium Pulse · Wicked Smaht\n${puzzle.name} ${puzzle.year}${dailyDate ? ` · ${dailyDate}` : ' · practice'}\n${game.found.length}/10 ${grid}\nThink you know Boston sports better?`);
    } catch {
      setShareError('Sharing could not open. Please try again.');
    }
  }

  return (
    <Screen
      section={section}
      back={{ pathname: '/fan-challenges', params: { sport: section.id } }}
      backLabel={`${section.name} challenges`}
      eyebrow={dailyDate ? `${section.name} · Daily · ${dailyDate}` : `${section.name} · Practice`}
      title="Wicked Smaht"
      right={<Tag label={`${points} pts`} tone="accent" />}
    >
      <Card>
        <Text style={type.heading}>{puzzle.prompt}</Text>
        <Text style={type.small}>Any 10 correct players win. Five misses and you’re out.</Text>
      </Card>

      <Row style={styles.between}>
        <View style={styles.lives} accessible accessibilityLabel={`${remaining} of ${MAX_MISTAKES} lives remaining`}>
          {Array.from({ length: MAX_MISTAKES }, (_, i) => (
            <View key={i} style={[styles.life, i < remaining ? { backgroundColor: palette.danger } : styles.lifeLost]} />
          ))}
        </View>
        <Text style={[type.eyebrow, { color: palette.text }]}>{game.found.length} / {GOAL} found</Text>
      </Row>

      <View style={styles.board}>
        {Array.from({ length: GOAL }, (_, index) => {
          const name = game.found[index];
          return (
            <View key={index} style={[styles.slot, name ? { borderColor: accent, backgroundColor: palette.overlayStrong } : null]}>
              <Text style={[styles.slotNumber, name ? { color: accent } : null]}>{index + 1}</Text>
              <Text numberOfLines={1} style={[styles.slotText, !name && { color: palette.textFaint }]}>{name ?? '—'}</Text>
            </View>
          );
        })}
      </View>

      {!!game.message && (
        <Text accessibilityLiveRegion="polite" style={[styles.feedback,
          game.last === 'hit' && { color: palette.success },
          game.last === 'miss' && { color: palette.danger }]}>
          {game.message}
        </Text>
      )}

      {!game.finished && (
        <View ref={searchRef} collapsable={false} style={styles.stack}>
          {selected ? (
            <Card tone="raised" style={styles.selectedCard}>
              <View style={styles.flex}>
                <Text style={type.eyebrow}>Your guess</Text>
                <Text style={type.title}>{selected}</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Clear selection" hitSlop={10} onPress={() => setSelected(null)}>
                <Text style={[type.heading, { color: palette.textMuted }]}>✕</Text>
              </Pressable>
            </Card>
          ) : (
            <TextInput
              onFocus={revealSearch}
              accessibilityLabel={`Search ${puzzle.name} players`}
              placeholder={`Search ${puzzle.players.length.toLocaleString()} ${puzzle.name} players…`}
              placeholderTextColor={palette.textFaint}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              autoCapitalize="words"
              returnKeyType="search"
              keyboardAppearance="dark"
              onSubmitEditing={() => suggestions.length === 1 && choose(suggestions[0])}
              style={[styles.input, { borderColor: query ? accent : palette.border }]}
            />
          )}
          {!selected && suggestions.length > 0 && (
            <View style={styles.suggestions}>
              {suggestions.map((name) => {
                const used = tried.has(normalize(name));
                const wasHit = game.found.some((found) => normalize(found) === normalize(name));
                return (
                  <PressableScale key={name} feedback={null} disabled={used} onPress={() => choose(name)}
                    accessibilityRole="button" accessibilityState={{ disabled: used }}
                    accessibilityLabel={used ? `${name}, already tried` : `Select ${name}`}
                    style={[styles.suggestion, used && styles.used]}>
                    <Text style={styles.suggestionText}>{name}</Text>
                    <Text style={type.small}>{used ? (wasHit ? '✓ found' : '✕ tried') : 'Select'}</Text>
                  </PressableScale>
                );
              })}
            </View>
          )}
          {!selected && !!query && suggestions.length === 0 && (
            <Text style={type.small}>No matching player. Try another spelling.</Text>
          )}
          <Button label={selected ? `Submit ${selected}` : 'Pick a player to guess'} disabled={!selected} onPress={submit} feedback={null} />
          <Text style={type.small}>Picking a name is free — only submitting uses an attempt.</Text>
        </View>
      )}

      {game.wrong.length > 0 && (
        <View style={styles.misses}>
          {game.wrong.map((name) => <Tag key={name} label={`✕ ${name}`} tone="danger" />)}
        </View>
      )}

      {game.finished ? (
        <FadeIn style={styles.stack}>
          <Card tone={game.found.length === GOAL ? 'success' : 'raised'} style={styles.center}>
            <Text style={type.eyebrow}>{game.found.length === GOAL ? 'All 10 found' : 'Challenge over'}</Text>
            <Text style={styles.big}>{points}<Text style={styles.bigOf}>/1000</Text></Text>
            {!!grid && <Text style={styles.grid}>{grid}</Text>}
          </Card>
          {dailyDate && (
            <Row>
              <Stat value={formatCountdown(countdown)} label="Next puzzle" />
              <Stat value={`${game.wrong.length}/${MAX_MISTAKES}`} label="Misses" />
            </Row>
          )}
          <Button label="Share your score" icon="↗" onPress={shareScore} />
          {!!shareError && <Text style={type.small}>{shareError}</Text>}
          <Card>
            <Text style={type.heading}>Every qualifying answer</Text>
            <Text style={type.small}>{puzzle.answers.length} players qualified — you needed any 10.</Text>
            <View style={styles.misses}>
              {puzzle.answers.map((name) => {
                const hit = game.found.some((found) => normalize(found) === normalize(name));
                return <Tag key={name} label={`${hit ? '✓ ' : ''}${name}`} tone={hit ? 'success' : 'neutral'} />;
              })}
            </View>
            <Row gap={space.lg}>
              <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(puzzle.answerSource).catch(() => {})}>
                <Text style={[type.small, { color: accent }]}>Roster source</Text>
              </Pressable>
              <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(puzzle.playerSource).catch(() => {})}>
                <Text style={[type.small, { color: accent }]}>Player key source</Text>
              </Pressable>
            </Row>
            <Text style={type.small}>Player names adapted from Wikipedia contributors (CC BY-SA 4.0).</Text>
          </Card>
        </FadeIn>
      ) : (
        <Button label="Give up and reveal answers" variant="ghost" feedback="warning" onPress={() => dispatch({ type: 'finish' })} />
      )}
      <Text style={type.small}>
        {dailyDate ? 'Your daily result is saved on this device.' : 'Practice round — not saved to your streak.'}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stack: { gap: space.md },
  between: { justifyContent: 'space-between' },
  center: { alignItems: 'center', paddingVertical: space.xl },
  lives: { flexDirection: 'row', gap: 6 },
  life: { width: 22, height: 8, borderRadius: 4 },
  lifeLost: { backgroundColor: palette.overlayStrong },
  board: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  slot: {
    width: '48.5%', flexGrow: 1, minHeight: 48, borderRadius: radius.sm, borderWidth: 1, borderColor: palette.border,
    backgroundColor: palette.overlay, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md,
  },
  slotNumber: { color: palette.textFaint, fontSize: 12, fontWeight: '800', width: 16 },
  slotText: { color: palette.text, fontSize: 15, fontWeight: '600', flex: 1 },
  feedback: { color: palette.textMuted, fontSize: 15, fontWeight: '600' },
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
  used: { opacity: 0.4 },
  selectedCard: { flexDirection: 'row', alignItems: 'center' },
  misses: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  big: { ...type.number, fontSize: 64, lineHeight: 70 },
  bigOf: { fontSize: 26, color: palette.textMuted },
  grid: { fontSize: 18, letterSpacing: 2, marginTop: space.sm },
});

