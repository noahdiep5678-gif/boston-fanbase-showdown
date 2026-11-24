import { Image } from 'expo-image';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { getFanSection, teamLogos } from '@/constants/fan-sections';
import { gamesFor, type GameEntry } from '@/constants/games';
import { DAILY_GAMES, dailyStreak, hasPlayed, useLedger } from '@/lib/stats';
import { FadeIn, PressableScale, Row, Screen, Tag } from '@/ui/components';
import { useLayout } from '@/ui/layout';
import { palette, radius, space, type } from '@/ui/tokens';

type Badge = { label: string; tone: 'accent' | 'success' | 'gold' | 'neutral' };

export default function FanChallengesScreen() {
  const { sport } = useLocalSearchParams<{ sport?: string }>();
  const section = getFanSection(sport);
  const ledger = useLedger();
  const layout = useLayout();
  if (!section) return <Redirect href="/" />;

  const isCity = section.id === 'boston';
  const dailies = DAILY_GAMES[section.id];
  const streak = dailyStreak(ledger, dailies, section.id);
  const doneToday = dailies.filter((game) => hasPlayed(ledger, game, section.id)).length;
  const games = gamesFor(section);

  const badge = (entry: GameEntry): Badge => {
    if (entry.cadence === 'daily') {
      return hasPlayed(ledger, entry.game, section.id) ? { label: '✓ Played today', tone: 'success' } : { label: 'Daily', tone: 'accent' };
    }
    if (entry.cadence === 'live') return { label: 'Live', tone: 'gold' };
    if (entry.cadence === 'endless') return { label: 'Endless', tone: 'neutral' };
    return { label: 'Practice', tone: 'neutral' };
  };

  const columns = layout.xwide ? 3 : layout.wide ? 2 : 1;

  return (
    <Screen
      section={section}
      back="/"
      backLabel="Back to teams"
      desktopWidth={1120}
      right={streak > 0 ? <Tag label={`🔥 ${streak} day streak`} tone="gold" /> : undefined}
    >
      <FadeIn style={[styles.hero, layout.wide && styles.heroWide]}>
        {isCity
          ? <Text style={[styles.city, { color: section.accent }]}>BOSTON</Text>
          : <Image source={teamLogos[section.id]} style={[styles.logo, layout.wide && styles.logoWide]} contentFit="contain" accessibilityIgnoresInvertColors />}
        <View style={styles.heroText}>
          <Text accessibilityRole="header" style={[type.display, layout.wide && styles.displayWide]}>
            {isCity ? 'City challenges' : `${section.name} challenges`}
          </Text>
          <Text style={type.muted}>{section.tagline}</Text>
          <Row gap={space.sm} style={styles.heroTags}>
            <Tag label={`${doneToday} of ${dailies.length} dailies done`} tone={doneToday === dailies.length ? 'success' : 'accent'} />
            <Tag label={`${games.length} games`} />
          </Row>
        </View>
      </FadeIn>
      <View style={[styles.grid, { gap: layout.wide ? 20 : space.lg }]}>
        {games.map((game, index) => {
          const b = badge(game);
          return (
            <FadeIn key={game.title} delay={80 + index * 60} style={columns === 1 ? styles.full : columns === 3 ? styles.third : styles.half}>
              <PressableScale accessibilityRole="button" accessibilityLabel={`${game.title}. ${b.label}. ${game.subtitle}`}
                onPress={() => router.push(game.href)}
                style={[styles.option, { backgroundColor: section.surface }, columns > 1 && styles.optionTile]}>
                <View style={[styles.iconTile, { backgroundColor: section.accent }]}>
                  <Text style={styles.icon} accessible={false}>{game.icon}</Text>
                </View>
                <View style={styles.optionBody}>
                  <Tag label={b.label} tone={b.tone} />
                  <Text style={type.title}>{game.title}</Text>
                  <Text style={type.small}>{game.subtitle}</Text>
                </View>
                {columns === 1
                  ? <Text style={styles.chevron} accessible={false}>›</Text>
                  : <Text style={[styles.play, { color: section.accent }]}>Play →</Text>}
              </PressableScale>
            </FadeIn>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: space.sm, marginTop: space.sm, marginBottom: space.lg },
  heroWide: { flexDirection: 'row', alignItems: 'center', gap: space.xxl, marginTop: space.xl, marginBottom: space.xxl },
  heroText: { gap: space.sm, flexShrink: 1 },
  heroTags: { flexWrap: 'wrap', marginTop: space.xs },
  logo: { width: 84, height: 84, marginBottom: space.sm },
  logoWide: { width: 140, height: 140, marginBottom: 0 },
  displayWide: { fontSize: 52, lineHeight: 58, letterSpacing: -2 },
  city: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  full: { width: '100%' },
  third: { width: '32%' },
  half: { width: '48.6%' },
  option: {
    borderRadius: radius.lg, padding: 18, flexDirection: 'row', alignItems: 'center', gap: space.lg,
    borderWidth: 1, borderColor: palette.border,
  },
  optionTile: { flexDirection: 'column', alignItems: 'flex-start', padding: space.xl, minHeight: 250, gap: space.md },
  iconTile: { width: 52, height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  icon: { color: palette.dark, fontSize: 22, fontWeight: '900' },
  optionBody: { flex: 1, gap: 6 },
  chevron: { color: palette.textMuted, fontSize: 30 },
  play: { fontSize: 15, fontWeight: '800' },
});
