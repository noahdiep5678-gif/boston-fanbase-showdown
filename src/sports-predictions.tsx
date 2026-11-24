import { useReducer, useState } from 'react';
import { Link, Redirect, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getFanSection } from '@/constants/fan-sections';

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
    : allPredictions;
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
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Link
          href={sportId ? { pathname: '/fan-challenges', params: { sport: sportId } } : '/'}
          style={styles.link}
        >← Back to challenges</Link>
        <Text style={styles.label}>BOSTON SPORTS · DEMO</Text>
        <Text style={styles.title}>Make your picks.</Text>
        <Text style={styles.team}>{categoryName} challenges</Text>
        <View style={styles.notice}>
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
            <View key={item.id} style={styles.card}>
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
                    style={({ pressed }) => [styles.option, selected === index && styles.selected, pressed && styles.pressed]}
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
              style={[styles.button, !ready && styles.disabled]}
            >
              <Text style={styles.buttonText}>{ready ? `Lock ${pickCount === 1 ? 'your pick' : `all ${pickCount} picks`}` : 'Choose a pick for every question'}</Text>
            </Pressable>
          </>
        )}
        {state.stage === 'locked' && (
          <Pressable
            accessibilityRole="button"
            onPress={() => dispatch({ type: 'settle' })}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Simulate demo results</Text>
          </Pressable>
        )}
        {settled && (
          <View style={styles.notice}>
            <Text style={styles.score}>{points} / {maxPoints}</Text>
            <Text style={styles.question}>{correct} of {pickCount} predictions correct</Text>
            <Text style={styles.secondary}>Practice points only. Rankings have not changed.</Text>
          </View>
        )}
        {state.stage !== 'picking' && (
          <Pressable accessibilityRole="button" onPress={sharePicks} style={styles.shareButton}>
            <Text style={styles.buttonText}>{settled ? 'Share your result →' : 'Share your picks →'}</Text>
          </Pressable>
        )}
        {shareError ? <Text style={styles.secondary}>{shareError}</Text> : null}
        <Text style={styles.secondary}>
          This demo resets when the screen is reopened. Real schedules, start-time locks,
          saved predictions, and verified results will be connected later.
        </Text>
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
