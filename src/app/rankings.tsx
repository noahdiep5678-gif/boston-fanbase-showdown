import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';

import { fanSections, getFanSection, teamLogos, type TeamId } from '@/constants/fan-sections';
import { bostonShortDate } from '@/lib/dates';
import { syncRankedRounds, type Ranking } from '@/lib/rankings';
import { DAILY_GAMES, dailyStreak, summarize, useLedger, type GameKind } from '@/lib/stats';
import { supabase } from '@/lib/supabase';
import { Button, Card, FadeIn, PressableScale, Row, Screen, Stat, Tag } from '@/ui/components';
import { useLayout } from '@/ui/layout';
import { palette, radius, space, type } from '@/ui/tokens';

const theme = { gameBackground: '#16201B', gameBackgroundDeep: '#0A0F0C', surface: '#1F2B25', accent: '#FFD166' } as const;
const teams = fanSections.filter((section) => section.id !== 'boston') as Extract<(typeof fanSections)[number], { id: TeamId }>[];
const boards = [{ id: 'superfans', name: 'Superfans' }, ...teams.map(({ id, name }) => ({ id, name }))] as const;

const gameNames: Record<GameKind, string> = {
  'wicked-smaht': 'Wicked Smaht',
  'mystery-player': 'Mystery Player',
  timeline: 'Timeline',
  'jersey-check': 'Jersey Check',
  'who-came-first': 'Who Came First?',
  'deep-cut': 'Deep Cut',
  'boston-trivia': 'Boston Trivia',
  'where-in-boston': 'Where in Boston?',
  predictions: 'Predictions',
};

export default function RankingsScreen() {
  const ledger = useLedger();
  const stats = summarize(ledger);
  const [board, setBoard] = useState<(typeof boards)[number]['id']>('superfans');
  const [refresh, setRefresh] = useState(0);
  const [standings, setStandings] = useState<{ board: typeof board; refresh: number; rows: Ranking[] | null }>();
  const rows = standings?.board === board && standings.refresh === refresh ? standings.rows : undefined;
  const personal = rows?.find((row) => row.is_you && row.place > 5);
  useFocusEffect(useCallback(() => {
    let current = true;
    let request = 0;
    async function load() {
      const id = ++request;
      await syncRankedRounds();
      const { data, error } = await supabase.rpc('weekly_fan_rankings', { p_board: board });
      if (current && id === request) setStandings({ board, refresh, rows: error ? null : data });
    }
    void load();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
    });
    return () => {
      current = false;
      subscription.remove();
    };
  }, [board, refresh]));
  const layout = useLayout();
  const recent = ledger.slice(0, layout.wide ? 12 : 8);

  const pulse = (
      <FadeIn>
        <Card tone="raised" style={styles.you}>
          <Row style={styles.between}>
            <Text style={type.eyebrow}>Your pulse</Text>
            <Tag label="This device" />
          </Row>
          <Row>
            <Stat value={stats.points.toLocaleString()} label="Points" color={theme.accent} />
            <Stat value={stats.scoredPlayed} label="Scored games" />
            <Stat value={stats.perfect} label="Perfect" />
          </Row>
          <View style={styles.streaks}>
            {teams.map((team) => {
              const streak = dailyStreak(ledger, DAILY_GAMES[team.id], team.id);
              return (
                <View key={team.id} style={styles.streak}>
                  <Image source={teamLogos[team.id]} style={styles.streakLogo} contentFit="contain" />
                  <Text style={styles.streakValue}>{streak > 0 ? `🔥 ${streak}` : '—'}</Text>
                  <Text style={type.small}>day streak</Text>
                </View>
              );
            })}
          </View>
          <Text style={type.small}>This device shows your game history and streaks. Weekly standings use points calculated by the server.</Text>
        </Card>
      </FadeIn>
  );

  const leaderboards = (
    <View style={styles.section}>
      <Text style={[type.title, styles.sectionTitle]}>Leaderboards</Text>
      <View style={styles.tabs} accessibilityRole="tablist">
        {boards.map((item) => {
          const selected = item.id === board;
          const color = getFanSection(item.id)?.accent ?? theme.accent;
          return (
            <PressableScale key={item.id} feedback="select" accessibilityRole="tab" accessibilityState={{ selected }}
              onPress={() => setBoard(item.id)}
              style={[styles.tab, selected && { backgroundColor: color, borderColor: color }]}>
              <Text style={[styles.tabText, selected && { color: palette.dark }]}>{item.name}</Text>
            </PressableScale>
          );
        })}
      </View>
      <Card>
        <Text style={type.heading}>{board === 'superfans' ? 'Boston Superfans' : `Top 5 ${boards.find((b) => b.id === board)?.name} fans`}</Text>
        <Text style={type.small}>
          {board === 'superfans' ? 'Combined ranked points from all three teams and Boston challenges. ' : ''}
          Scores reset Mondays at midnight Boston time. Each ranked round is worth up to 1,000 points.
        </Text>
        {rows === undefined && <Text style={type.muted}>Loading standings…</Text>}
        {rows === null && (
          <>
            <Text style={type.muted}>Weekly standings are unavailable.</Text>
            <Button label="Try again" variant="secondary" onPress={() => setRefresh((value) => value + 1)} />
          </>
        )}
        {rows?.length === 0 && <Text style={type.muted}>No scores yet this week.</Text>}
        {rows?.filter((row) => row.place <= 5).map((row) => <RankingRow key={row.place} row={row} />)}
        {personal && <RankingRow row={personal} />}
      </Card>
    </View>
  );

  const activity = (
    <View style={styles.section}>
      <Text style={[type.title, styles.sectionTitle]}>Recent activity</Text>
      {recent.length === 0 ? (
        <Card><Text style={type.muted}>Nothing yet. Play a daily puzzle to start your streak.</Text></Card>
      ) : (
        <Card style={styles.activity}>
          {recent.map((entry, index) => {
            const section = getFanSection(entry.section);
            return (
              <View key={entry.id} style={[styles.activityRow, index > 0 && styles.activityBorder]}>
                <View style={[styles.activityDot, { backgroundColor: section?.accent ?? palette.text }]} />
                <View style={styles.flex}>
                  <Text style={type.body}>{gameNames[entry.game]} · {section?.name}</Text>
                  <Text style={type.small}>{entry.summary ?? `${entry.score}/${entry.max}`} · {bostonShortDate.format(new Date(entry.at))}</Text>
                </View>
                {entry.practice ? <Tag label="Practice" /> : <Text style={styles.activityPoints}>+{entry.score}</Text>}
              </View>
            );
          })}
        </Card>
      )}
    </View>
  );

  return (
    <Screen section={theme} back="/" backLabel="Back to teams" eyebrow="Stadium Pulse" title="Rankings" desktopWidth={1120}>
      {layout.wide ? (
        <View style={styles.columns}>
          <View style={styles.column}>{pulse}{activity}</View>
          <View style={styles.column}>{leaderboards}</View>
        </View>
      ) : (
        <>{pulse}{leaderboards}{activity}</>
      )}
    </Screen>
  );
}

