import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { bostonTrivia, shuffle, type TriviaQuestion } from '@/constants/boston-content';
import { fanSections } from '@/constants/fan-sections';
import { useBostonDate } from '@/hooks/use-boston-date';
import { useScheduledPuzzle } from '@/hooks/use-scheduled-puzzle';
import { shareText } from '@/lib/share';
import { seededRandom, seededShuffle, usePersistentState } from '@/lib/daily';
import { formatCountdown, msUntilBostonMidnight } from '@/lib/dates';
import { queueRankedRound } from '@/lib/rankings';
import { recordResult } from '@/lib/stats';
import { Button, Card, Choice, type ChoiceState, FadeIn, ProgressBar, Row, Screen, Stat, Tag } from '@/ui/components';
import { haptic } from '@/ui/haptics';
import { palette, space, type } from '@/ui/tokens';

const boston = fanSections[3];
const PRACTICE_COUNT = 10;

type ScheduledQuestion = Pick<TriviaQuestion, 'prompt'> & { options: string[]; correct: number; source: string };
type RoundQuestion = (ScheduledQuestion | TriviaQuestion) & { order: number[]; fact?: string; source?: string };
type Round = { id: string; theme?: string; questions: RoundQuestion[] };

function isQuestion(value: unknown): value is ScheduledQuestion {
  if (!value || typeof value !== 'object') return false;
  const question = value as Partial<ScheduledQuestion>;
  return typeof question.prompt === 'string' && !!question.prompt.trim()
    && Array.isArray(question.options) && question.options.length === 3
    && question.options.every((option) => typeof option === 'string' && !!option.trim())
    && new Set(question.options).size === 3
    && typeof question.correct === 'number' && Number.isInteger(question.correct)
    && question.correct >= 0 && question.correct < 3
    && typeof question.source === 'string' && question.source.startsWith('https://');
}

function dailyRound(theme: string, data: unknown, date: string): Round | null {
  if (!theme.trim() || !data || typeof data !== 'object' || !('questions' in data)) return null;
  const { questions } = data;
  if (!Array.isArray(questions) || questions.length !== 3 || !questions.every(isQuestion)) return null;
  const random = seededRandom(`boston-trivia:${date}`);
  return {
    id: date, theme,
    questions: questions.map((question) => ({ ...question, order: seededShuffle([0, 1, 2], random) })),
  };
}

function practiceRound(): Round {
  return {
    id: `${Date.now()}`,
    questions: shuffle(bostonTrivia).slice(0, PRACTICE_COUNT).map((question) => ({ ...question, order: shuffle([0, 1, 2]) })),
  };
}

export default function BostonTriviaRoute() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const date = useBostonDate();
  return <BostonTriviaLoader key={`${date}:${mode ?? 'daily'}`} date={date} practice={mode === 'practice'} />;
}

function BostonTriviaLoader({ date, practice }: { date: string; practice: boolean }) {
  const [practiceKey, setPracticeKey] = useState(0);
  const { row, failed, retry } = useScheduledPuzzle('boston', date, !practice);
  const scheduled = row ? dailyRound(row.prompt, row.roster_data, date) : null;
  if (!practice && !scheduled) {
    const error = failed || !!row;
    return (
      <Screen section={boston} back={{ pathname: '/fan-challenges', params: { sport: 'boston' } }}
        backLabel="Boston challenges" title="Boston Trivia">
        <Text style={type.muted}>{error ? 'Could not load today’s trivia.' : row === null ? 'No quiz is scheduled today.' : 'Loading today’s trivia…'}</Text>
        {error && <Button label="Try again" variant="secondary" onPress={retry} />}
        {(error || row === null) && <Button label="Play practice trivia" onPress={() => router.push({ pathname: '/boston-trivia', params: { mode: 'practice' } })} />}
      </Screen>
    );
  }
  return (
    <BostonTrivia key={practice ? `practice:${practiceKey}` : date} date={date} scheduled={practice ? null : scheduled}
      onNewRound={() => setPracticeKey((value) => value + 1)} />
  );
}

type Progress = { answers: number[]; index: number };

