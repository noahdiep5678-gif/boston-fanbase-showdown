import { Link, Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fanSections, getFanSection } from '@/constants/fan-sections';

export default function FanChallengesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sport?: string }>();
  const section = getFanSection(params.sport);
  if (!section) return <Redirect href="/" />;
  const isCity = section.id === 'boston';

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Link href="/" style={styles.link}>← All fan challenges</Link>
        <Text style={styles.eyebrow}>EXPLORE EVERY SIDE OF BOSTON</Text>
        <View style={styles.switcher}>
          {fanSections.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected: section.id === item.id }}
              onPress={() => router.setParams({ sport: item.id })}
              style={[styles.chip, section.id === item.id && { borderColor: item.color, backgroundColor: '#2A3346' }]}
            >
              <Text style={[styles.chipText, section.id === item.id && { color: item.color }]}>{item.name}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={[styles.title, { color: section.color }]}>
          {isCity ? 'Know your city.' : `${section.name} fan challenges`}
        </Text>
        <Text style={styles.description}>{section.description}</Text>
        {isCity ? (
          <>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              onPress={() => router.push('/where-in-boston')}
            >
              <Text style={styles.cardTitle}>Where in Boston?</Text>
              <Text style={styles.description}>Three names. Three map guesses. How close can you get?</Text>
              <Text style={styles.action}>PLAY PRACTICE →</Text>
            </Pressable>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>General Boston trivia</Text>
              <Text style={styles.description}>Neighborhoods, local culture, and city history.</Text>
              <Text style={styles.status}>New puzzles coming soon</Text>
            </View>
          </>
        ) : (
          <>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              onPress={() => router.push({ pathname: '/wicked-smaht', params: { sport: section.id } })}
            >
              <Text style={styles.cardTitle}>Wicked Smaht · {section.name}</Text>
              <Text style={styles.description}>Name 10 players from a historic roster. Five mistakes end the round.</Text>
              <Text style={styles.action}>PLAY PRACTICE →</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              onPress={() => router.push({ pathname: '/sports-predictions', params: { sport: section.id } })}
            >
              <Text style={styles.cardTitle}>{section.name} predictions</Text>
              <Text style={styles.description}>Try a {section.name} prediction from our fictional practice slate.</Text>
              <Text style={styles.action}>MAKE A PRACTICE PICK →</Text>
            </Pressable>
          </>
        )}
        <Pressable
          accessibilityRole="button"
          style={styles.card}
          onPress={() => router.push({ pathname: '/rankings', params: { sport: section.id } })}
        >
          <Text style={styles.cardTitle}>{isCity ? 'Overall Boston fan rankings' : `Top ${section.name} fans`}</Text>
          <Text style={styles.description}>Explore the competition and weekly winner privileges.</Text>
          <Text style={styles.action}>VIEW RANKINGS →</Text>
        </Pressable>
        <Text style={styles.status}>
          Play across every category. Your first choice does not lock you into a fan base.
          Practice scores are not yet recorded in rankings.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#101218' },
  content: { padding: 24, paddingBottom: 40, gap: 22, width: '100%', maxWidth: 620, alignSelf: 'center' },
  link: { color: '#A5C6FF', fontSize: 16, paddingVertical: 8 },
  eyebrow: { color: '#BDC3D0', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  switcher: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { paddingVertical: 12, paddingHorizontal: 15, borderRadius: 24, borderWidth: 1, borderColor: '#62718B', minHeight: 46 },
  chipText: { color: '#CBD2DF', fontSize: 15, fontWeight: '700' },
  title: { fontSize: 33, fontWeight: '900', lineHeight: 41 },
  description: { color: '#CBD2DF', fontSize: 16, lineHeight: 25 },
  card: { padding: 22, backgroundColor: '#1D2230', gap: 12, borderRadius: 18 },
  cardTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  action: { color: '#A5C6FF', fontSize: 15, fontWeight: '800', lineHeight: 23 },
  status: { color: '#BAC4D5', fontSize: 14, lineHeight: 22 },
  pressed: { opacity: 0.7 },
});
