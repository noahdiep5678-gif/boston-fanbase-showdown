import { Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fanSections } from '@/constants/fan-sections';

const boards = [
  { name: 'Boston Superfans', description: 'Combined points across teams and Boston challenges.', color: '#173E2F' },
  ...fanSections.filter(({ id }) => id !== 'boston').map((section) => ({
    name: `Top 5 ${section.name} Fans`,
    color: section.gameBackground,
  })),
];

export default function RankingsScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Link href="/" dismissTo style={styles.back}>← Teams</Link>
        <Text accessibilityRole="header" style={styles.title}>Rankings</Text>
        <Text style={styles.muted}>Standings open when scored competition begins.</Text>
        {boards.map((board) => (
          <View key={board.name} style={styles.board}>
            <Text accessibilityRole="header" style={[styles.heading, { color: board.color }]}>{board.name}</Text>
            {'description' in board && <Text style={styles.muted}>{board.description}</Text>}
            {Array.from({ length: 5 }, (_, index) => (
              <View key={index} style={styles.row} accessible accessibilityLabel={`Rank ${index + 1}, open`}>
                <Text style={styles.rank}>{index + 1}</Text>
                <Text style={styles.muted}>—</Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F7F0' },
  content: { alignSelf: 'center', width: '100%', maxWidth: 540, padding: 24, gap: 14 },
  back: { alignSelf: 'flex-start', paddingVertical: 12, minHeight: 44, color: '#173E2F', fontSize: 16, fontWeight: '600' },
  title: { fontSize: 42, fontWeight: '900', letterSpacing: -1.8, color: '#18241C' },
  heading: { fontSize: 20, fontWeight: '800', marginBottom: 5 },
  muted: { color: '#4F5C53', fontSize: 14 },
  board: { marginTop: 12 },
  row: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#B8C1B7' },
  rank: { width: 20, fontSize: 15, fontWeight: '700', color: '#24352B' },
});
