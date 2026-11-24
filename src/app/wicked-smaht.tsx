import { useEffect, useReducer, useState } from 'react';
import { Link, Redirect, useLocalSearchParams } from 'expo-router';
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fanSections, getFanSection } from '@/constants/fan-sections';
import { puzzles } from '@/constants/wicked-smaht-puzzles';
import { supabase } from '@/lib/supabase';

const GOAL = 10;
const MAX_MISTAKES = 5;

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
}



type GameState = {
  found: string[];
  wrong: string[];
  finished: boolean;
  message: string;
};
type GameAction = { type: 'guess'; player: string } | { type: 'finish' };
const initialState: GameState = {
  found: [], wrong: [], finished: false, message: '',
};

function gameReducer(state: GameState, action: GameAction, puzzle: NonNullable<(typeof puzzles)[string]>): GameState {
  if (state.finished) return state;
  if (action.type === 'finish') {
    return { ...state, finished: true, message: 'Challenge finished. Answers revealed below.' };
  }
  const player = puzzle.players.find((name) => normalize(name) === normalize(action.player));
  if (!player) return state;
  if ([...state.found, ...state.wrong].some((name) => normalize(name) === normalize(player))) {
    return { ...state, message: 'Already tried. No attempt lost.' };
  }
  if (puzzle.answers.some((answer) => normalize(answer) === normalize(player))) {
    const found = [...state.found, player];
    return {
      ...state,
      found,
      finished: found.length === GOAL,
      message: found.length === GOAL ? 'Wicked Smaht! All 10 found.' : `Correct — ${player}!`,
    };
  }
  const wrong = [...state.wrong, player];
  return {
    ...state,
    wrong,
    finished: wrong.length === MAX_MISTAKES,
    message: wrong.length === MAX_MISTAKES
      ? 'Five wrong answers. Challenge over.'
      : `${player} was not on the ${puzzle.roster}.`,
  };
}

export default function WickedSmahtScreen() {
  const { sport } = useLocalSearchParams<{ sport?: string }>();
  const id = sport ?? 'celtics';
  const puzzle = typeof id === 'string' && Object.prototype.hasOwnProperty.call(puzzles, id) ? puzzles[id] : undefined;
  if (!puzzle || !getFanSection(id)) return <Redirect href="/" />;
  return <DailyTeamPuzzle key={id} sport={id} puzzle={puzzle} />;
}

type Puzzle = NonNullable<(typeof puzzles)[string]>;

type DailyLoad =
  | { status: 'loading' }
  | { status: 'ready'; date: string; puzzle: Puzzle }
  | { status: 'unavailable'; message: string };

function bostonDate(now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

const celtics2024Answers = [
  'Jayson Tatum', 'Jrue Holiday', 'Jaylen Brown', 'Kristaps Porziņģis',
  'Derrick White', 'Payton Pritchard', 'Oshae Brissett', 'Drew Peterson',
  'JD Davison', 'Xavier Tillman', 'Jordan Walsh', 'Sam Hauser',
  'Luke Kornet', 'Al Horford', 'Jaden Springer', 'Svi Mykhailiuk',
  'Neemias Queta',
];

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
    return { ...game, finished: true, message: 'You completed this daily puzzle.' };
  } catch {
    return initialState;
  }
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

