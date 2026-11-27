import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { fanSections, pageGradients, teamLogos, type FanSection } from '@/constants/fan-sections';
import { gamesFor } from '@/constants/games';
import { DAILY_GAMES, dailyStreak, hasPlayed, summarize, useLedger } from '@/lib/stats';
import { PressableScale } from '@/ui/components';
import { useLayout } from '@/ui/layout';
import { palette, radius, space, type } from '@/ui/tokens';

/** Desktop landing page: every team side by side instead of the phone carousel. */
export function DesktopHome() {
  const ledger = useLedger();
  const layout = useLayout();
  const stats = summarize(ledger);
  const totalDailies = fanSections.reduce((sum, s) => sum + DAILY_GAMES[s.id].length, 0);
  const doneDailies = fanSections.reduce((sum, s) => sum + DAILY_GAMES[s.id].filter((g) => hasPlayed(ledger, g, s.id)).length, 0);
  const bestStreak = Math.max(0, ...fanSections.map((s) => dailyStreak(ledger, DAILY_GAMES[s.id], s.id)));
  const fourAcross = layout.xwide;

  return (
    <View style={styles.screen}>
      <LinearGradient colors={['#121A16', '#07090C']} style={StyleSheet.absoluteFill} />
      <View style={styles.nav}>
        <View style={styles.navInner}>
          <Text style={styles.wordmark}>STADIUM PULSE</Text>
          <Pressable accessibilityRole="link" onPress={() => router.push('/rankings')}>
            {({ hovered }) => <Text style={[styles.navLink, hovered && { color: palette.text }]}>Rankings & your stats</Text>}
          </Pressable>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.inner}>
          <View style={styles.hero}>
            <View style={styles.heroText}>
              <Text style={[type.eyebrow, { color: palette.gold }]}>Boston</Text>
              <Text accessibilityRole="header" style={styles.title}>Stadium Pulse</Text>
              <Text style={styles.lede}>
                Daily games for Celtics, Patriots, and Bruins fans — and anyone who knows this city.
                New puzzles every midnight, Boston time.
              </Text>
            </View>
            <View style={styles.heroStats}>
              <HeroStat value={`${doneDailies}/${totalDailies}`} label="Dailies done today" />
              <HeroStat value={bestStreak ? `🔥 ${bestStreak}` : '—'} label="Best streak" />
              <HeroStat value={stats.points.toLocaleString()} label="Your points" />
            </View>
          </View>

          <View style={styles.panels}>
            {fanSections.map((section) => (
              <View key={section.id} style={{ width: fourAcross ? '23.6%' : '48.9%' }}>
                <TeamPanel section={section} />
              </View>
            ))}
          </View>
          <Text style={[type.small, styles.footer]}>
            Scores and streaks are saved in this browser. No wagering, no prizes — just bragging rights.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={type.eyebrow}>{label}</Text>
    </View>
  );
}

function TeamPanel({ section }: { section: FanSection }) {
  const ledger = useLedger();
  const dailies = DAILY_GAMES[section.id];
  const done = dailies.filter((g) => hasPlayed(ledger, g, section.id)).length;
  const games = gamesFor(section);
  const ink = section.ink;
  const isCity = section.id === 'boston';
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${section.name}: ${games.length} games, ${done} of ${dailies.length} dailies done`}
      onPress={() => router.push({ pathname: '/fan-challenges', params: { sport: section.id } })}
      pressedScale={0.98}
      style={styles.panel}
    >
      <LinearGradient colors={pageGradients[section.id]} style={StyleSheet.absoluteFill} />
      <View style={styles.panelTop}>
        {isCity
          ? <Text style={[styles.city, { color: ink }]}>BOSTON</Text>
          : <Image source={teamLogos[section.id]} style={styles.logo} contentFit="contain" />}
      </View>
      <View style={styles.panelBody}>
        <Text style={[styles.panelName, { color: ink }]}>{isCity ? 'Boston' : section.name}</Text>
        <Text style={[styles.panelTagline, { color: ink }]}>{section.tagline}</Text>
        <View style={[styles.pill, { borderColor: ink }]}>
          <Text style={[styles.pillText, { color: ink }]}>
            {done === dailies.length ? '✓ All dailies done' : `${done} of ${dailies.length} dailies done`}
          </Text>
        </View>
        <View style={styles.chips}>
          {games.map((game) => (
            <Text key={game.title} style={[styles.chip, { color: ink, borderColor: ink }]}>{game.title}</Text>
          ))}
        </View>
      </View>
      <View style={[styles.cta, { backgroundColor: ink }]}>
        <Text style={[styles.ctaText, { color: section.id === 'bruins' ? '#FFD253' : section.gameBackground }]}>
          Play {isCity ? 'Boston' : section.name} →
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  nav: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
  navInner: {
    height: 64, width: '100%', maxWidth: 1320, alignSelf: 'center', paddingHorizontal: space.xxl,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  wordmark: { color: palette.text, fontSize: 14, fontWeight: '900', letterSpacing: 2.6 },
  navLink: { color: palette.textMuted, fontSize: 15, fontWeight: '700' },
  scroll: { paddingBottom: 64 },
  inner: { width: '100%', maxWidth: 1320, alignSelf: 'center', paddingHorizontal: space.xxl },
  hero: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.xxl, paddingVertical: 48, flexWrap: 'wrap' },
  heroText: { gap: space.md, maxWidth: 620 },
  title: { color: palette.text, fontSize: 72, lineHeight: 76, fontWeight: '900', letterSpacing: -3 },
  lede: { color: palette.textMuted, fontSize: 19, lineHeight: 28 },
  heroStats: { flexDirection: 'row', gap: space.xl },
  heroStat: { gap: 4, minWidth: 120 },
  heroStatValue: { color: palette.text, fontSize: 32, fontWeight: '900', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  panels: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, justifyContent: 'space-between' },
  panel: { minHeight: 560, borderRadius: 28, overflow: 'hidden', padding: space.xl, justifyContent: 'space-between', gap: space.lg },
  panelTop: { height: 170, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 160, height: 150 },
  city: { fontSize: 48, fontWeight: '900', letterSpacing: -2 },
  panelBody: { gap: space.sm, flex: 1 },
  panelName: { fontSize: 30, fontWeight: '900', letterSpacing: -1 },
  panelTagline: { fontSize: 15, fontWeight: '600', opacity: 0.85 },
  pill: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5, marginVertical: space.xs, opacity: 0.9 },
  pillText: { fontSize: 13, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space.xs },
  chip: { fontSize: 12, fontWeight: '700', borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3, opacity: 0.75 },
  cta: { borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  ctaText: { fontSize: 16, fontWeight: '900' },
  footer: { textAlign: 'center', marginTop: space.xxl },
});
