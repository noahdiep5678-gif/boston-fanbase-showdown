import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import BostonMap from '@/components/boston-map';
import { bostonLocations, shuffle, type BostonLocation } from '@/constants/boston-content';
import { fanSections } from '@/constants/fan-sections';
import { shareText } from '@/lib/share';
import { recordResult } from '@/lib/stats';
import { Button, Card, FadeIn, ProgressBar, Row, Screen, Stat, Tag } from '@/ui/components';
import { haptic } from '@/ui/haptics';
import { palette, radius, space, type } from '@/ui/tokens';

const boston = fanSections[3];
const ROUNDS = 5;
const MAX = 1000;

type Coordinate = { latitude: number; longitude: number };

function distanceInMeters(a: Coordinate, b: Coordinate) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, value)));
}

function formatDistance(meters: number) {
  const miles = meters / 1609.344;
  return miles < 0.1 ? `${Math.round(meters * 3.28084)} ft` : `${miles.toFixed(miles < 10 ? 2 : 1)} mi`;
}

/** Full points within 100 m, sliding to zero at 5 km. */
function pointsFor(distance: number) {
  return Math.round(MAX * Math.max(0, 1 - Math.max(0, distance - 100) / 4900));
}

function verdict(points: number) {
  if (points >= 950) return 'Bullseye. You could give tours.';
  if (points >= 750) return 'Close enough to hear it.';
  if (points >= 400) return 'Right neighborhood, roughly.';
  if (points > 0) return 'You took the long way.';
  return 'Were you even in Boston?';
}

function pickRound(): BostonLocation[] {
  const byLevel = (level: BostonLocation['difficulty']) => shuffle(bostonLocations.filter((item) => item.difficulty === level));
  // Two easy, two medium, one hard — in that order, so rounds ramp up.
  return [...byLevel('Easy').slice(0, 2), ...byLevel('Medium').slice(0, 2), ...byLevel('Hard').slice(0, 1)];
}

