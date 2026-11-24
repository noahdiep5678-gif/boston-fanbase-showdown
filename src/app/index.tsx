import { useEventListener } from 'expo';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fanSections, pageGradients, teamLogos as logos } from '@/constants/fan-sections';
import { DAILY_GAMES, dailyStreak, hasPlayed, useLedger } from '@/lib/stats';
import { PressableScale } from '@/ui/components';
import { DesktopHome } from '@/components/desktop-home';
import { haptic } from '@/ui/haptics';
import { useLayout } from '@/ui/layout';

const montage = require('../../assets/videos/opening-montage.mp4');
const titleBackground = '#10281D';
const columns = [0, 0.23, 0.52, 0.76, 1];
const rows = [0, 0.18, 0.37, 0.59, 0.81, 1];

function OpeningMontage({ onFinish }: { onFinish: () => void }) {
  const player = useVideoPlayer(montage, (video) => {
    video.muted = true;
    video.play();
  });

  useEventListener(player, 'playToEnd', onFinish);
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'error') onFinish();
  });

  useEffect(() => {
    const timeout = setTimeout(onFinish, 20_000);
    return () => clearTimeout(timeout);
  }, [onFinish]);

  return (
    <VideoView
      player={player}
      nativeControls={false}
      contentFit="contain"
      style={styles.montage}
    />
  );
}

