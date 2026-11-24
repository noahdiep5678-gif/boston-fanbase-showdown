import { fanSections, getFanSection } from '@/constants/fan-sections';
import { supabase } from '@/lib/supabase';
import { Link, Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useReducer, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
type UpcomingGame = {
  id: number;
  startsAt: string;
  homeTeam: string;
  awayTeam: string;
  tipoffBoston: string;
};
type CelticsPick = 'over' | 'under';
type CelticsQuestion = {
  question_id: string;
  question: string;
  threshold: number;
  scoring_type: 'combined_points' | 'celtics_points' | 'celtics_margin';
};
type CelticsAnswer = CelticsQuestion & {
  choice: CelticsPick | null;
  actual: number | null;
  correct_choice: CelticsPick | 'push' | null;
};
type CelticsResult = {
  game_id: number;
  starts_at: string;
  home_score: number;
  away_score: number;
  home_team_name: string | null;
  away_team_name: string | null;
  questions: CelticsAnswer[];
};

// Share initialization when more than one question is tapped on a new installation.
let guestSession: Promise<string> | undefined;
async function getCelticsFanId(): Promise<string> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (session) return session.user.id;
  if (!guestSession) {
    guestSession = supabase.auth.signInAnonymously().then(({ data, error: signInError }) => {
      if (signInError) throw signInError;
      if (!data.session) throw new Error('Guest session unavailable');
      return data.session.user.id;
    }).finally(() => { guestSession = undefined; });
  }
  return guestSession;
}

function CelticsTotalPick({ gameId, startsAt }: { gameId: number; startsAt: string }) {
  const [questions, setQuestions] = useState<CelticsQuestion[]>();
  const [errorMessage, setErrorMessage] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    async function loadQuestions() {
      try {
        const { data, error } = await supabase.from('celtics_prediction_questions')
          .select('question_id,question,threshold,scoring_type')
          .eq('game_id', gameId).order('question_id');
        if (error) throw error;
        if ((data ?? []).some((row) => typeof row.question !== 'string'
          || row.threshold === null || !Number.isFinite(Number(row.threshold)))) {
          throw new Error('Invalid question');
        }
        if (active) setQuestions((data ?? []).map((row) => ({
          ...row, threshold: Number(row.threshold),
        })) as CelticsQuestion[]);
      } catch {
        if (active) setErrorMessage('Could not load the questions.');
      }
    }
    void loadQuestions();
    return () => { active = false; };
  }, [gameId, retry]);

  if (!questions) {
    return (
      <View style={styles.options}>
        <Text style={styles.secondary}>{errorMessage || 'Loading questions…'}</Text>
        {!!errorMessage && (
          <Pressable accessibilityRole="button" style={styles.option} onPress={() => {
            setErrorMessage('');
            setRetry((value) => value + 1);
          }}><Text style={styles.optionText}>Retry questions</Text></Pressable>
        )}
      </View>
    );
  }
  return (
    <View style={styles.options}>
      {questions.length === 0 && <Text style={styles.secondary}>Questions will be available soon.</Text>}
      {questions.map((question) => (
        <CelticsQuestionPick key={`${gameId}:${question.question_id}`}
          gameId={gameId} startsAt={startsAt} question={question} />
      ))}
    </View>
  );
}