function BostonTrivia({ date, scheduled, onNewRound }: { date: string; scheduled: Round | null; onNewRound: () => void }) {
  const practice = !scheduled;
  const [round] = useState(() => scheduled ?? practiceRound());
  const [progress, setProgress] = usePersistentState<Progress>(practice ? null : `daily:boston-trivia:scheduled:${date}`, { answers: [], index: 0 });
  const [shareError, setShareError] = useState('');
  const { answers, index } = progress;
  const total = round.questions.length;
  const question = round.questions[index];
  const answered = answers.length > index;
  const finished = index >= total;
  const score = answers.filter((answer, i) => answer === round.questions[i]?.correct).length;
  const streak = (() => {
    let run = 0;
    for (let i = answers.length - 1; i >= 0 && answers[i] === round.questions[i].correct; i--) run++;
    return run;
  })();
  const grid = round.questions.map((item, i) => answers[i] === item.correct ? '🟩' : '🟥').join('');

  function answer(option: number) {
    if (answered || finished) return;
    if (option === question.correct) haptic.success(); else haptic.error();
    setProgress({ ...progress, answers: [...answers, option] });
  }

  function next() {
    const nextIndex = index + 1;
    if (nextIndex >= total) {
      if (!practice) queueRankedRound({ p_game: 'boston-trivia', p_section: 'boston', p_date: date, p_answers: answers });
      recordResult({
        id: practice ? `boston-trivia:${round.id}` : `boston-trivia:daily:${date}`,
        game: 'boston-trivia', section: 'boston', score: score * 100, max: total * 100, practice,
        summary: `${score}/${total} correct`,
      });
    }
    setProgress({ ...progress, index: nextIndex });
  }

  async function share() {
    try {
      setShareError('');
      await shareText(`Stadium Pulse · Boston Trivia${practice ? '' : ` · ${date}`}\n${score}/${total} ${grid}\nThink you know Boston better than me?`);
    } catch {
      setShareError('Sharing could not open. Please try again.');
    }
  }

  return (
    <Screen
      section={boston}
      back={{ pathname: '/fan-challenges', params: { sport: 'boston' } }}
      backLabel="Boston challenges"
      eyebrow={practice ? `Practice · ${total} questions` : `${round.theme} · ${date}`}
      title="Boston Trivia"
      right={!finished && <Tag label={`${score} correct`} tone="accent" />}
    >
      {!finished ? (
        <FadeIn key={index} style={styles.stack}>
          <Row style={styles.between}>
            <Text style={type.eyebrow}>Question {index + 1} of {total}</Text>
            {streak >= 2 && <Text style={[type.eyebrow, { color: palette.gold }]}>🔥 {streak} in a row</Text>}
          </Row>
          <ProgressBar value={(index + (answered ? 1 : 0)) / total} />
          <Text accessibilityLiveRegion="polite" style={type.title}>{question.prompt}</Text>
          <View style={styles.stack}>
            {question.order.map((option) => {
              let state: ChoiceState = 'idle';
              if (answered) {
                if (option === question.correct) state = answers[index] === option ? 'correct' : 'reveal';
                else state = answers[index] === option ? 'incorrect' : 'dimmed';
              }
              return <Choice key={option} label={question.options[option]} state={state} disabled={answered} onPress={() => answer(option)} />;
            })}
          </View>
          {answered && (
            <FadeIn style={styles.stack}>
              <Card tone={answers[index] === question.correct ? 'success' : 'danger'}>
                <Text style={type.heading}>{answers[index] === question.correct ? 'Wicked smaht.' : `It’s ${question.options[question.correct]}.`}</Text>
                {!!question.fact && <Text style={type.muted}>{question.fact}</Text>}
                {question.source && <SourceLink url={question.source} />}
              </Card>
              <Button label={index === total - 1 ? 'See results' : 'Next question'} onPress={next} />
            </FadeIn>
          )}
        </FadeIn>
      ) : (
        <FadeIn style={styles.stack}>
          <Card tone="raised" style={styles.center}>
            <Text style={type.eyebrow}>{practice ? 'Practice score' : 'Today’s score'}</Text>
            <Text style={styles.big}>{score}<Text style={styles.bigOf}>/{total}</Text></Text>
            <Text style={type.heading}>
              {score === total ? 'Perfect. Townie status.' : score >= total * 0.8 ? 'Wicked smaht.' : score >= total / 2 ? 'Solid Bostonian.' : 'Time for a Duck Tour.'}
            </Text>
            <Text style={styles.grid}>{grid}</Text>
          </Card>
          <Row>
            <Stat value={`${Math.round((score / total) * 100)}%`} label="Accuracy" />
            {practice ? <Stat value={total - score} label="Missed" /> : <Stat value={formatCountdown(msUntilBostonMidnight())} label="Next daily" />}
          </Row>
          <Button label="Share your score" icon="↗" onPress={share} />
          {practice
            ? <Button label="Play a new round" variant="secondary" onPress={onNewRound} />
            : <Button label="Play 10 practice questions" variant="secondary" onPress={() => router.push({ pathname: '/boston-trivia', params: { mode: 'practice' } })} />}
          {!!shareError && <Text style={type.small}>{shareError}</Text>}
          <Text style={type.eyebrow}>Review</Text>
          {round.questions.map((item, i) => (
            <Card key={item.prompt} tone={answers[i] === item.correct ? 'default' : 'danger'} style={styles.review}>
              <Text style={type.body}>{answers[i] === item.correct ? '✓' : '✕'}  {item.prompt}</Text>
              <Text style={type.small}>{item.options[item.correct]}{item.fact ? ` · ${item.fact}` : ''}</Text>
              {item.source && <SourceLink url={item.source} />}
            </Card>
          ))}
          <Text style={type.small}>
            {practice ? 'Practice round. Scores stay on this device and never count.' : 'New scheduled trivia unlocks at midnight Boston time.'}
          </Text>
        </FadeIn>
      )}
    </Screen>
  );
}

function SourceLink({ url }: { url: string }) {
  return <Text accessibilityRole="link" style={styles.source} onPress={() => {
    void Linking.openURL(url).catch(() => {});
  }}>Source</Text>;
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  between: { justifyContent: 'space-between' },
  center: { alignItems: 'center', paddingVertical: space.xl },
  big: { ...type.number, fontSize: 72, lineHeight: 78 },
  bigOf: { fontSize: 32, color: palette.textMuted },
  grid: { fontSize: 18, letterSpacing: 2, marginTop: space.sm },
  review: { gap: 6, padding: 14 },
  source: { ...type.small, textDecorationLine: 'underline' },
});