function StadiumTitle({ onFinish }: { onFinish: () => void }) {
  const { width, height } = useWindowDimensions();
  const [shattering, setShattering] = useState(false);
  const [reveal] = useState(() => new Animated.Value(0));
  const [vibration] = useState(() => new Animated.Value(0));
  const [breakup] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let active = true;
    let animation: Animated.CompositeAnimation | undefined;

    function start(reduceMotion: boolean) {
      if (!active) return;
      animation = Animated.sequence([
        Animated.timing(reveal, { toValue: 1, duration: 360, useNativeDriver: true }),
        Animated.delay(1000),
        reduceMotion
          ? Animated.delay(1000)
          : Animated.timing(vibration, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }),
      ]);
      animation.start(({ finished }) => {
        if (!finished) return;
        if (reduceMotion) onFinish();
        else setShattering(true);
      });
    }

    void AccessibilityInfo.isReduceMotionEnabled().then(start, () => start(false));
    return () => {
      active = false;
      animation?.stop();
    };
  }, [onFinish, reveal, vibration]);

  useEffect(() => {
    if (!shattering) return;
    const animation = Animated.timing(breakup, {
      toValue: 1, duration: 610, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    });
    animation.start(({ finished }) => { if (finished) onFinish(); });
    return () => animation.stop();
  }, [breakup, onFinish, shattering]);

  const shake = vibration.interpolate({
    inputRange: [0, 0.11, 0.22, 0.33, 0.43, 0.53, 0.62, 0.70, 0.77, 0.83, 0.88, 0.93, 0.97, 1],
    outputRange: [0, -1, 1, -2, 2, -3, 4, -5, 6, -7, 8, -9, 10, -11],
  });
  const titleFade = breakup.interpolate({ inputRange: [0, 0.35, 1], outputRange: [1, 0, 0] });
  const shardFade = breakup.interpolate({ inputRange: [0, 0.55, 1], outputRange: [1, 1, 0] });

  return (
    <View style={[StyleSheet.absoluteFill, !shattering && styles.montage]}>
      {shattering && rows.slice(0, -1).map((top, row) => (
        columns.slice(0, -1).map((left, column) => (
          [false, true].map((reverse) => {
            const tileWidth = (columns[column + 1] - left) * width;
            const tileHeight = (rows[row + 1] - top) * height;
            const x = left * width;
            const y = top * height;
            const direction = reverse ? 1 : -1;
            const driftX = (x + tileWidth / 2 - width / 2) * 1.35 + direction * 70;
            const driftY = (y + tileHeight / 2 - height / 2) * 0.75 + direction * 90 + 45;

            return (
              <Animated.View
                key={`${row}-${column}-${reverse}`}
                style={{
                  position: 'absolute', left: x, top: y, opacity: shardFade,
                  transform: [
                    { translateX: breakup.interpolate({ inputRange: [0, 1], outputRange: [0, driftX] }) },
                    { translateY: breakup.interpolate({ inputRange: [0, 1], outputRange: [0, driftY] }) },
                    { rotate: breakup.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${direction * (25 + row * 8)}deg`] }) },
                  ],
                }}
              >
                <View style={[styles.shard, reverse
                  ? { borderRightWidth: tileWidth, borderRightColor: titleBackground, borderTopWidth: tileHeight }
                  : { borderLeftWidth: tileWidth, borderLeftColor: titleBackground, borderBottomWidth: tileHeight }]} />
              </Animated.View>
            );
          })
        ))
      ))}
      <Animated.View style={[
        styles.titleScreen,
        shattering ? { opacity: titleFade } : { backgroundColor: titleBackground, opacity: reveal },
      ]}>
        <Animated.Text accessibilityRole="header" style={[styles.title, { transform: [{ translateX: shake }] }]}>
          Stadium Pulse
        </Animated.Text>
        <Text style={styles.titleCity}>Boston</Text>
      </Animated.View>
    </View>
  );
}

function CarouselStatus({ id, ink }: { id: (typeof fanSections)[number]['id']; ink: string }) {
  const ledger = useLedger();
  const dailies = DAILY_GAMES[id];
  const done = dailies.filter((game) => hasPlayed(ledger, game, id)).length;
  const streak = dailyStreak(ledger, dailies, id);
  return (
    <View style={[styles.statusPill, { borderColor: ink }]}>
      <Text style={[styles.status, { color: ink }]}>
        {done === dailies.length ? '✓ All dailies done' : `${done} of ${dailies.length} dailies done`}{streak > 1 ? `  ·  🔥 ${streak}` : ''}
      </Text>
    </View>
  );
}

const INTRO_SEEN = 'stadium-pulse:intro-seen';

/** On the web the intro plays once per browser session; `?intro=off` skips it entirely. */
function shouldPlayIntro(param: string | undefined) {
  if (param === 'off') return false;
  if (Platform.OS !== 'web') return true;
  try {
    return globalThis.sessionStorage?.getItem(INTRO_SEEN) !== '1';
  } catch {
    return true;
  }
}

export default function HomeScreen() {
  const router = useRouter();
  const { intro } = useLocalSearchParams<{ intro?: string }>();
  const { width, height } = useWindowDimensions();
  const layout = useLayout();
  const pages = useRef<ComponentRef<typeof ScrollView>>(null);
  const [active, setActive] = useState(0);
  const [showIntro, setShowIntro] = useState(() => shouldPlayIntro(intro));
  const [showTitle, setShowTitle] = useState(false);
  const finishMontage = useCallback(() => setShowTitle(true), []);
  const finishIntro = useCallback(() => {
    setShowIntro(false);
    if (Platform.OS === 'web') {
      try { globalThis.sessionStorage?.setItem(INTRO_SEEN, '1'); } catch {}
    }
  }, []);

  if (layout.wide) {
    return (
      <View style={styles.screen}>
        <DesktopHome />
        {showIntro && (
          <View style={StyleSheet.absoluteFill}>
            {showTitle ? <StadiumTitle onFinish={finishIntro} /> : <OpeningMontage onFinish={finishMontage} />}
            {!showTitle && (
              <Pressable accessibilityRole="button" accessibilityLabel="Skip intro" onPress={finishMontage} style={[styles.skip, styles.skipDesktop]}>
                <Text style={styles.skipText}>Skip intro</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    );
  }

  function goTo(index: number) {
    pages.current?.scrollTo({ x: width * index, animated: true });
  }

  return (
    <View style={styles.screen}>
      <StatusBar style={showIntro || fanSections[active].id !== 'bruins' ? 'light' : 'dark'} />
      <ScrollView
        ref={pages}
        horizontal
        pagingEnabled
        scrollEnabled={!showIntro}
        bounces={false}
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={({ nativeEvent }) => {
          if (width > 0) {
            const index = Math.max(0, Math.min(Math.round(nativeEvent.contentOffset.x / width), fanSections.length - 1));
            if (index !== active) {
              haptic.select();
              setActive(index);
            }
          }
        }}
        accessibilityElementsHidden={showIntro}
        importantForAccessibility={showIntro ? 'no-hide-descendants' : 'auto'}
      >
        {fanSections.map((section, index) => {
          const isCity = section.id === 'boston';
          const label = isCity ? 'General Boston Trivia' : `Test Your ${section.name} Knowledge`;

          return (
            <View key={section.id} style={[styles.page, { width }, Platform.OS === 'web' && { height }]}>
              <LinearGradient colors={pageGradients[section.id]} style={StyleSheet.absoluteFill} />
              <SafeAreaView
                style={styles.flex}
                accessibilityElementsHidden={index !== active}
                importantForAccessibility={index === active ? 'auto' : 'no-hide-descendants'}
              >
                <View style={styles.topBar}>
                  <Text style={[styles.wordmark, { color: section.ink }]}>STADIUM PULSE</Text>
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel="Rankings and your stats"
                    onPress={() => router.push('/rankings')}
                    style={[styles.rankings, { borderColor: section.ink }]}
                  >
                    {[8, 14, 11].map((height) => (
                      <View key={height} style={[styles.bar, { backgroundColor: section.ink, height }]} />
                    ))}
                  </PressableScale>
                </View>
                <View style={styles.main}>
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    pressedScale={0.94}
                    onPress={() => router.push({ pathname: '/fan-challenges', params: { sport: section.id } })}
                    style={styles.open}
                  >
                    {isCity
                      ? <Text style={[styles.city, { color: section.ink }]}>BOSTON</Text>
                      : <Image source={logos[section.id]} style={styles.logo} contentFit="contain" />}
                    <Text style={[styles.caption, { color: section.ink }]}>{label}</Text>
                    <CarouselStatus id={section.id} ink={section.ink} />
                  </PressableScale>
                  {index > 0 && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Previous: ${fanSections[index - 1].name}`}
                      onPress={() => goTo(index - 1)}
                      style={[styles.arrow, styles.left]}
                    >
                      <Text style={[styles.chevron, { color: section.ink }]}>{'‹'}</Text>
                    </Pressable>
                  )}
                  {index < fanSections.length - 1 && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Next: ${fanSections[index + 1].name}`}
                      onPress={() => goTo(index + 1)}
                      style={[styles.arrow, styles.right]}
                    >
                      <Text style={[styles.chevron, { color: section.ink }]}>{'›'}</Text>
                    </Pressable>
                  )}
                </View>
                <View style={styles.footer}>
                  <View style={styles.dots} accessible accessibilityLabel={`Page ${index + 1} of ${fanSections.length}`}>
                    {fanSections.map((item, dot) => (
                      <View key={item.id} style={[styles.dot, { backgroundColor: section.ink, opacity: dot === index ? 1 : 0.35 }, dot === index && styles.dotActive]} />
                    ))}
                  </View>
                </View>
              </SafeAreaView>
            </View>
          );
        })}
      </ScrollView>
      {showIntro && (
        <View style={StyleSheet.absoluteFill}>
          {showTitle ? <StadiumTitle onFinish={finishIntro} /> : <OpeningMontage onFinish={finishMontage} />}
          {!showTitle && (
            <SafeAreaView style={styles.skipWrap} pointerEvents="box-none">
              <Pressable accessibilityRole="button" accessibilityLabel="Skip intro" onPress={finishMontage} style={styles.skip} hitSlop={10}>
                <Text style={styles.skipText}>Skip</Text>
              </Pressable>
            </SafeAreaView>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#087443' },
  flex: { flex: 1 },
  page: { flexShrink: 0 },
  topBar: { height: 56, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: { fontSize: 13, fontWeight: '900', letterSpacing: 2.4, opacity: 0.85 },
  rankings: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, flexDirection: 'row', gap: 3, alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 11, opacity: 0.9 },
  bar: { width: 3.5, borderRadius: 2 },
  main: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  open: { maxWidth: '78%', minHeight: 48, alignItems: 'center', gap: 20 },
  logo: { width: 210, maxWidth: '100%', height: 190 },
  city: { fontSize: 54, fontWeight: '900', letterSpacing: -2.5 },
  caption: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  statusPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, opacity: 0.85 },
  status: { fontSize: 13, fontWeight: '700', letterSpacing: 0.2, opacity: 0.85 },
  arrow: { position: 'absolute', width: 46, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  left: { left: 6 },
  right: { right: 6 },
  chevron: { fontSize: 34, lineHeight: 38, opacity: 0.8 },
  footer: { height: 64, justifyContent: 'center', alignItems: 'center' },
  dots: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotActive: { width: 22 },
  skipWrap: { position: 'absolute', top: 0, right: 0, left: 0, alignItems: 'flex-end' },
  skip: { margin: 16, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)' },
  skipText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  skipDesktop: { position: 'absolute', top: 16, right: 24 },
  titleScreen: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center', padding: 26 },
  shard: { width: 0, height: 0, borderColor: 'transparent', borderStyle: 'solid' },
  montage: { ...StyleSheet.absoluteFill, backgroundColor: '#000000' },
  title: { color: '#FAF9F2', fontSize: 40, fontWeight: '900', letterSpacing: -1.8, textAlign: 'center' },
  titleCity: { color: '#FAF9F2', fontSize: 19, fontWeight: '600', marginTop: 8 },
});