function CelticsQuestionPick({ gameId, startsAt, question }: {
  gameId: number; startsAt: string; question: CelticsQuestion;
}) {
  const deadline = Date.parse(startsAt);
  const [now, setNow] = useState(Date.now);
  const [pick, setPick] = useState<CelticsPick | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serverClosed, setServerClosed] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [message, setMessage] = useState('');
  const saveInProgress = useRef(false);
  const closed = !Number.isFinite(deadline) || now >= deadline || serverClosed;
  const disabled = closed || loading || saving || loadError;

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(Date.now());
    });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadPick() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!session) return;
        const { data, error: pickError } = await supabase.from('celtics_prediction_picks')
          .select('choice').eq('game_id', gameId).eq('user_id', session.user.id)
          .eq('question_id', question.question_id).maybeSingle();
        if (pickError) throw pickError;
        if (active && (data?.choice === 'over' || data?.choice === 'under')) {
          setPick(data.choice);
          setMessage('Saved pick loaded.');
        }
      } catch {
        if (active) { setLoadError(true); setMessage('Could not load your saved pick.'); }
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadPick();
    return () => { active = false; };
  }, [gameId, question.question_id, retry]);

  async function savePick(choice: CelticsPick) {
    if (disabled || saveInProgress.current) return;
    saveInProgress.current = true;
    setSaving(true);
    setMessage('');
    try {
      const userId = await getCelticsFanId();
      const { error } = await supabase.from('celtics_prediction_picks').upsert({
        game_id: gameId, user_id: userId, question_id: question.question_id, choice,
      }, { onConflict: 'game_id,user_id,question_id' });
      if (error?.message === 'Picks are closed for this game') {
        setServerClosed(true);
        setMessage('The deadline has passed. This change was not saved.');
        return;
      }
      if (error) throw error;
      setPick(choice);
      setMessage('Pick saved.');
    } catch {
      setMessage('Could not save your pick. Please try again.');
    } finally {
      saveInProgress.current = false;
      setSaving(false);
    }
  }

  return (
    <View style={styles.result}>
      <Text style={styles.question}>{question.question}</Text>
      {(['over', 'under'] as const).map((choice) => (
        <Pressable key={choice} accessibilityRole="button"
          accessibilityLabel={`${question.question} ${choice} ${question.threshold}`}
          accessibilityState={{ selected: pick === choice, disabled }} disabled={disabled}
          style={[styles.option, pick === choice && [styles.selected, { backgroundColor: fanSections[0].gameBackground }]]}
          onPress={() => void savePick(choice)}>
          <Text style={styles.optionText}>{pick === choice ? '✓ ' : ''}
            {choice === 'over' ? 'Over' : 'Under'} {question.threshold}
          </Text>
        </Pressable>
      ))}
      <Text style={styles.secondary} accessibilityLiveRegion="polite">
        {loading ? 'Checking your saved pick…' : saving ? 'Saving…'
          : closed ? 'Picks are closed.' : 'You can change your pick until scheduled tipoff.'}
      </Text>
      {!!message && <Text style={styles.secondary} accessibilityLiveRegion="polite">{message}</Text>}
      {loadError && <Pressable accessibilityRole="button" style={styles.option} onPress={() => {
        setLoadError(false); setLoading(true); setMessage(''); setRetry((value) => value + 1);
      }}><Text style={styles.optionText}>Retry saved pick</Text></Pressable>}
    </View>
  );
}

