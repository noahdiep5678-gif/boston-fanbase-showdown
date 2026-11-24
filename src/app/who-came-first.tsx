import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getFanSection, type FanSection, type TeamId } from '@/constants/fan-sections';
import { franchisePlayers, positionNames, seasonLabel, type FranchisePlayer } from '@/constants/franchise-players';
import { shareText } from '@/lib/share';
import { usePersistentState } from '@/lib/daily';
import { recordResult } from '@/lib/stats';
import { Button, Card, FadeIn, PressableScale, Row, Screen, Stat, Tag } from '@/ui/components';
import { haptic } from '@/ui/haptics';
import { palette, radius, space, type } from '@/ui/tokens';

type Pair = [FranchisePlayer, FranchisePlayer];

/** Two players with different debut seasons, avoiding the previous pair where possible. */
function nextPair(team: TeamId, previous?: Pair): Pair {
  const players = franchisePlayers[team];
  for (let attempt = 0; attempt < 50; attempt++) {
    const a = players[Math.floor(Math.random() * players.length)];
    const b = players[Math.floor(Math.random() * players.length)];
    if (a.debut === b.debut) continue;
    if (previous && (previous.includes(a) || previous.includes(b)) && attempt < 40) continue;
    return [a, b];
  }
  return [players[0], players[players.length - 1]];
}

export default function WhoCameFirstRoute() {
  const { sport } = useLocalSearchParams<{ sport?: string }>();
  const section = getFanSection(sport);
  if (!section || section.id === 'boston') return <Redirect href="/" />;
  return <WhoCameFirst key={section.id} section={section} team={section.id} />;
}

function WhoCameFirst({ section, team }: { section: FanSection; team: TeamId }) {
  const [pair, setPair] = useState<Pair>(() => nextPair(team));
  const [streak, setStreak] = useState(0);
  const [picked, setPicked] = useState<FranchisePlayer | null>(null);
  const [over, setOver] = useState(false);
  const [best, setBest] = usePersistentState<number>(`best:who-came-first:${team}`, 0);
  const [gameId, setGameId] = useState(() => `${Date.now()}`);
  const [shareError, setShareError] = useState('');
  const earlier = pair[0].debut < pair[1].debut ? pair[0] : pair[1];

  function pick(player: FranchisePlayer) {
    if (picked) return;
    setPicked(player);
    if (player === earlier) {
      haptic.success();
      const next = streak + 1;
      setStreak(next);
      if (next > best) setBest(next);
    } else {
      haptic.error();
      setOver(true);
      recordResult({ id: `who-came-first:${team}:${gameId}`, game: 'who-came-first', section: team, score: streak * 100, max: Math.max(streak, 1) * 100, practice: true, summary: `Streak of ${streak}` });
    }
  }

  function advance() {
    setPair(nextPair(team, pair));
    setPicked(null);
  }

  function restart() {
    setStreak(0);
    setOver(false);
    setGameId(`${Date.now()}`);
    advance();
  }

  async function share() {
    try {
      setShareError('');
      await shareText(`Stadium Pulse · ${section.name} Who Came First?\nStreak: ${streak} 🔥 · Best: ${best}\nCan you beat it?`);
    } catch {
      setShareError('Sharing could not open.');
    }
  }

  return (
    <Screen
      section={section}
      back={{ pathname: '/fan-challenges', params: { sport: team } }}
      backLabel={`${section.name} challenges`}
      eyebrow={`${section.name} · Endless`}
      title="Who Came First?"
      right={<Tag label={`Best ${best}`} tone="gold" />}
    >
      <Row>
        <Stat value={`🔥 ${streak}`} label="Streak" color={section.accent} />
        <Stat value={best} label="Best" />
      </Row>
      <Text style={type.heading}>Who played for the {section.name} first?</Text>
      <FadeIn key={`${pair[0].name}:${pair[1].name}`} style={styles.stack}>
        {pair.map((player, i) => {
          const revealed = !!picked;
          const isEarlier = player === earlier;
          return (
            <View key={player.name} style={styles.stack}>
              <PressableScale feedback={null} disabled={revealed} onPress={() => pick(player)}
                accessibilityRole="button" accessibilityLabel={`${player.name}${revealed ? `, first season ${seasonLabel(team, player.debut)}` : ''}`}
                style={[styles.player, { backgroundColor: section.surface },
                  revealed && isEarlier && styles.right,
                  revealed && picked === player && !isEarlier && styles.wrong]}>
                <Text style={type.title}>{player.name}</Text>
                <Text style={type.small}>{positionNames[team][player.position]} · #{player.number}</Text>
                {revealed && (
                  <Text style={[styles.year, { color: isEarlier ? palette.success : palette.textMuted }]}>
                    {seasonLabel(team, player.debut)}
                  </Text>
                )}
              </PressableScale>
              {i === 0 && <Text style={[type.eyebrow, styles.vs]}>or</Text>}
            </View>
          );
        })}
      </FadeIn>
      {picked && !over && <Button label="Next pair" onPress={advance} />}
      {over && (
        <FadeIn style={styles.stack}>
          <Card tone="danger">
            <Text style={type.heading}>Streak over at {streak}.</Text>
            <Text style={type.small}>{earlier.name} got there first — {seasonLabel(team, earlier.debut)}.</Text>
          </Card>
          <Button label="Play again" onPress={restart} />
          <Button label="Share streak" icon="↗" variant="secondary" onPress={share} />
          {!!shareError && <Text style={type.small}>{shareError}</Text>}
        </FadeIn>
      )}
      <Text style={type.small}>Endless practice. Your best streak is saved on this device.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.sm },
  player: { borderRadius: radius.lg, padding: space.xl, gap: 4, borderWidth: 1.5, borderColor: palette.border, minHeight: 110, justifyContent: 'center' },
  right: { borderColor: palette.success, backgroundColor: palette.successBg },
  wrong: { borderColor: palette.danger, backgroundColor: palette.dangerBg },
  year: { fontSize: 22, fontWeight: '900', marginTop: 4, fontVariant: ['tabular-nums'] },
  vs: { textAlign: 'center' },
});
