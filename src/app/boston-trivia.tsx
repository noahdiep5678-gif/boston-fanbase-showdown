import { Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fanSections } from '@/constants/fan-sections';

const boston = fanSections[3];
const questions = [
  { prompt: 'Which river separates Boston and Cambridge?', options: ['Mystic River', 'Charles River', 'Neponset River'], correct: 1 },
  { prompt: 'Which trail connects historic sites marked by a red line through Boston?', options: ['Freedom Trail', 'Harborwalk', 'Emerald Necklace'], correct: 0 },
  { prompt: 'Which Boston neighborhood is home to the Old North Church?', options: ['Back Bay', 'Beacon Hill', 'North End'], correct: 2 },
];

export default function BostonTriviaScreen() {
  const [answers, setAnswers] = useState<number[]>([]);
  const question = questions[answers.length];
  const score = answers.filter((answer, index) => answer === questions[index].correct).length;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <Link href={{ pathname: '/fan-challenges', params: { sport: 'boston' } }} dismissTo style={styles.back}>← Boston challenges</Link>
        <Text accessibilityRole="header" style={styles.title}>General Boston Trivia</Text>
        <Text style={styles.text}>Practice</Text>
        {question ? (
          <>
            <Text accessibilityLiveRegion="polite" style={styles.question}>
              {answers.length + 1}/{questions.length} · {question.prompt}
            </Text>
            {question.options.map((option, index) => (
              <Pressable
                key={option}
                accessibilityRole="button"
                style={({ pressed }) => [styles.option, pressed && styles.pressed]}
                onPress={() => setAnswers((current) => current.length === answers.length ? [...current, index] : current)}
              >
                <Text style={styles.text}>{option}</Text>
              </Pressable>
            ))}
          </>
        ) : (
          <>
            <Text accessibilityLiveRegion="polite" style={styles.question}>{score}/{questions.length} correct</Text>
            {questions.map((item, index) => (
              <Text key={item.prompt} style={styles.text}>
                {answers[index] === item.correct ? '✓' : '✗'} {item.options[item.correct]} · {item.prompt}
              </Text>
            ))}
            <Pressable accessibilityRole="button" style={styles.option} onPress={() => setAnswers([])}>
              <Text style={styles.text}>Play again</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: boston.gameBackground },
  content: { width: '100%', maxWidth: 540, alignSelf: 'center', padding: 24, gap: 14 },
  back: { alignSelf: 'flex-start', color: '#FFF', minHeight: 44, paddingVertical: 10, fontSize: 16 },
  title: { color: '#FFF', fontSize: 33, fontWeight: '800' },
  question: { color: '#FFF', fontSize: 22, fontWeight: '700', marginVertical: 12 },
  text: { color: '#FFF', fontSize: 16, lineHeight: 24 },
  option: { backgroundColor: boston.surface, padding: 16, borderRadius: 12 },
  pressed: { opacity: 0.65 },
});