function CelticsPickResult() {
  const [refresh, setRefresh] = useState(0);
  const [game, setGame] = useState<CelticsResult | null>(null);
  const [message, setMessage] = useState('Loading latest result…');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadResult() {
      try {
        const { data, error } = await supabase.rpc('latest_completed_celtics_answers');
        if (error) throw error;
        if (data && (!Array.isArray(data.questions)
          || !Number.isInteger(data.home_score) || !Number.isInteger(data.away_score))) {
          throw new Error('Invalid result');
        }
        if (active) {
          setGame(data as CelticsResult | null);
          setMessage(data ? '' : 'No completed game results available yet.');
        }
      } catch {
        if (active) { setGame(null); setMessage('Could not load the result. Try refreshing.'); }
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadResult();
    return () => { active = false; };
  }, [refresh]);

  const answered = game?.questions.filter((question) => question.choice !== null) ?? [];
  const graded = answered.filter((question) => question.correct_choice === 'over'
    || question.correct_choice === 'under');
  const correct = graded.filter((question) => question.choice === question.correct_choice).length;

  return (
    <View style={[styles.card, { backgroundColor: fanSections[0].surface }]}>
      <Text style={styles.question}>Latest Celtics result</Text>
      {game && <>
        <Text style={styles.secondary}>
          {new Date(game.starts_at).toLocaleDateString('en-US', {
            timeZone: 'America/New_York', month: 'short', day: 'numeric',
          })} · Final score{'\n'}
          {game.away_team_name ?? 'Away'} {game.away_score}, {' '}
          {game.home_team_name ?? 'Home'} {game.home_score}
        </Text>
        {game.questions.map((question) => (
          <View key={question.question_id} style={styles.result}>
            <Text style={styles.question}>{question.question}</Text>
            <Text style={styles.secondary}>
              {question.correct_choice === null ? 'Grading is waiting for team details.'
                : question.correct_choice === 'push' ? 'Total matched the line · Push'
                : `Correct answer: ${question.correct_choice === 'over' ? 'Over' : 'Under'} ${question.threshold}`}
              {question.actual !== null ? ` · Actual: ${question.actual}` : ''}
            </Text>
            <Text style={styles.secondary}>
              {question.choice === null ? 'You did not make a pick for this question.'
                : `Your pick: ${question.choice === 'over' ? 'Over' : 'Under'} ${question.threshold}`}
            </Text>
            {question.choice !== null && question.correct_choice !== null
              && question.correct_choice !== 'push' && (
              <Text style={[styles.resultText,
                question.choice === question.correct_choice ? styles.correct : styles.incorrect]}>
                {question.choice === question.correct_choice ? 'Correct' : 'Incorrect'}
              </Text>
            )}
          </View>
        ))}
        <Text style={styles.secondary}>{correct} of {graded.length} graded picks correct</Text>
      </>}
      {!!message && <Text style={styles.secondary} accessibilityLiveRegion="polite">{message}</Text>}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: loading }}
        disabled={loading} style={styles.option} onPress={() => {
          setLoading(true); setMessage('Loading latest result…'); setRefresh((value) => value + 1);
        }}><Text style={styles.optionText}>Refresh result</Text></Pressable>
    </View>
  );
}

function CelticsSchedule() {
  const [schedule, setSchedule] = useState<{
    game: UpcomingGame | null;
    error: boolean;
  }>();

  useEffect(() => {
    let active = true;

    async function loadSchedule() {
      try {
        const { data, error } = await supabase.functions.invoke<{
          games: UpcomingGame[];
        }>('test-celtics-schedule', { method: 'GET' });

        if (error || !data || !Array.isArray(data.games)) {
          throw new Error('Could not load Celtics schedule');
        }

        if (active) {
          setSchedule({ game: data.games[0] ?? null, error: false });
        }
      } catch {
        if (active) {
          setSchedule({ game: null, error: true });
        }
      }
    }

    void loadSchedule();
    return () => {
      active = false;
    };
  }, []);

  const game = schedule?.game;

  return (
    <View style={[styles.card, { backgroundColor: fanSections[0].surface }]}>
      <Text style={styles.team}>Next Celtics game</Text>
      {game ? (
        <>
          <Text style={styles.question}>{game.awayTeam} at {game.homeTeam}</Text>
          <Text style={styles.secondary}>{game.tipoffBoston} Boston time</Text>
          <CelticsTotalPick key={game.id} gameId={game.id} startsAt={game.startsAt} />
        </>
      ) : (
        <Text style={styles.secondary}>
          {!schedule ? 'Loading schedule…' : schedule.error
            ? 'Could not load the Celtics schedule.'
            : 'No Celtics games in the next seven days.'}
        </Text>
      )}
    </View>
  );
}

type TeamScheduleGame = Pick<UpcomingGame, 'homeTeam' | 'awayTeam' | 'startsAt'>;

const bostonGameTime = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
});

