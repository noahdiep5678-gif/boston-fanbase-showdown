import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import BostonMap from '@/components/boston-map';
import { bostonLocations, shuffle, type BostonLocation } from '@/constants/boston-content';
import { fanSections } from '@/constants/fan-sections';
import { useBostonDate } from '@/hooks/use-boston-date';
import { useScheduledPuzzle } from '@/hooks/use-scheduled-puzzle';
import { shareText } from '@/lib/share';
import { queueRankedRound } from '@/lib/rankings';
import { recordResult } from '@/lib/stats';
import { Button, Card, FadeIn, ProgressBar, Row, Screen, Stat, Tag } from '@/ui/components';
import { haptic } from '@/ui/haptics';
import { palette, radius, space, type } from '@/ui/tokens';

const boston = fanSections[3];
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
  const date = useBostonDate();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  return <MapChallengeLoader key={`${date}:${mode ?? 'daily'}`} date={date} practice={mode === 'practice'} />;
}

type DailyLocation = Pick<BostonLocation, 'name' | 'difficulty'> & { coordinate: Coordinate };
function isLocation(value: unknown): value is DailyLocation {
  if (!value || typeof value !== 'object') return false;
  const { name, difficulty, coordinate } = value as Partial<DailyLocation>;
  return typeof name === 'string' && !!name.trim()
    && (difficulty === 'Easy' || difficulty === 'Medium' || difficulty === 'Hard')
    && typeof coordinate?.latitude === 'number' && Math.abs(coordinate.latitude) <= 90
    && typeof coordinate.longitude === 'number' && Math.abs(coordinate.longitude) <= 180;
}

function mapLocations(data: unknown) {
  if (!data || typeof data !== 'object' || !('locations' in data)) return null;
  const { locations } = data;
  if (!Array.isArray(locations) || locations.length !== 3 || !locations.every(isLocation)
    || new Set(locations.map(({ name }) => name.trim().toLowerCase())).size !== 3) return null;
  return locations.map(({ name, difficulty, coordinate }) => ({ name, difficulty, ...coordinate, hint: '' }));
}

function MapChallengeLoader({ date, practice }: { date: string; practice: boolean }) {
  const { row, failed, retry } = useScheduledPuzzle('where-in-boston', date, !practice);
  if (practice || row === null) return <MapChallenge />;
  const locations = row ? mapLocations(row.roster_data) : null;
  if (row?.prompt.trim() && locations) {
    return <MapChallenge daily={{ date, theme: row.prompt, locations }} />;
  }
  const error = failed || !!row;
  return (
    <Screen section={boston} back={{ pathname: '/fan-challenges', params: { sport: 'boston' } }}
      backLabel="Boston challenges" title="Where in Boston?">
      <Text style={type.muted}>{error ? 'Could not load today’s locations.' : 'Loading today’s map challenge…'}</Text>
      {error && <Button label="Try again" variant="secondary" onPress={retry} />}
    </Screen>
  );
}

function MapChallenge({ daily }: { daily?: { date: string; theme: string; locations: BostonLocation[] } }) {
  const [game, setGame] = useState(() => ({ id: daily?.date ?? `${Date.now()}`, locations: daily?.locations ?? pickRound() }));
  const [round, setRound] = useState(0);
  const [guess, setGuess] = useState<Coordinate | null>(null);
  const [results, setResults] = useState<{ distance: number; points: number; guess: Coordinate }[]>([]);
  const [finished, setFinished] = useState(false);
  const [shareError, setShareError] = useState('');
  const location = game.locations[round];
  const submitted = results.length > round;
  const result = results[round];
  const total = results.reduce((sum, item) => sum + item.points, 0);
  const roundCount = game.locations.length;
  const maxTotal = roundCount * MAX;

  function submitGuess() {
    if (!guess || submitted) return;
    const distance = distanceInMeters(guess, location);
    const points = pointsFor(distance);
    if (points >= 750) haptic.success(); else if (points > 0) haptic.warning(); else haptic.error();
    setResults((current) => current.length === round ? [...current, { distance, points, guess }] : current);
  }

  function nextRound() {
    if (round === roundCount - 1) {
      if (daily) queueRankedRound({ p_game: 'where-in-boston', p_section: 'boston', p_date: daily.date, p_answers: results.map((item) => item.guess) });
      recordResult({ id: `where-in-boston:${game.id}`, game: 'where-in-boston', section: 'boston',
        date: daily?.date, score: total, max: maxTotal, practice: !daily, summary: `${total}/${maxTotal} points` });
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
      eyebrow={daily ? `${daily.theme} · ${daily.date}` : `Practice · ${roundCount} locations`}
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
            <Stat value={formatDistance(results.reduce((sum, r) => sum + r.distance, 0) / roundCount)} label="Avg miss" />
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
          <Button label={daily ? 'Play practice locations' : 'Play new locations'} variant="secondary" onPress={
            daily ? () => router.push({ pathname: '/where-in-boston', params: { mode: 'practice' } }) : restart
          } />
          {!!shareError && <Text style={type.small}>{shareError}</Text>}
          <Text style={type.small}>{daily ? 'Daily results are saved on this device.' : 'Practice scores stay out of your daily stats.'}</Text>
        </FadeIn>
      ) : (
        <>
          <ProgressBar value={(round + (submitted ? 1 : 0)) / roundCount} />
          <FadeIn key={round} style={styles.stack}>
            <Row style={styles.between}>
              <Text style={type.eyebrow}>Round {round + 1} of {roundCount}</Text>
              <Tag label={location.difficulty} tone={location.difficulty === 'Hard' ? 'danger' : location.difficulty === 'Medium' ? 'gold' : 'success'} />
            </Row>
            <Text style={type.title}>Drop a pin on {location.name}</Text>
            {(!submitted || !!location.hint) && <Text style={type.small}>
              {submitted ? location.hint : 'Tap the map to place your pin. Move it as often as you like before locking in.'}
            </Text>}
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
              <Button label={round === roundCount - 1 ? 'See final score' : 'Next location'} onPress={nextRound} />
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