function DailyTeamPuzzle({ sport, puzzle }: { sport: string; puzzle: Puzzle }) {
  const theme = getFanSection(sport) ?? fanSections[0];
  const date = bostonDate(new Date());
  const [load, setLoad] = useState<DailyLoad>({ status: 'loading' });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    async function fetchPuzzle() {
      try {
        const { data, error } = await supabase
          .from('daily_puzzles')
          .select('prompt, roster_data')
          .eq('team', sport)
          .eq('puzzle_date', date)
          .maybeSingle();
        if (!active) return;
        if (error) {
          console.warn('Daily team puzzle:', error.message);
          setLoad({ status: 'unavailable', message: 'Could not load today’s puzzle. Try again.' });
        } else if (!data) {
          setLoad({ status: 'unavailable', message: `There’s no ${puzzle.name} puzzle scheduled for today.` });
        } else {
          const selectedPuzzle = puzzleFromRow(data, puzzle);
          if (selectedPuzzle) {
            setLoad({ status: 'ready', date, puzzle: selectedPuzzle });
          } else {
            setLoad({ status: 'unavailable', message: 'Today’s puzzle is unavailable.' });
          }
        }
      } catch (error) {
        if (!active) return;
        console.warn('Daily team puzzle:', error);
        setLoad({ status: 'unavailable', message: 'Could not load today’s puzzle. Try again.' });
      }
    }
    void fetchPuzzle();
    return () => { active = false; };
  }, [date, puzzle, retry, sport]);

  if (load.status === 'ready' && load.date === date) {
    return <RosterPuzzle key={`${date}:${load.puzzle.year}`} sport={sport} puzzle={load.puzzle} dailyDate={date} />;
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.gameBackground }]}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <Link href={{ pathname: '/fan-challenges', params: { sport } }} dismissTo style={styles.link}>← {puzzle.name} challenges</Link>
        <Text style={styles.title}>Wicked Smaht</Text>
        <Text style={styles.secondary}>
          {load.status === 'unavailable' ? load.message : `Loading today’s ${puzzle.name} puzzle…`}
        </Text>
        {load.status === 'unavailable' && (
          <Pressable style={[styles.button, { backgroundColor: theme.surface }]} accessibilityRole="button" onPress={() => {
            setLoad({ status: 'loading' });
            setRetry((value) => value + 1);
          }}>
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function RosterPuzzle({ sport, puzzle, dailyDate }: { sport: string; puzzle: Puzzle; dailyDate?: string }) {
  const theme = getFanSection(sport) ?? fanSections[0];
  const storageKey = dailyDate ? `wicked-smaht:${sport}:${dailyDate}:${puzzle.year}` : undefined;
  const [game, dispatch] = useReducer(
    (state: GameState, action: GameAction) => gameReducer(state, action, puzzle),
    storageKey,
    (key) => restoreResult(key, puzzle)
  );
  useEffect(() => {
    if (!storageKey || !game.finished) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify([...game.found, ...game.wrong]));
    } catch (error) {
      console.warn('Could not save daily result:', error);
    }
  }, [storageKey, game]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [shareError, setShareError] = useState('');
  const filtered = puzzle.players.filter((name) => normalize(name).includes(normalize(query)));
  const tried = new Set([...game.found, ...game.wrong].map(normalize));
  const points = game.found.length * 100;
  const remaining = MAX_MISTAKES - game.wrong.length;

  function openPicker() {
    if (game.finished) return;
    setQuery('');
    setPickerOpen(true);
  }

  function choosePlayer(name: string) {
    if (game.finished || tried.has(normalize(name))) return;
    setSelected(name);
    setPickerOpen(false);
    Keyboard.dismiss();
  }

  function submitAnswer() {
    if (!selected || game.finished) return;
    dispatch({ type: 'guess', player: selected });
    setSelected(null);
  }

  async function shareScore() {
    try {
      setShareError('');
      await Share.share({
        message: `Wicked Smaht · ${puzzle.name} ${puzzle.year}\n${game.found.length}/10 players · ${points}/1000 points\n${game.wrong.length}/5 mistakes\nThink you know Boston sports better? Boston sports challenges.`,
      });
    } catch {
      setShareError('Sharing could not open. Please try again.');
    }
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.gameBackground }]}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <Link href={{ pathname: '/fan-challenges', params: { sport } }} dismissTo style={styles.link}>← {puzzle.name} challenges</Link>
        <Text style={styles.label}>{dailyDate ? `${puzzle.name.toUpperCase()} DAILY PUZZLE · ${dailyDate}` : 'BOSTON SPORTS · PRACTICE'}</Text>
        <Text style={styles.title}>Wicked Smaht</Text>
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <Text style={styles.question}>
            {puzzle.prompt}
          </Text>
          <Text style={styles.secondary}>
            Pick from the {puzzle.name} player key. Any 10 correct players count.
            Five wrong answers end the challenge.
          </Text>
        </View>
        <Text style={styles.score}>{game.found.length} / 10 · {points} points</Text>
        <Text style={[styles.lives, remaining <= 1 && styles.warning]}>
          {remaining} of 5 attempts remaining
        </Text>
        <Text style={styles.hearts} accessibilityLabel={`${remaining} attempts remaining`}>
          {'♥ '.repeat(remaining)}{'♡ '.repeat(game.wrong.length)}
        </Text>

        {!game.finished && (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={selected ? `Selected ${selected}. Open player key to change.` : `Open ${puzzle.name} player key`}
              onPress={openPicker}
              style={[styles.selector, { backgroundColor: theme.surface }]}
            >
              <Text style={styles.selectorLabel}>CELTICS ALL-TIME PLAYER KEY</Text>
              <Text style={styles.selectorValue}>{selected ?? 'Tap to search or browse players'} ▾</Text>
            </Pressable>
            <Text style={styles.secondary}>
              Choosing a name does not use an attempt. Submit when ready.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !selected }}
              disabled={!selected}
              onPress={submitAnswer}
              style={[styles.button, { backgroundColor: theme.surface }, !selected && styles.disabled]}
            >
              <Text style={styles.buttonText}>Submit player</Text>
            </Pressable>
          </>
        )}
        <Text style={styles.feedback} accessibilityLiveRegion="polite">{game.message}</Text>
        {Array.from({ length: GOAL }, (_, index) => (
          <View key={index} style={[styles.slot, { backgroundColor: theme.surface }]}>
            <Text style={styles.slotText}>{index + 1}. {game.found[index] ?? '—'}</Text>
          </View>
        ))}
        {game.wrong.length > 0 && (
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <Text style={styles.question}>Wrong guesses · {game.wrong.length}/5</Text>
            {game.wrong.map((name) => <Text key={name} style={styles.wrongText}>✕ {name}</Text>)}
          </View>
        )}
        {game.finished ? (
          <>
            <Text style={styles.question}>
              {game.found.length === GOAL ? 'All 10 found!' : 'Challenge over'}
            </Text>
            <Text style={styles.score}>Final score: {points} / 1000</Text>
            <Pressable accessibilityRole="button" style={[styles.button, { backgroundColor: theme.surface }]} onPress={shareScore}>
              <Text style={styles.buttonText}>Share your score →</Text>
            </Pressable>
            {shareError ? <Text style={styles.feedback}>{shareError}</Text> : null}
            <View style={[styles.card, { backgroundColor: theme.surface }]}>
              <Text style={styles.question}>All qualifying answers</Text>
              <Text style={styles.secondary}>There are {puzzle.answers.length} qualifying players; you needed any 10.</Text>
              {puzzle.answers.map((name) => (
                <Text key={name} style={styles.secondary}>
                  {game.found.some((found) => normalize(found) === normalize(name)) ? '✓ ' : '• '}{name}
                </Text>
              ))}
              <Pressable accessibilityRole="link" onPress={() => {
                void Linking.openURL(puzzle.answerSource).catch(() => {});
              }}>
                <Text style={styles.link}>Answer roster source</Text>
              </Pressable>
              <Pressable accessibilityRole="link" onPress={() => {
                void Linking.openURL(puzzle.playerSource).catch(() => {});
              }}>
                <Text style={styles.link}>Player key source</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Pressable
            accessibilityRole="button"
            style={styles.finishButton}
            onPress={() => dispatch({ type: 'finish' })}
          >
            <Text style={styles.link}>Finish and reveal answers</Text>
          </Pressable>
        )}
        <Text style={styles.secondary}>
          {dailyDate ? 'Completed rounds are saved on this device.' : 'Practice scores reset when the game restarts.'}
        </Text>
      </ScrollView>

      <Modal
        visible={pickerOpen && !game.finished}
        animationType="slide"
        onRequestClose={() => setPickerOpen(false)}
      >
        <SafeAreaView style={[styles.screen, { backgroundColor: theme.gameBackground }]}>
      <StatusBar style="light" />
          <KeyboardAvoidingView
            style={[styles.screen, { backgroundColor: theme.gameBackground }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.pickerHeader}>
              <Pressable accessibilityRole="button" onPress={() => setPickerOpen(false)} style={styles.closeButton}>
                <Text style={styles.link}>Close player key</Text>
              </Pressable>
              <Text style={styles.question}>{puzzle.name} player key</Text>
              <Text style={styles.secondary}>
                Names only — no seasons or clues. Tap a player to select.
              </Text>
              <TextInput
                accessibilityLabel={`Search ${puzzle.name} player key`}
                placeholder="Search first or last name…"
                placeholderTextColor="#9CA7BB"
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
                autoCapitalize="none"
                style={[styles.input, { backgroundColor: theme.surface }]}
              />
              <Text style={styles.secondary}>{filtered.length} players shown · {puzzle.players.length} in key</Text>
            </View>
            <FlatList
              style={styles.list}
              data={filtered}
              extraData={game}
              keyExtractor={(name) => name}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              initialNumToRender={20}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={<Text style={styles.secondary}>No matching player. Try another spelling.</Text>}
              renderItem={({ item }) => {
                const alreadyTried = tried.has(normalize(item));
                const wasCorrect = game.found.some((name) => normalize(name) === normalize(item));
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: alreadyTried }}
                    disabled={alreadyTried}
                    onPress={() => choosePlayer(item)}
                    style={({ pressed }) => [styles.playerRow, alreadyTried && styles.disabled, pressed && styles.pressed]}
                  >
                    <Text style={styles.slotText}>{item}</Text>
                    <Text style={styles.secondary}>
                      {alreadyTried ? (wasCorrect ? '✓ Found' : '✕ Tried') : 'Select'}
                    </Text>
                  </Pressable>
                );
              }}
              ListFooterComponent={
                <View style={styles.source}>
                  <Text style={styles.secondary}>
                    Player key: franchise roster snapshot.
                    Future additions may need an update.
                  </Text>
                  <Text style={styles.secondary}>
                    Source: Wikipedia contributors (CC BY-SA 4.0).
                  </Text>
                </View>
              }
            />
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#101218' },
  content: { padding: 24, paddingBottom: 40, gap: 16, width: '100%', maxWidth: 600, alignSelf: 'center' },
  link: { color: '#85B0FF', fontSize: 16, paddingVertical: 8 },
  label: { color: '#FFD477', fontSize: 12, fontWeight: '800' },
  title: { color: '#FFFFFF', fontSize: 36, fontWeight: '900' },
  card: { backgroundColor: '#1D2230', padding: 20, borderRadius: 18, gap: 12 },
  question: { color: '#FFFFFF', fontSize: 21, fontWeight: '700', lineHeight: 29 },
  secondary: { color: '#BDC3D0', fontSize: 15, lineHeight: 23 },
  score: { color: '#FFD477', fontSize: 22, fontWeight: '800' },
  lives: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  hearts: { color: '#FF7C8B', fontSize: 28 },
  warning: { color: '#FF7C8B' },
  selector: { backgroundColor: '#1D2230', borderColor: '#85B0FF', borderWidth: 1, padding: 18, borderRadius: 14, gap: 8 },
  selectorLabel: { color: '#85B0FF', fontSize: 12, fontWeight: '800' },
  selectorValue: { color: '#FFFFFF', fontSize: 18, lineHeight: 26 },
  input: { color: '#FFFFFF', backgroundColor: '#1D2230', borderColor: '#62718B', borderWidth: 1, borderRadius: 14, padding: 16, fontSize: 18 },
  button: { backgroundColor: '#2357C7', padding: 18, borderRadius: 14, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.7 },
  feedback: { color: '#E0E4ED', fontSize: 15, minHeight: 24 },
  slot: { backgroundColor: '#1D2230', padding: 14, borderRadius: 12 },
  slotText: { color: '#FFFFFF', fontSize: 17 },
  wrongText: { color: '#FF9CAA', fontSize: 16 },
  finishButton: { paddingVertical: 12, alignItems: 'center' },
  pickerHeader: { padding: 20, gap: 12, width: '100%', maxWidth: 600, alignSelf: 'center' },
  closeButton: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-end' },
  list: { flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center' },
  listContent: { paddingHorizontal: 20, paddingBottom: 32 },
  playerRow: { paddingVertical: 18, paddingHorizontal: 8, minHeight: 60, borderBottomColor: '#343C4E', borderBottomWidth: 1, gap: 4 },
  source: { paddingVertical: 24, gap: 8 },
});