function TeamSchedule({ team, surface }: { team: 'patriots' | 'bruins'; surface: string }) {
  const name = team === 'patriots' ? 'Patriots' : 'Bruins';
  const [schedule, setSchedule] = useState<{ game: TeamScheduleGame | null; error?: boolean }>();

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data, error } = await supabase.functions.invoke<{ game: TeamScheduleGame | null }>(
          `team-prediction-schedule?team=${team}`,
          { method: 'GET' },
        );
        if (error || !data || (data.game !== null &&
            (!data.game?.homeTeam || !data.game.awayTeam || !Number.isFinite(Date.parse(data.game.startsAt))))) {
          throw new Error('Invalid schedule response.');
        }
        if (active) setSchedule(data);
      } catch {
        if (active) setSchedule({ game: null, error: true });
      }
    }
    void load();
    return () => { active = false; };
  }, [team]);

  const game = schedule?.game;
  return (
    <View style={[styles.card, { backgroundColor: surface }]}>
      <Text style={styles.team}>Next {name} game</Text>
      {game ? (
        <>
          <Text style={styles.question}>{game.awayTeam} at {game.homeTeam}</Text>
          <Text style={styles.secondary}>{bostonGameTime.format(new Date(game.startsAt))}</Text>
          <Text style={styles.secondary}>Live picks are coming soon.</Text>
        </>
      ) : (
        <Text style={styles.secondary}>
          {!schedule ? 'Loading schedule…' : schedule.error
            ? 'Schedule unavailable right now.'
            : `No ${name} games scheduled in the next seven days.`}
        </Text>
      )}
    </View>
  );
}

type Prediction = {
  id: string;
  team: string;
  category: string;
  question: string;
  choices: [string, string];
  correctIndex: number;
  simulatedResult: string;
};

