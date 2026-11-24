import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import BostonMap from '@/components/boston-map';

type Coordinate = { latitude: number; longitude: number };
// Practice targets; coordinates will be reviewed before launch.
const locations = [
  { name: 'Boston Marathon finish line', difficulty: 'Easy', coordinate: { latitude: 42.3498, longitude: -71.0788 } },
  { name: 'Isabella Stewart Gardner Museum', difficulty: 'Medium', coordinate: { latitude: 42.3382, longitude: -71.099 } },
  { name: 'Fort Independence', difficulty: 'Hard', coordinate: { latitude: 42.3384, longitude: -71.0105 } },
];
function distanceInMeters(a: Coordinate, b: Coordinate) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDifference = radians(b.latitude - a.latitude);
  const longitudeDifference = radians(b.longitude - a.longitude);
  const value = Math.sin(latitudeDifference / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(longitudeDifference / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, value)));
}
function formatDistance(meters: number) {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(2)} km`;
}
export default function WhereInBostonScreen() {
  const [round, setRound] = useState(0);
  const [guess, setGuess] = useState<Coordinate | null>(null);
  const [results, setResults] = useState<{ distance: number; points: number }[]>([]);
  const [finished, setFinished] = useState(false);
  const [shareError, setShareError] = useState('');
  const location = locations[round];
  const submitted = results.length > round;
  const result = results[round];
  const total = results.reduce((sum, item) => sum + item.points, 0);
  function submitGuess() {
    if (!guess || submitted) return;
    const distance = distanceInMeters(guess, location.coordinate);
    const points = Math.round(1000 * Math.max(0, 1 - Math.max(0, distance - 100) / 4900));
    setResults([...results, { distance, points }]);
  }
  function nextRound() {
    if (round === locations.length - 1) { setFinished(true); return; }
    setRound(round + 1);
    setGuess(null);
  }
  async function shareResult() {
    try {
      setShareError('');
      await Share.share({ message: 'Where in Boston? — Practice\n' + `${total}/3000 points across 3 locations.\n` + 'Think you know Boston better? Try Boston’s city challenges.' });
    } catch { setShareError('Could not open sharing. Please try again.'); }
  }
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Link href={{ pathname: '/fan-challenges', params: { sport: 'boston' } }} style={styles.back}>← Boston challenges</Link>
        <Text style={styles.title}>Where in Boston?</Text>
        <Text style={styles.muted}>PRACTICE · 3 LOCATIONS</Text>
        {finished ? (
          <>
            <Text style={styles.score}>{total} / 3000</Text>
            <Text style={styles.text}>Three places. How well did you know Boston?</Text>
            {results.map((item, index) => (
              <View key={locations[index].name} style={styles.card}>
                <Text style={styles.text}>{locations[index].name}</Text>
                <Text style={styles.muted}>{formatDistance(item.distance)} away · {item.points} points</Text>
              </View>
            ))}
            <Pressable accessibilityRole="button" style={styles.button} onPress={shareResult}>
              <Text style={styles.buttonText}>Share your score</Text>
            </Pressable>
            {shareError ? <Text style={styles.text}>{shareError}</Text> : null}
            <Text style={styles.muted}>Practice only. These points are not added to rankings.</Text>
          </>
        ) : (
          <>
            <Text style={styles.muted}>Round {round + 1} of 3 · {location.difficulty}</Text>
            <Text style={styles.place}>Find {location.name}</Text>
            <Text style={styles.text}>Tap to place your pin. You can move it until you submit.</Text>
            <View style={styles.map}>
              <BostonMap key={round} guess={guess} answer={submitted ? location.coordinate : null} onGuess={setGuess} />
            </View>
            {submitted ? (
              <>
                <Text style={styles.text}>{formatDistance(result.distance)} away · {result.points} points</Text>
                <Text style={styles.muted}>Blue: your guess · Green: correct location</Text>
                <Pressable accessibilityRole="button" style={styles.button} onPress={nextRound}>
                  <Text style={styles.buttonText}>{round === locations.length - 1 ? 'See final score' : 'Next location'}</Text>
                </Pressable>
              </>
            ) : (
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: !guess }} disabled={!guess} onPress={submitGuess} style={[styles.button, !guess && styles.disabled]}>
                <Text style={styles.buttonText}>{guess ? 'Lock in guess' : 'Tap the map first'}</Text>
              </Pressable>
            )}
            <Text style={styles.muted}>Total: {total} / 3000</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#101218' },
  content: { padding: 20, paddingBottom: 32, gap: 18, width: '100%', maxWidth: 600, alignSelf: 'center' },
  back: { color: '#85B0FF', fontSize: 16, paddingVertical: 8 },
  title: { color: '#FFFFFF', fontSize: 32, fontWeight: '800' },
  place: { color: '#FFFFFF', fontSize: 24, fontWeight: '700' },
  text: { color: '#FFFFFF', fontSize: 16, lineHeight: 24 },
  muted: { color: '#BDC3D0', fontSize: 14, lineHeight: 22 },
  score: { color: '#FFD477', fontSize: 40, fontWeight: '900' },
  map: { borderRadius: 18, overflow: 'hidden' },
  card: { backgroundColor: '#1D2230', padding: 16, borderRadius: 14, gap: 8 },
  button: { backgroundColor: '#2357C7', borderRadius: 14, padding: 18, minHeight: 56, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  disabled: { opacity: 0.45 },
});
