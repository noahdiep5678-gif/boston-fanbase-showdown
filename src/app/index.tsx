import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fanSections } from '@/constants/fan-sections';



export default function HomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>FOUR FAN BASES. ONE CITY.</Text>
        <Text style={styles.title}>How well do you know Boston?</Text>
        <Text style={styles.description}>
          Start with your favorite team. Explore every sport.
          Chase the title of Boston’s top fan.
        </Text>
        <Text style={styles.heading}>Choose your first challenge</Text>
        {fanSections.filter((section) => section.id !== 'boston').map((section) => (
          <Pressable
            key={section.id}
            accessibilityRole="button"
            accessibilityLabel={`Open ${section.name} fan challenges`}
            onPress={() => router.push({ pathname: '/fan-challenges', params: { sport: section.id } })}
            style={({ pressed }) => [styles.card, { borderLeftColor: section.color }, pressed && styles.pressed]}
          >
            <Text style={[styles.teamName, { color: section.color }]}>{section.name}</Text>
            <Text style={styles.description}>{section.description}</Text>
            <Text style={styles.action}>EXPLORE {section.sport.toUpperCase()} →</Text>
          </Pressable>
        ))}
        <Text style={styles.small}>Your first choice is not permanent. Switch between all four teams anytime.</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/fan-challenges', params: { sport: 'boston' } })}
          style={({ pressed }) => [styles.cityCard, pressed && styles.pressed]}
        >
          <Text style={styles.heading}>Beyond the stadium</Text>
          <Text style={styles.description}>General Boston trivia and Where in Boston?</Text>
          <Text style={styles.action}>EXPLORE BOSTON →</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={() => router.push('/rankings')}>
          <Text style={styles.action}>Rankings & winner privileges →</Text>
        </Pressable>
        <View style={styles.notice}>
          <Text style={styles.small}>Practice preview. Rankings and weekly winner privileges open with scored competition.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#101218' },
  content: { padding: 24, paddingBottom: 40, gap: 20, width: '100%', maxWidth: 620, alignSelf: 'center' },
  eyebrow: { color: '#FFD477', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: '#FFFFFF', fontSize: 36, fontWeight: '900', lineHeight: 43 },
  description: { color: '#CBD2DF', fontSize: 16, lineHeight: 24 },
  heading: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  card: { borderLeftWidth: 5, borderRadius: 16, padding: 20, gap: 10, backgroundColor: '#1D2230' },
  teamName: { fontSize: 29, fontWeight: '900' },
  action: { color: '#A5C6FF', fontSize: 15, fontWeight: '800', lineHeight: 23 },
  small: { color: '#B9C3D5', fontSize: 14, lineHeight: 22 },
  cityCard: { backgroundColor: '#183333', padding: 22, gap: 12, borderRadius: 18 },
  secondaryButton: { paddingVertical: 16, minHeight: 52 },
  notice: { padding: 16, borderRadius: 12, backgroundColor: '#1D2230' },
  pressed: { opacity: 0.7 },
});