function RankingRow({ row }: { row: Ranking }) {
  return (
    <View style={styles.rankRow}>
      <Text style={[styles.rank, row.place === 1 && { color: theme.accent }]}>{row.place}</Text>
      <View style={styles.flex}>
        <Text style={type.body}>{row.fan_name}{row.is_you ? ' (you)' : ''}</Text>
        <Text style={type.small}>{row.rounds} {row.rounds === 1 ? 'round' : 'rounds'}</Text>
      </View>
      <Text style={styles.activityPoints}>{row.points.toLocaleString()} pts</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  between: { justifyContent: 'space-between' },
  you: { gap: space.lg },
  streaks: { flexDirection: 'row', gap: space.sm },
  streak: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: space.md, borderRadius: radius.md, backgroundColor: palette.overlay },
  streakLogo: { width: 34, height: 34 },
  streakValue: { color: palette.text, fontSize: 18, fontWeight: '800' },
  sectionTitle: { marginTop: space.md },
  section: { gap: space.lg },
  columns: { flexDirection: 'row', gap: space.xxl, alignItems: 'flex-start' },
  column: { flex: 1, gap: space.lg },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tab: { borderRadius: radius.pill, borderWidth: 1, borderColor: palette.borderStrong, paddingHorizontal: 14, paddingVertical: 8 },
  tabText: { color: palette.text, fontSize: 14, fontWeight: '700' },
  rankRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border },
  rank: { minWidth: 24, color: palette.textMuted, fontSize: 16, fontWeight: '900' },
  activity: { gap: 0, paddingVertical: space.sm },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  activityBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border },
  activityDot: { width: 8, height: 8, borderRadius: 4 },
  activityPoints: { color: palette.success, fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
