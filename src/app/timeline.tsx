import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getFanSection, type FanSection } from '@/constants/fan-sections';
import { timelineEvents, type TimelineEvent } from '@/constants/franchise-timelines';
import { shareText } from '@/lib/share';
import { seededRandom, seededShuffle, usePersistentState } from '@/lib/daily';
import { bostonDate } from '@/lib/dates';
import { recordResult } from '@/lib/stats';
import { Button, Card, FadeIn, PressableScale, Row, Screen, Stat, Tag } from '@/ui/components';
import { haptic } from '@/ui/haptics';
import { palette, radius, space, type } from '@/ui/tokens';

const COUNT = 5;
const POINTS = 200;

/** Picks COUNT events with distinct years so there is exactly one correct order. */
function pickEvents(events: TimelineEvent[], seed: string) {
  const random = seededRandom(seed);
  const chosen: TimelineEvent[] = [];
  for (const event of seededShuffle(events, random)) {
    if (chosen.some((item) => item.year === event.year)) continue;
    chosen.push(event);
    if (chosen.length === COUNT) break;
  }
  return chosen;
}

export default function TimelineRoute() {
  const { sport, mode } = useLocalSearchParams<{ sport?: string; mode?: string }>();
  const [round, setRound] = useState(0);
  const section = getFanSection(sport);
  if (!section) return <Redirect href="/" />;
  const practice = mode === 'practice';
  return (
    <Timeline key={`${section.id}:${practice ? `practice:${round}` : 'daily'}`} section={section}
      practice={practice} onNewRound={() => setRound((value) => value + 1)} />
  );
}

type Saved = { order: string[]; checked: boolean };