// Entirely fictional examples for testing the interface, not scheduled games,
// real player projections, betting lines, or actual results.
const allPredictions: Prediction[] = [
  {
    id: 'patriots-spread',
    team: 'Patriots',
    category: 'POINT SPREAD · PATRIOTS -6.5',
    question: 'Will the Patriots beat the Jets by 7 or more points?',
    choices: ['Yes · win by 7 or more', 'No · win by 6 or fewer, tie, or lose'],
    correctIndex: 0,
    simulatedResult: 'Simulated final: Patriots 24, Jets 17. New England wins by 7 and covers -6.5.',
  },
  {
    id: 'celtics-player-assists',
    team: 'Celtics',
    category: 'PLAYER ASSISTS',
    question: 'Will Jayson Tatum have more than 4 assists?',
    choices: ['Yes · 5 or more assists', 'No · 4 or fewer assists'],
    correctIndex: 0,
    simulatedResult: 'Simulated result: Tatum records 6 assists. More than 4 means 5 or more.',
  },
  {
    id: 'bruins-mcavoy-points',
    team: 'Bruins',
    category: 'PLAYER POINTS · GOALS + ASSISTS',
    question: 'Will Charlie McAvoy record at least 2 points?',
    choices: ['Yes · 2 or more points', 'No · 0 or 1 point'],
    correctIndex: 1,
    simulatedResult: 'Simulated result: McAvoy has 0 goals and 1 assist, totaling 1 point.',
  },
  {
    id: 'red-sox-run-line',
    team: 'Red Sox',
    category: 'RUN LINE · RED SOX -1.5',
    question: 'Will the Red Sox beat the Yankees by 2 or more runs?',
    choices: ['Yes · win by 2 or more runs', 'No · win by 1 run or lose'],
    correctIndex: 1,
    simulatedResult: 'Simulated final: Yankees 5, Red Sox 3. Boston loses and does not cover -1.5.',
  },
  {
    id: "patriots-total",
    team: "Patriots",
    category: "TOTAL POINTS",
    question: "Will Patriots–Jets finish with at least 42 combined points?",
    choices: ["Yes · 42 or more", "No · 41 or fewer"],
    correctIndex: 1,
    simulatedResult: "Simulated result: Patriots 24, Jets 17. Combined points: 41.",
  },
  {
    id: "patriots-passing",
    team: "Patriots",
    category: "PASSING YARDS",
    question: "Will the Patriots quarterback throw for at least 225 yards?",
    choices: ["Yes · 225 or more", "No · 224 or fewer"],
    correctIndex: 0,
    simulatedResult: "Simulated result: The Patriots quarterback throws for 238 yards.",
  },
  {
    id: "patriots-rushing",
    team: "Patriots",
    category: "RUSHING YARDS",
    question: "Will the Patriots lead running back rush for at least 70 yards?",
    choices: ["Yes · 70 or more", "No · 69 or fewer"],
    correctIndex: 0,
    simulatedResult: "Simulated result: The lead running back rushes for 76 yards.",
  },
  {
    id: "patriots-sacks",
    team: "Patriots",
    category: "TEAM SACKS",
    question: "Will the Patriots defense record at least 3 sacks?",
    choices: ["Yes · 3 or more", "No · 2 or fewer"],
    correctIndex: 1,
    simulatedResult: "Simulated result: New England records 2 sacks.",
  },
  {
    id: "celtics-spread",
    team: "Celtics",
    category: "POINT SPREAD · CELTICS -5.5",
    question: "Will the Celtics beat the Knicks by 6 or more points?",
    choices: ["Yes · Win by 6 or more", "No · Win by 5 or fewer, or lose"],
    correctIndex: 0,
    simulatedResult: "Simulated result: Celtics 112, Knicks 105. Boston wins by 7.",
  },
  {
    id: "celtics-total",
    team: "Celtics",
    category: "TOTAL POINTS",
    question: "Will Celtics–Knicks finish with at least 220 combined points?",
    choices: ["Yes · 220 or more", "No · 219 or fewer"],
    correctIndex: 1,
    simulatedResult: "Simulated result: Celtics 112, Knicks 105. Combined points: 217.",
  },
  {
    id: "celtics-player-points",
    team: "Celtics",
    category: "PLAYER POINTS",
    question: "Will Jayson Tatum score at least 28 points?",
    choices: ["Yes · 28 or more", "No · 27 or fewer"],
    correctIndex: 0,
    simulatedResult: "Simulated result: Tatum scores 31 points.",
  },
  {
    id: "celtics-player-rebounds",
    team: "Celtics",
    category: "PLAYER REBOUNDS",
    question: "Will Jayson Tatum grab at least 8 rebounds?",
    choices: ["Yes · 8 or more", "No · 7 or fewer"],
    correctIndex: 1,
    simulatedResult: "Simulated result: Tatum grabs 7 rebounds.",
  },
  {
    id: "bruins-puck-line",
    team: "Bruins",
    category: "PUCK LINE · BRUINS -1.5",
    question: "Will the Bruins beat the Canadiens by 2 or more goals?",
    choices: ["Yes · Win by 2 or more", "No · Win by 1 or lose"],
    correctIndex: 1,
    simulatedResult: "Simulated result: Bruins 3, Canadiens 2. Boston wins by 1.",
  },
  {
    id: "bruins-total",
    team: "Bruins",
    category: "TOTAL GOALS",
    question: "Will Bruins–Canadiens finish with at least 6 combined goals?",
    choices: ["Yes · 6 or more", "No · 5 or fewer"],
    correctIndex: 1,
    simulatedResult: "Simulated result: Bruins 3, Canadiens 2. Combined goals: 5.",
  },
  {
    id: "bruins-saves",
    team: "Bruins",
    category: "GOALIE SAVES",
    question: "Will Boston’s starting goalie make at least 28 saves?",
    choices: ["Yes · 28 or more", "No · 27 or fewer"],
    correctIndex: 0,
    simulatedResult: "Simulated result: Boston’s starting goalie makes 30 saves.",
  },
  {
    id: "bruins-shots",
    team: "Bruins",
    category: "SHOTS ON GOAL",
    question: "Will Charlie McAvoy have at least 3 shots on goal?",
    choices: ["Yes · 3 or more", "No · 2 or fewer"],
    correctIndex: 0,
    simulatedResult: "Simulated result: McAvoy records 4 shots on goal.",
  },
  {
    id: "red-sox-total",
    team: "Red Sox",
    category: "TOTAL RUNS",
    question: "Will Red Sox–Yankees finish with at least 9 combined runs?",
    choices: ["Yes · 9 or more", "No · 8 or fewer"],
    correctIndex: 1,
    simulatedResult: "Simulated result: Yankees 5, Red Sox 3. Combined runs: 8.",
  },
  {
    id: "red-sox-strikeouts",
    team: "Red Sox",
    category: "PITCHER STRIKEOUTS",
    question: "Will Boston’s starting pitcher strike out at least 6 batters?",
    choices: ["Yes · 6 or more", "No · 5 or fewer"],
    correctIndex: 0,
    simulatedResult: "Simulated result: Boston’s starter strikes out 7 batters.",
  },
  {
    id: "red-sox-hits",
    team: "Red Sox",
    category: "TEAM HITS",
    question: "Will the Red Sox collect at least 8 hits?",
    choices: ["Yes · 8 or more", "No · 7 or fewer"],
    correctIndex: 0,
    simulatedResult: "Simulated result: Boston collects 9 hits.",
  },
  {
    id: "red-sox-home-runs",
    team: "Red Sox",
    category: "TEAM HOME RUNS",
    question: "Will the Red Sox hit at least 2 home runs?",
    choices: ["Yes · 2 or more", "No · 1 or fewer"],
    correctIndex: 1,
    simulatedResult: "Simulated result: Boston hits 1 home run.",
  },
];

