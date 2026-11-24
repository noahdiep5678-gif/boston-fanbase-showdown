import { Link, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fanSections, getFanSection } from '@/constants/fan-sections';

export default function RankingsScreen() {
  const params = useLocalSearchParams<{ sport?: string }>();
  const section = getFanSection(params.sport);
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Link
          href={section ? { pathname: '/fan-challenges', params: { sport: section.id } } : '/'}
          style={styles.link}
        >← Back to challenges</Link>
        <Text style={styles.label}>THE COMPETITION</Text>
        <Text style={styles.title}>Boston’s top fans</Text>
        <Text style={styles.description}>
          Rankings open with the first scored competition. Practice results do not count.
        </Text>
        <View style={styles.card}>
          <Text style={styles.heading}>Top Overall Boston Sports Fan</Text>
          <Text style={styles.description}>Combined performance across all four teams and general Boston challenges.</Text>
          <Text style={styles.status}>No scored results yet</Text>
        </View>
        <Text style={styles.heading}>Top fans by team</Text>
        {fanSections.filter((item) => item.id !== 'boston').map((item) => (
          <View key={item.id} style={styles.card}>
            <Text style={[styles.heading, { color: item.color }]}>{item.name}</Text>
            <Text style={styles.description}>Ranked by performance on {item.name} challenges.</Text>
            <Text style={styles.status}>No scored results yet</Text>
          </View>
        ))}
        <View style={styles.card}>
          <Text style={styles.heading}>Fan base vs. fan base</Text>
          <Text style={styles.description}>Which Boston fan base knows its team best?</Text>
          <Text style={styles.status}>Comparison opens with scored competition</Text>
        </View>
        <Text style={styles.heading}>Weekly winner privileges</Text>
        <View style={styles.card}>
          <Text style={styles.heading}>Winning fan base</Text>
          <Text style={styles.description}>Votes on the category for the following week’s challenges.</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.heading}>Each team’s #1 fan</Text>
          <Text style={styles.description}>
            Earns the opportunity to propose a question. Four top fans, four potential question authors each week.
          </Text>
          <Text style={styles.status}>Questions receive editorial review before publication. Published authors get credit.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#101218' },
  content: { padding: 24, paddingBottom: 40, gap: 22, width: '100%', maxWidth: 620, alignSelf: 'center' },
  link: { color: '#A5C6FF', fontSize: 16, paddingVertical: 8 },
  label: { color: '#FFD477', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  title: { color: '#FFFFFF', fontSize: 35, fontWeight: '900' },
  heading: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', lineHeight: 29 },
  description: { color: '#CBD2DF', fontSize: 16, lineHeight: 25 },
  status: { color: '#B9C3D5', fontSize: 14, lineHeight: 22 },
  card: { backgroundColor: '#1D2230', padding: 22, borderRadius: 18, gap: 12 },
});
