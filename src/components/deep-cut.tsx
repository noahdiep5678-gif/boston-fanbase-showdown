import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { shuffle } from '@/constants/boston-content';
import { deepCutPrompts, matchAnswer, tierNames, tierPoints, type DeepCutAnswer, type DeepCutPrompt, type Tier } from '@/constants/deep-cut';
import { getFanSection, type FanSection } from '@/constants/fan-sections';
import { shareText } from '@/lib/share';
import { seededRandom, seededShuffle, usePersistentState } from '@/lib/daily';
import { bostonDate, formatCountdown, msUntilBostonMidnight } from '@/lib/dates';
import { recordResult } from '@/lib/stats';
import { Button, Card, FadeIn, ProgressBar, Row, Screen, Stat, Tag, useRevealOnFocus } from '@/ui/components';
import { haptic } from '@/ui/haptics';
import { palette, radius, space, type } from '@/ui/tokens';

const PROMPTS = 3;
const SECONDS = 25;
const tierEmoji: Record<Tier, string> = { 1: '🟢', 2: '🔵', 3: '💎' };
const tierColor: Record<Tier, string> = { 1: palette.success, 2: '#7FB8FF', 3: palette.gold };

type Result = { input: string; answer: DeepCutAnswer | null };
type Progress = { index: number; results: Result[] };

export default function DeepCutRoute() {
  const { sport, mode } = useLocalSearchParams<{ sport?: string; mode?: string }>();
  const [round, setRound] = useState(0);
  const section = getFanSection(sport);
  if (!section) return <Redirect href="/" />;
  const practice = mode === 'practice';
  return (
    <DeepCut key={`${section.id}:${practice ? `practice:${round}` : 'daily'}`} section={section}
      practice={practice} onNewRound={() => setRound((value) => value + 1)} />
  );
}