const POINTS_PER_PICK = 100;
type Stage = 'picking' | 'locked' | 'settled';
type Picks = Record<string, number>;
type State = { picks: Picks; stage: Stage };
type Action =
  | { type: 'pick'; id: string; choice: number }
  | { type: 'lock' }
  | { type: 'settle' };
const initialState: State = { picks: {}, stage: 'picking' };

function completePicks(picks: Picks, predictions: Prediction[]) {
  return predictions.every((item) =>
    Number.isInteger(picks[item.id]) && picks[item.id] >= 0 && picks[item.id] < item.choices.length
  );
}

function predictionReducer(state: State, action: Action, predictions: Prediction[]): State {
  if (action.type === 'pick') {
    const item = predictions.find((entry) => entry.id === action.id);
    if (state.stage !== 'picking' || !item || !Number.isInteger(action.choice)
      || action.choice < 0 || action.choice >= item.choices.length) return state;
    return { ...state, picks: { ...state.picks, [action.id]: action.choice } };
  }
  if (action.type === 'lock') {
    return state.stage === 'picking' && completePicks(state.picks, predictions)
      ? { ...state, stage: 'locked' } : state;
  }
  return state.stage === 'locked' ? { ...state, stage: 'settled' } : state;
}

function countCorrect(picks: Picks, predictions: Prediction[]) {
  return predictions.filter((item) => picks[item.id] === item.correctIndex).length;
}

export default function SportsPredictionsScreen() {
  const params = useLocalSearchParams<{ sport?: string }>();
  const section = getFanSection(params.sport);
  if (params.sport !== undefined && (!section || section.id === 'boston')) {
    return <Redirect href="/" />;
  }
  const predictions = section
    ? allPredictions.filter((item) => item.team === section.name)
    : allPredictions.filter((item) => fanSections.some(({ name }) => name === item.team));
  return (
    <PredictionGame
      key={section?.id ?? 'all'}
      predictions={predictions}
      sportId={section?.id}
      categoryName={section?.name ?? 'Boston sports'}
    />
  );
}

