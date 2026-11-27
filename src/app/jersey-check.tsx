import { Redirect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { shuffle } from '@/constants/boston-content';
import { getFanSection, type FanSection, type TeamId } from '@/constants/fan-sections';
import { franchisePlayers, positionNames, seasonLabel, type FranchisePlayer } from '@/constants/franchise-players';
import { shareText } from '@/lib/share';
import { recordResult } from '@/lib/stats';
import { Button, Card, Choice, type ChoiceState, FadeIn, ProgressBar, Row, Screen, Stat, Tag } from '@/ui/components';
import { haptic } from '@/ui/haptics';
import { palette, space, type } from '@/ui/tokens';

const ROUNDS = 10;
const SECONDS = 10;

type Question = { answer: FranchisePlayer; options: FranchisePlayer[] };

function buildRound(team: TeamId): Question[] {
  const players = franchisePlayers[team];
  return shuffle(players).slice(0, ROUNDS).map((answer) => {
    // Never offer a second player who wore the same number.
    const decoys = shuffle(players.filter((p) => p.number !== answer.number)).slice(0, 3);
    return { answer, options: shuffle([answer, ...decoys]) };
  });
}

export default function JerseyCheckRoute() {
  const { sport } = useLocalSearchParams<{ sport?: string }>();
  const section = getFanSection(sport);
  if (!section || section.id === 'boston') return <Redirect href="/" />;
  return <JerseyCheck key={section.id} section={section} team={section.id} />;
}

function JerseyCheck({ section, team }: { section: FanSection; team: TeamId }) {
  const [round, setRound] = useState(() => ({ id: `${Date.now()}`, questions: buildRound(team) }));
  const [index, setIndex] = useState(0);
  const [picks, setPicks] = useState<(string | null)[]>([]);
  const [points, setPoints] = useState(0);
  const [deadline, setDeadline] = useState(() => Date.now() + SECONDS * 1000);
  const [now, setNow] = useState(Date.now);
  const [shareError, setShareError] = useState('');
  const finished = index >= ROUNDS;
  const question = round.questions[index];
  const answered = picks.length > index;
  const left = Math.max(0, deadline - now);
  const correctCount = picks.filter((pick, i) => pick === round.questions[i].answer.name).length;

  const answer = useCallback((name: string | null) => {
    if (picks.length !== index) return;
    if (name === round.questions[index].answer.name) {
      haptic.success();
      setPoints((p) => p + 50 + Math.ceil(Math.max(0, deadline - Date.now()) / 1000) * 5);
    } else haptic.error();
    setPicks([...picks, name]);
  }, [deadline, index, picks, round.questions]);

  useEffect(() => {
    if (finished || answered) return;
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= deadline) answer(null);
    }, 200);
    return () => clearInterval(timer);
  }, [answer, answered, deadline, finished]);

  function next() {
    const nextIndex = index + 1;
    if (nextIndex >= ROUNDS) {
      recordResult({ id: `jersey-check:${team}:${round.id}`, game: 'jersey-check', section: team, score: points, max: ROUNDS * 100, practice: true, summary: `${correctCount}/${ROUNDS} correct` });
    }
    setIndex(nextIndex);
    setDeadline(Date.now() + SECONDS * 1000);
    setNow(Date.now());
  }

  function restart() {
    setRound({ id: `${Date.now()}`, questions: buildRound(team) });
    setIndex(0);
    setPicks([]);
    setPoints(0);
    setDeadline(Date.now() + SECONDS * 1000);
    setNow(Date.now());
  }

  async function share() {
    try {
      setShareError('');
      const grid = round.questions.map((q, i) => picks[i] === q.answer.name ? '🟩' : '🟥').join('');
      await shareText(`Stadium Pulse · ${section.name} Jersey Check\n${points} pts · ${correctCount}/${ROUNDS} ${grid}`);
    } catch {
      setShareError('Sharing could not open.');
    }
  }

  return (
    <Screen
      section={section}
      back={{ pathname: '/fan-challenges', params: { sport: team } }}
      backLabel={`${section.name} challenges`}
      eyebrow={`${section.name} · Quick-fire practice`}
      title="Jersey Check"
      right={<Tag label={`${points} pts`} tone="accent" />}
    >
      {!finished ? (
        <FadeIn key={index} style={styles.stack}>
          <Row style={styles.between}>
            <Text style={type.eyebrow}>{index + 1} of {ROUNDS}</Text>
            {!answered && <Text style={[type.eyebrow, left < 3000 && { color: palette.danger }]}>{Math.ceil(left / 1000)}s</Text>}
          </Row>
          <ProgressBar value={answered ? 0 : left / (SECONDS * 1000)} color={left < 3000 ? palette.danger : section.accent} height={4} />
          <Card tone="raised" style={styles.jerseyCard}>
            <View style={[styles.jersey, { borderColor: section.accent }]}>
              <Text style={[styles.jerseyNumber, { color: section.accent }]}>{question.answer.number}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={type.title}>Who wore #{question.answer.number}?</Text>
              <Text style={type.small}>
                {positionNames[team][question.answer.position]} · first season {seasonLabel(team, question.answer.debut)}
              </Text>
            </View>
          </Card>
          {question.options.map((option) => {
            let state: ChoiceState = 'idle';
            if (answered) {
              if (option.name === question.answer.name) state = picks[index] === option.name ? 'correct' : 'reveal';
              else state = picks[index] === option.name ? 'incorrect' : 'dimmed';
            }
            return <Choice key={option.name} label={option.name} state={state} disabled={answered} onPress={() => answer(option.name)} />;
          })}
          {answered && (
            <FadeIn style={styles.stack}>
              <Text style={[type.muted, { color: picks[index] === question.answer.name ? palette.success : palette.danger }]}>
                {picks[index] === question.answer.name ? 'Nailed it.' : picks[index] === null ? `Time! It was ${question.answer.name}.` : `It was ${question.answer.name}.`}
              </Text>
              <Button label={index === ROUNDS - 1 ? 'See results' : 'Next jersey'} onPress={next} />
            </FadeIn>
          )}
        </FadeIn>
      ) : (
        <FadeIn style={styles.stack}>
          <Card tone="raised" style={styles.center}>
            <Text style={type.eyebrow}>Final score</Text>
            <Text style={styles.big}>{points}</Text>
            <Text style={type.muted}>{correctCount} of {ROUNDS} correct · faster answers earn more</Text>
          </Card>
          <Row>
            <Stat value={`${correctCount}/${ROUNDS}`} label="Correct" color={section.accent} />
            <Stat value={ROUNDS - correctCount} label="Missed" />
          </Row>
          <Button label="Share score" icon="↗" onPress={share} />
          <Button label="Play again" variant="secondary" onPress={restart} />
          {!!shareError && <Text style={type.small}>{shareError}</Text>}
          <Text style={type.small}>Practice game. Scores stay on this device and never count toward rankings.</Text>
        </FadeIn>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stack: { gap: space.md },
  between: { justifyContent: 'space-between' },
  center: { alignItems: 'center', paddingVertical: space.xl },
  jerseyCard: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  jersey: { width: 76, height: 84, borderRadius: 14, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  jerseyNumber: { fontSize: 36, fontWeight: '900', fontVariant: ['tabular-nums'] },
  big: { ...type.number, fontSize: 64, lineHeight: 70 },
});