function DeepCut({ section, practice, onNewRound }: { section: FanSection; practice: boolean; onNewRound: () => void }) {
  const date = bostonDate();
  const bank = deepCutPrompts[section.id];
  const [prompts] = useState<DeepCutPrompt[]>(() => (practice
    ? shuffle(bank)
    : seededShuffle(bank, seededRandom(`deep-cut:${section.id}:${date}`))).slice(0, Math.min(PROMPTS, bank.length)));
  const [progress, setProgress] = usePersistentState<Progress>(practice ? null : `daily:deep-cut:${section.id}:${date}`, { index: 0, results: [] });
  const [input, setInput] = useState('');
  const [hint, setHint] = useState('');
  const [deadline, setDeadline] = useState(() => Date.now() + SECONDS * 1000);
  const [now, setNow] = useState(Date.now);
  const [shareError, setShareError] = useState('');
  const [inputRef, revealInput] = useRevealOnFocus();

  const { index, results } = progress;
  const total = prompts.length;
  const finished = index >= total;
  const prompt = prompts[index];
  const answered = results.length > index;
  const result = results[index];
  const left = Math.max(0, deadline - now);
  const score = results.reduce((sum, r) => sum + (r.answer ? tierPoints[r.answer.tier] : 0), 0);

  const submit = useCallback((text: string) => {
    if (finished || results.length !== index) return;
    const match = matchAnswer(text, prompt.answers);
    if (match.kind === 'ambiguous' && Date.now() < deadline) {
      haptic.warning();
      setHint(`Which one? ${match.options.map((o) => o.name).join(' or ')}. Type the full name.`);
      return;
    }
    const answer = match.kind === 'match' ? match.answer : null;
    if (answer) {
      if (answer.tier === 3) haptic.heavy();
      haptic.success();
    } else haptic.error();
    setHint('');
    setProgress({ index, results: [...results, { input: text.trim(), answer }] });
  }, [deadline, finished, index, prompt, results, setProgress]);

  useEffect(() => {
    if (finished || answered) return;
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= deadline) submit(input);
    }, 200);
    return () => clearInterval(timer);
  }, [answered, deadline, finished, input, submit]);

  useEffect(() => {
    if (!finished || results.length === 0) return;
    recordResult({
      id: practice ? `deep-cut:${section.id}:practice:${Date.now()}` : `deep-cut:${section.id}:${date}`,
      game: 'deep-cut', section: section.id, score, max: total * tierPoints[3], practice,
      summary: `${results.filter((r) => r.answer).length}/${total} · ${score} pts`,
    });
    // Record once when the round ends.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  function next() {
    setInput('');
    setHint('');
    setProgress({ ...progress, index: index + 1 });
    setDeadline(Date.now() + SECONDS * 1000);
    setNow(Date.now());
  }

  const rarest = useMemo(() => {
    if (!prompt) return [];
    return prompt.answers.filter((a) => a.tier === 3 && a.name !== result?.answer?.name).slice(0, 4);
  }, [prompt, result]);

  const grid = results.map((r) => r.answer ? tierEmoji[r.answer.tier] : '⬛').join('');

  async function share() {
    try {
      setShareError('');
      await shareText(`Stadium Pulse · ${section.name} Deep Cut${practice ? ' (practice)' : ` · ${date}`}\n${score} pts ${grid}\n🟢 popular · 🔵 real fan · 💎 deep cut`);
    } catch {
      setShareError('Sharing could not open.');
    }
  }

  return (
    <Screen
      section={section}
      back={{ pathname: '/fan-challenges', params: { sport: section.id } }}
      backLabel={`${section.name} challenges`}
      eyebrow={practice ? `${section.name} · Practice` : `${section.name} · Daily · ${date}`}
      title="Deep Cut"
      right={<Tag label={`${score} pts`} tone="accent" />}
    >
      {!finished ? (
        <FadeIn key={index} style={styles.stack}>
          <Row style={styles.between}>
            <Text style={type.eyebrow}>Prompt {index + 1} of {total}</Text>
            {!answered && <Text style={[type.eyebrow, left < 6000 && { color: palette.danger }]}>{Math.ceil(left / 1000)}s</Text>}
          </Row>
          <ProgressBar value={answered ? 1 : left / (SECONDS * 1000)} color={!answered && left < 6000 ? palette.danger : section.accent} height={4} />
          <Card tone="raised">
            <Text style={type.title}>{prompt.prompt}</Text>
            <Text style={type.small}>
              Any correct answer counts. The rarer it is, the more it’s worth: 100 · 250 · 500.
            </Text>
          </Card>
          {!answered ? (
            <View ref={inputRef} collapsable={false} style={styles.stack}>
              <TextInput
                onFocus={revealInput}
                autoFocus
                value={input}
                onChangeText={(text) => { setInput(text); if (hint) setHint(''); }}
                onSubmitEditing={() => submit(input)}
                placeholder="Type your answer…"
                placeholderTextColor={palette.textFaint}
                autoCorrect={false}
                autoCapitalize="words"
                keyboardAppearance="dark"
                returnKeyType="done"
                submitBehavior="submit"
                accessibilityLabel={`Answer: ${prompt.prompt}`}
                style={[styles.input, { borderColor: input ? section.accent : palette.border }]}
              />
              {!!hint && <Text style={[type.small, { color: palette.gold }]} accessibilityLiveRegion="polite">{hint}</Text>}
              <Button label="Lock it in" disabled={!input.trim()} onPress={() => submit(input)} feedback={null} />
            </View>
          ) : (
            <FadeIn style={styles.stack}>
              {result.answer ? (
                <Card tone="success">
                  <Row style={styles.between}>
                    <Text style={[type.eyebrow, { color: tierColor[result.answer.tier] }]}>
                      {tierEmoji[result.answer.tier]} {tierNames[result.answer.tier]}
                    </Text>
                    <Text style={styles.points}>+{tierPoints[result.answer.tier]}</Text>
                  </Row>
                  <Text style={type.title}>{result.answer.name}</Text>
                </Card>
              ) : (
                <Card tone="danger">
                  <Text style={type.heading}>{result.input ? `“${result.input}” isn’t on the list.` : 'Time’s up.'}</Text>
                  <Text style={type.small}>No points this time.</Text>
                </Card>
              )}
              {rarest.length > 0 && (
                <Card>
                  <Text style={type.eyebrow}>💎 Deep cuts you could have had</Text>
                  <Text style={type.body}>{rarest.map((a) => a.name).join(' · ')}</Text>
                  <Text style={type.small}>{prompt.answers.length} correct answers in all.</Text>
                </Card>
              )}
              <Button label={index === total - 1 ? 'See results' : 'Next prompt'} onPress={next} />
            </FadeIn>
          )}
        </FadeIn>
      ) : (
        <FadeIn style={styles.stack}>
          <Card tone="raised" style={styles.center}>
            <Text style={type.eyebrow}>{practice ? 'Practice score' : 'Today’s score'}</Text>
            <Text style={styles.big}>{score}</Text>
            <Text style={styles.grid}>{grid}</Text>
          </Card>
          {results.map((r, i) => (
            <Card key={prompts[i].id} style={styles.review}>
              <Text style={type.small}>{prompts[i].prompt}</Text>
              <Row style={styles.between}>
                <Text style={type.body}>{r.answer ? `${tierEmoji[r.answer.tier]} ${r.answer.name}` : `⬛ ${r.input || 'No answer'}`}</Text>
                <Text style={[styles.reviewPoints, { color: r.answer ? tierColor[r.answer.tier] : palette.textFaint }]}>
                  {r.answer ? `+${tierPoints[r.answer.tier]}` : '0'}
                </Text>
              </Row>
            </Card>
          ))}
          {!practice && (
            <Row>
              <Stat value={formatCountdown(msUntilBostonMidnight())} label="Next daily" />
              <Stat value={results.filter((r) => r.answer?.tier === 3).length} label="Deep cuts" color={palette.gold} />
            </Row>
          )}
          <Button label="Share score" icon="↗" onPress={share} />
          {practice
            ? <Button label="New practice round" variant="secondary" onPress={onNewRound} />
            : <Button label="Play a practice round" variant="secondary" onPress={() => router.setParams({ mode: 'practice' })} />}
          {!!shareError && <Text style={type.small}>{shareError}</Text>}
        </FadeIn>
      )}
      <Text style={type.small}>Rarity tiers are set by Stadium Pulse editors. Typos and last names are usually fine.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  between: { justifyContent: 'space-between' },
  center: { alignItems: 'center', paddingVertical: space.xl },
  input: {
    color: palette.text, backgroundColor: palette.overlay, borderWidth: 1.5,
    borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: 16, fontSize: 19, fontWeight: '600',
  },
  points: { color: palette.text, fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'] },
  big: { ...type.number, fontSize: 64, lineHeight: 70 },
  grid: { fontSize: 22, letterSpacing: 4, marginTop: space.sm },
  review: { gap: 6, padding: 14 },
  reviewPoints: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