function PredictionGame({ predictions, sportId, categoryName }: {
  predictions: Prediction[];
  sportId?: string;
  categoryName: string;
}) {
  const [state, dispatch] = useReducer(
    (current: State, action: Action) => predictionReducer(current, action, predictions),
    initialState
  );
  const [shareError, setShareError] = useState('');
  const theme = getFanSection(sportId) ?? fanSections[0];
  const pickCount = predictions.length;
  const maxPoints = pickCount * POINTS_PER_PICK;
  const selectedCount = predictions.filter((item) => state.picks[item.id] !== undefined).length;
  const ready = completePicks(state.picks, predictions);
  const settled = state.stage === 'settled';
  const correct = countCorrect(state.picks, predictions);
  const points = correct * POINTS_PER_PICK;

  async function sharePicks() {
    try {
      setShareError('');
      const summary = predictions.map((item) =>
        `${item.question} — ${item.choices[state.picks[item.id]]}`
      ).join('\n');
      await Share.share({
        message: `${categoryName} Predictions · DEMO\n` +
          (settled ? `${correct}/${pickCount} correct · ${points}/${maxPoints} practice points\n` : 'My demo picks are locked.\n') +
          summary + '\nFictional matchups and results. Think you can beat my picks?',
      });
    } catch {
      setShareError('Sharing could not open. Please try again.');
    }
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.gameBackground }]}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <Link
          href={sportId ? { pathname: '/fan-challenges', params: { sport: sportId } } : '/'}
          dismissTo
          style={styles.link}
        >← Back to challenges</Link>
        <Text style={styles.label}>{sportId === 'celtics' ? 'BOSTON SPORTS' : 'BOSTON SPORTS · DEMO'}</Text>
        <Text style={styles.title}>Make your picks.</Text>
        <Text style={styles.team}>{categoryName} challenges</Text>
        {sportId === 'celtics' && <CelticsSchedule />}
        {sportId === 'celtics' && <CelticsPickResult />}
        {(sportId === 'patriots' || sportId === 'bruins') && (
          <TeamSchedule team={sportId} surface={theme.surface} />
        )}
        {sportId !== 'celtics' && <>
        <View style={[styles.notice, { backgroundColor: theme.surface }]}>
          <Text style={styles.noticeTitle}>Fictional practice slate</Text>
          <Text style={styles.secondary}>
            These are sample matchups and invented results, not upcoming games.
            Each correct pick earns 100 practice points. No money or wagers.
          </Text>
        </View>
        <Text style={styles.status} accessibilityLiveRegion="polite">
          {state.stage === 'picking' ? `${selectedCount} of ${pickCount} picks selected`
            : settled ? 'Demo results are in.' : 'Picks locked. Waiting for demo results.'}
        </Text>
        {predictions.map((item) => {
          const selected = state.picks[item.id];
          const won = selected === item.correctIndex;
          return (
            <View key={item.id} style={[styles.card, { backgroundColor: theme.surface }]}>
              <Text style={styles.label}>{item.team.toUpperCase()} · {item.category}</Text>
              <Text style={styles.question}>{item.question}</Text>
              <View style={styles.options}>
                {item.choices.map((choice, index) => (
                  <Pressable
                    key={choice}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.question} ${choice}`}
                    accessibilityState={{ selected: selected === index, disabled: state.stage !== 'picking' }}
                    disabled={state.stage !== 'picking'}
                    onPress={() => dispatch({ type: 'pick', id: item.id, choice: index })}
                    style={({ pressed }) => [styles.option, selected === index && [styles.selected, { backgroundColor: theme.gameBackground }], pressed && styles.pressed]}
                  >
                    <Text style={styles.optionText}>{selected === index ? '✓ ' : ''}{choice}</Text>
                  </Pressable>
                ))}
              </View>
              {state.stage !== 'picking' && (
                <Text style={styles.secondary}>Your locked pick: {item.choices[selected]}</Text>
              )}
              {settled && (
                <View style={styles.result}>
                  <Text style={styles.secondary}>{item.simulatedResult}</Text>
                  <Text style={[styles.resultText, won ? styles.correct : styles.incorrect]}>
                    {won ? 'Correct · +100 points' : 'Incorrect · 0 points'}
                  </Text>
                </View>
              )}
            </View>
          );
        })}

        {state.stage === 'picking' && (
          <>
            <Text style={styles.secondary}>You can change any pick until you lock the slate.</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !ready }}
              disabled={!ready}
              onPress={() => dispatch({ type: 'lock' })}
              style={[styles.button, { backgroundColor: theme.surface }, !ready && styles.disabled]}
            >
              <Text style={styles.buttonText}>{ready ? `Lock ${pickCount === 1 ? 'your pick' : `all ${pickCount} picks`}` : 'Choose a pick for every question'}</Text>
            </Pressable>
          </>
        )}
        {state.stage === 'locked' && (
          <Pressable
            accessibilityRole="button"
            onPress={() => dispatch({ type: 'settle' })}
            style={[styles.button, { backgroundColor: theme.surface }]}
          >
            <Text style={styles.buttonText}>Simulate demo results</Text>
          </Pressable>
        )}
        {settled && (
          <View style={[styles.notice, { backgroundColor: theme.surface }]}>
            <Text style={styles.score}>{points} / {maxPoints}</Text>
            <Text style={styles.question}>{correct} of {pickCount} predictions correct</Text>
            <Text style={styles.secondary}>Practice points only. Rankings have not changed.</Text>
          </View>
        )}
        {state.stage !== 'picking' && (
          <Pressable accessibilityRole="button" onPress={sharePicks} style={[styles.shareButton, { backgroundColor: theme.surface }]}>
            <Text style={styles.buttonText}>{settled ? 'Share your result →' : 'Share your picks →'}</Text>
          </Pressable>
        )}
        {shareError ? <Text style={styles.secondary}>{shareError}</Text> : null}
        <Text style={styles.secondary}>
          This demo resets when the screen is reopened. Real schedules, start-time locks,
          saved predictions, and verified results will be connected later.
        </Text>
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#101218' },
  content: { padding: 24, paddingBottom: 40, gap: 20, width: '100%', maxWidth: 600, alignSelf: 'center' },
  link: { color: '#85B0FF', fontSize: 16, paddingVertical: 8 },
  label: { color: '#FFD477', fontSize: 12, fontWeight: '800', lineHeight: 18 },
  title: { color: '#FFFFFF', fontSize: 36, fontWeight: '900' },
  team: { color: '#85B0FF', fontSize: 18, fontWeight: '700' },
  notice: { padding: 20, backgroundColor: '#242331', borderRadius: 18, gap: 10 },
  noticeTitle: { color: '#FFD477', fontSize: 18, fontWeight: '800' },
  secondary: { color: '#BDC3D0', fontSize: 15, lineHeight: 23 },
  status: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  card: { backgroundColor: '#1D2230', padding: 20, borderRadius: 18, gap: 16 },
  question: { color: '#FFFFFF', fontSize: 21, fontWeight: '700', lineHeight: 29 },
  options: { gap: 12 },
  option: { padding: 16, borderRadius: 12, borderWidth: 2, borderColor: '#62718B', minHeight: 56, justifyContent: 'center' },
  selected: { borderColor: '#85B0FF', backgroundColor: '#233B65' },
  optionText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
  pressed: { opacity: 0.7 },
  result: { gap: 10, borderTopWidth: 1, borderTopColor: '#46516A', paddingTop: 16 },
  resultText: { fontSize: 17, fontWeight: '800' },
  correct: { color: '#81D9A4' },
  incorrect: { color: '#FF9CAA' },
  button: { backgroundColor: '#2357C7', padding: 18, minHeight: 58, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', textAlign: 'center' },
  disabled: { opacity: 0.45 },
  score: { color: '#FFD477', fontSize: 40, fontWeight: '900' },
  shareButton: { backgroundColor: '#34405C', padding: 18, borderRadius: 14, minHeight: 58, justifyContent: 'center' },
});