export default function WhereInBostonScreen() {
  const [game, setGame] = useState(() => ({ id: `${Date.now()}`, locations: pickRound() }));
  const [round, setRound] = useState(0);
  const [guess, setGuess] = useState<Coordinate | null>(null);
  const [results, setResults] = useState<{ distance: number; points: number }[]>([]);
  const [finished, setFinished] = useState(false);
  const [shareError, setShareError] = useState('');
  const location = game.locations[round];
  const submitted = results.length > round;
  const result = results[round];
  const total = results.reduce((sum, item) => sum + item.points, 0);
  const maxTotal = ROUNDS * MAX;

  function submitGuess() {
    if (!guess || submitted) return;
    const distance = distanceInMeters(guess, location);
    const points = pointsFor(distance);
    if (points >= 750) haptic.success(); else if (points > 0) haptic.warning(); else haptic.error();
    setResults([...results, { distance, points }]);
  }

  function nextRound() {
    if (round === ROUNDS - 1) {
      recordResult({ id: `where-in-boston:${game.id}`, game: 'where-in-boston', section: 'boston', score: total, max: maxTotal, practice: true, summary: `${total}/${maxTotal} points` });
      setFinished(true);
      return;
    }
    setRound(round + 1);
    setGuess(null);
  }

  function restart() {
    setGame({ id: `${Date.now()}`, locations: pickRound() });
    setRound(0);
    setGuess(null);
    setResults([]);
    setFinished(false);
  }

  async function shareResult() {
    try {
      setShareError('');
      const pins = results.map(({ points }) => points >= 750 ? '🎯' : points >= 400 ? '📍' : points > 0 ? '🧭' : '❌').join(' ');
      await shareText(`Stadium Pulse · Where in Boston?\n${total.toLocaleString()}/${maxTotal.toLocaleString()} ${pins}\nThink you know the city better?`);
    } catch { setShareError('Could not open sharing. Please try again.'); }
  }

  return (
    <Screen
      section={boston}
      back={{ pathname: '/fan-challenges', params: { sport: 'boston' } }}
      backLabel="Boston challenges"
      eyebrow={`Practice · ${ROUNDS} locations`}
      title="Where in Boston?"
      right={<Tag label={`${total.toLocaleString()} pts`} tone="accent" />}
    >
      {finished ? (
        <FadeIn style={styles.stack}>
          <Card tone="raised" style={styles.center}>
            <Text style={type.eyebrow}>Final score</Text>
            <Text style={styles.big}>{total.toLocaleString()}</Text>
            <Text style={type.muted}>out of {maxTotal.toLocaleString()}</Text>
          </Card>
          <Row>
            <Stat value={formatDistance(results.reduce((sum, r) => sum + r.distance, 0) / ROUNDS)} label="Avg miss" />
            <Stat value={results.filter((r) => r.points >= 950).length} label="Bullseyes" />
          </Row>
          {results.map((item, index) => (
            <Card key={game.locations[index].name} style={styles.resultRow}>
              <View style={styles.flex}>
                <Text style={type.heading}>{game.locations[index].name}</Text>
                <Text style={type.small}>{formatDistance(item.distance)} away · {game.locations[index].difficulty}</Text>
              </View>
              <Text style={styles.points}>{item.points}</Text>
            </Card>
          ))}
          <Button label="Share your score" icon="↗" onPress={shareResult} />
          <Button label="Play new locations" variant="secondary" onPress={restart} />
          {!!shareError && <Text style={type.small}>{shareError}</Text>}
          <Text style={type.small}>Practice only. These points never count toward rankings.</Text>
        </FadeIn>
      ) : (
        <>
          <ProgressBar value={(round + (submitted ? 1 : 0)) / ROUNDS} />
          <FadeIn key={round} style={styles.stack}>
            <Row style={styles.between}>
              <Text style={type.eyebrow}>Round {round + 1} of {ROUNDS}</Text>
              <Tag label={location.difficulty} tone={location.difficulty === 'Hard' ? 'danger' : location.difficulty === 'Medium' ? 'gold' : 'success'} />
            </Row>
            <Text style={type.title}>Drop a pin on {location.name}</Text>
            <Text style={type.small}>{submitted ? location.hint : 'Tap the map to place your pin. Move it as often as you like before locking in.'}</Text>
          </FadeIn>
          <View style={styles.map}>
            <BostonMap key={`${game.id}:${round}`} guess={guess} answer={submitted ? { latitude: location.latitude, longitude: location.longitude } : null} onGuess={(coordinate) => { haptic.select(); setGuess(coordinate); }} />
          </View>
          {submitted ? (
            <FadeIn style={styles.stack}>
              <Card tone={result.points >= 750 ? 'success' : result.points >= 400 ? 'gold' : 'danger'} style={styles.resultRow}>
                <View style={styles.flex}>
                  <Text style={type.heading}>{verdict(result.points)}</Text>
                  <Text style={type.small}>{formatDistance(result.distance)} away · blue is you, green is the spot</Text>
                </View>
                <Text style={styles.points}>+{result.points}</Text>
              </Card>
              <Button label={round === ROUNDS - 1 ? 'See final score' : 'Next location'} onPress={nextRound} />
            </FadeIn>
          ) : (
            <Button label={guess ? 'Lock in guess' : 'Tap the map first'} disabled={!guess} onPress={submitGuess} />
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stack: { gap: space.md },
  between: { justifyContent: 'space-between' },
  center: { alignItems: 'center', paddingVertical: space.xl, gap: space.xs },
  big: { ...type.number, fontSize: 64, lineHeight: 70 },
  map: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: palette.border },
  resultRow: { flexDirection: 'row', alignItems: 'center' },
  points: { color: palette.text, fontSize: 24, fontWeight: '900', fontVariant: ['tabular-nums'] },
});