function Timeline({ section, practice, onNewRound }: { section: FanSection; practice: boolean; onNewRound: () => void }) {
  const date = bostonDate();
  const [seed] = useState(() => practice ? `${Math.random()}` : `timeline:${section.id}:${date}`);
  const events = useMemo(() => pickEvents(timelineEvents[section.id], seed), [section.id, seed]);
  const shown = useMemo(() => seededShuffle(events, seededRandom(`${seed}:display`)), [events, seed]);
  const correct = useMemo(() => [...events].sort((a, b) => a.year - b.year), [events]);
  const [saved, setSaved] = usePersistentState<Saved>(practice ? null : `daily:timeline:${section.id}:${date}`, { order: [], checked: false });
  const [shareError, setShareError] = useState('');

  const placed = saved.order.map((text) => events.find((e) => e.text === text)).filter((e): e is TimelineEvent => !!e);
  const remaining = shown.filter((e) => !saved.order.includes(e.text));
  const hits = placed.map((event, i) => correct[i]?.text === event.text);
  const hitCount = hits.filter(Boolean).length;
  const score = hitCount * POINTS;

  useEffect(() => {
    if (!saved.checked) return;
    recordResult({
      id: practice ? `timeline:${section.id}:practice:${seed}` : `timeline:${section.id}:${date}`,
      game: 'timeline', section: section.id, score, max: COUNT * POINTS, practice,
      summary: `${hitCount}/${COUNT} in place`,
    });
  }, [date, hitCount, practice, saved.checked, score, section.id, seed]);

  function place(event: TimelineEvent) {
    if (saved.checked) return;
    haptic.select();
    setSaved({ ...saved, order: [...saved.order, event.text] });
  }

  function undo() {
    if (saved.checked || saved.order.length === 0) return;
    setSaved({ ...saved, order: saved.order.slice(0, -1) });
  }

  function check() {
    if (placed.length !== COUNT) return;
    const total = correct.filter((event, i) => saved.order[i] === event.text).length;
    if (total === COUNT) haptic.success(); else if (total >= 3) haptic.warning(); else haptic.error();
    setSaved({ ...saved, checked: true });
  }

  const grid = hits.map((hit) => hit ? '🟩' : '🟥').join('');

  async function share() {
    try {
      setShareError('');
      await shareText(`Stadium Pulse · ${section.name} Timeline${practice ? ' (practice)' : ` · ${date}`}\n${hitCount}/${COUNT} ${grid}`);
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
      title="Timeline"
      right={saved.checked ? <Tag label={`${score} pts`} tone="accent" /> : <Tag label={`${placed.length}/${COUNT}`} tone="accent" />}
    >
      <Card>
        <Text style={type.heading}>Put these moments in order.</Text>
        <Text style={type.small}>Tap the earliest moment first. One shot — check when all five are placed.</Text>
      </Card>

      <View style={styles.stack}>
        {Array.from({ length: COUNT }, (_, i) => {
          const event = placed[i];
          const hit = hits[i];
          return (
            <View key={i} style={[styles.slot,
              event && { borderColor: section.accent, borderStyle: 'solid' },
              saved.checked && (hit ? styles.slotHit : styles.slotMiss)]}>
              <Text style={[styles.slotIndex, event && { color: section.accent }]}>{i + 1}</Text>
              <View style={styles.flex}>
                <Text style={[type.body, !event && { color: palette.textFaint }]}>
                  {event ? event.text : i === 0 ? 'Earliest' : i === COUNT - 1 ? 'Most recent' : '—'}
                </Text>
                {saved.checked && event && (
                  <Text style={[type.small, { color: hit ? palette.success : palette.danger }]}>
                    {event.year}{hit ? '' : ` · this spot was ${correct[i].year}`}
                  </Text>
                )}
              </View>
              {saved.checked && <Text style={[styles.mark, { color: hit ? palette.success : palette.danger }]}>{hit ? '✓' : '✕'}</Text>}
            </View>
          );
        })}
      </View>

      {!saved.checked && remaining.length > 0 && (
        <View style={styles.stack}>
          <Text style={type.eyebrow}>Tap to place next</Text>
          {remaining.map((event) => (
            <PressableScale key={event.text} feedback={null} onPress={() => place(event)}
              accessibilityRole="button" accessibilityLabel={`Place: ${event.text}`}
              style={[styles.option, { backgroundColor: section.surface }]}>
              <Text style={type.body}>{event.text}</Text>
            </PressableScale>
          ))}
        </View>
      )}

      {!saved.checked && (
        <Row gap={space.sm}>
          <View style={styles.flex}><Button label="Undo" variant="secondary" disabled={placed.length === 0} onPress={undo} /></View>
          <View style={styles.flex}><Button label="Check order" disabled={placed.length !== COUNT} onPress={check} feedback={null} /></View>
        </Row>
      )}

      {saved.checked && (
        <FadeIn style={styles.stack}>
          <Row>
            <Stat value={`${hitCount}/${COUNT}`} label="In place" color={section.accent} />
            <Stat value={score} label="Points" />
          </Row>
          {!!grid && <Text style={styles.grid}>{grid}</Text>}
          <Button label="Share result" icon="↗" onPress={share} />
          {practice
            ? <Button label="New timeline" variant="secondary" onPress={onNewRound} />
            : <Button label="Play a practice round" variant="secondary" onPress={() => router.push({ pathname: '/timeline', params: { sport: section.id, mode: 'practice' } })} />}
          {!!shareError && <Text style={type.small}>{shareError}</Text>}
        </FadeIn>
      )}
      <Text style={type.small}>{practice ? 'Practice round — doesn’t count toward your stats.' : 'A new timeline every day at midnight Boston time.'}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stack: { gap: space.sm },
  slot: {
    minHeight: 58, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: palette.borderStrong,
    flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm,
  },
  slotHit: { borderColor: palette.success, backgroundColor: palette.successBg },
  slotMiss: { borderColor: palette.danger, backgroundColor: palette.dangerBg },
  slotIndex: { color: palette.textFaint, fontSize: 18, fontWeight: '900', width: 20 },
  mark: { fontSize: 20, fontWeight: '900' },
  option: { borderRadius: radius.md, padding: space.lg, borderWidth: 1, borderColor: palette.border },
  grid: { fontSize: 20, letterSpacing: 3, textAlign: 'center' },
});
