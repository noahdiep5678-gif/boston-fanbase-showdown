import { Link, Redirect, useLocalSearchParams } from 'expo-router';
import type { Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getFanSection } from '@/constants/fan-sections';

export default function FanChallengesScreen() {
  const { sport } = useLocalSearchParams<{ sport?: string }>();
  const section = getFanSection(sport);
  if (!section) return <Redirect href="/" />;

  const isCity = section.id === 'boston';
  const games: { title: string; icon: string; href: Href }[] = isCity
    ? [
        { title: 'Play General Boston Trivia', icon: '?', href: '/boston-trivia' },
        { title: 'Where in Boston?', icon: '◎', href: '/where-in-boston' },
      ]
    : [
        { title: 'Play Wicked Smaht Daily Trivia', icon: '?', href: { pathname: '/wicked-smaht', params: { sport: section.id } } },
        { title: 'Test Your Knowledge… Game Predictions', icon: '↗', href: { pathname: '/sports-predictions', params: { sport: section.id } } },
      ];

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: section.color }]}>
      <StatusBar style={section.id === 'bruins' ? 'dark' : 'light'} />
      <Link href="/" dismissTo style={[styles.back, { color: section.ink }]} accessibilityLabel="Back to teams">←</Link>
      <ScrollView contentContainerStyle={styles.content}>
        {games.map(({ title, icon, href }) => (
          <Link key={title} href={href} asChild>
            <Pressable style={({ pressed }) => [
              styles.option,
              { borderColor: section.ink },
              pressed && styles.pressed,
            ]}>
              <Text style={[styles.icon, { color: section.ink }]} accessible={false}>{icon}</Text>
              <Text style={[styles.label, { color: section.ink }]}>{title}</Text>
              <Text style={[styles.arrow, { color: section.ink }]} accessible={false}>›</Text>
            </Pressable>
          </Link>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  back: { marginLeft: 18, paddingHorizontal: 10, minHeight: 48, fontSize: 27, alignSelf: 'flex-start' },
  content: { flexGrow: 1, justifyContent: 'center', alignSelf: 'center', width: '100%', maxWidth: 500, padding: 24, paddingBottom: 72, gap: 56 },
  option: { minHeight: 78, borderWidth: StyleSheet.hairlineWidth, borderRadius: 15, padding: 16, gap: 14, flexDirection: 'row', alignItems: 'center' },
  pressed: { opacity: 0.65 },
  icon: { width: 24, textAlign: 'center', fontSize: 24, fontWeight: '700' },
  label: { flex: 1, fontSize: 17, fontWeight: '600' },
  arrow: { fontSize: 24 },
});
