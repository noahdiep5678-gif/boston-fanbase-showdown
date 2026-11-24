import { useEventListener } from 'expo';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fanSections } from '@/constants/fan-sections';

const logos = {
  celtics: require('../../assets/images/teams/celtics.png'),
  patriots: require('../../assets/images/teams/patriots.png'),
  bruins: require('../../assets/images/teams/bruins.png'),
};

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
        Animated.delay(1500),
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

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const pages = useRef<ComponentRef<typeof ScrollView>>(null);
  const [active, setActive] = useState(0);
  const [showIntro, setShowIntro] = useState(true);
  const [showTitle, setShowTitle] = useState(false);
  const finishMontage = useCallback(() => setShowTitle(true), []);
  const finishIntro = useCallback(() => setShowIntro(false), []);

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
            const index = Math.round(nativeEvent.contentOffset.x / width);
            setActive(Math.max(0, Math.min(index, fanSections.length - 1)));
          }
        }}
        accessibilityElementsHidden={showIntro}
        importantForAccessibility={showIntro ? 'no-hide-descendants' : 'auto'}
      >
        {fanSections.map((section, index) => {
          const isCity = section.id === 'boston';
          const label = isCity ? 'General Boston Trivia' : `Test Your ${section.name} Knowledge`;

          return (
            <SafeAreaView
              key={section.id}
              style={[styles.page, { width, backgroundColor: section.color }]}
              accessibilityElementsHidden={index !== active}
              importantForAccessibility={index === active ? 'auto' : 'no-hide-descendants'}
            >
              <View style={styles.main}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  onPress={() => router.push({ pathname: '/fan-challenges', params: { sport: section.id } })}
                  style={({ pressed }) => [styles.open, pressed && styles.pressed]}
                >
                  {isCity
                    ? <Text style={[styles.city, { color: section.ink }]}>BOSTON</Text>
                    : <Image source={logos[section.id]} style={styles.logo} contentFit="contain" />}
                  <Text style={[styles.caption, { color: section.ink }]}>{label}</Text>
                </Pressable>
                {index > 0 && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Previous: ${fanSections[index - 1].name}`}
                    onPress={() => goTo(index - 1)}
                    style={[styles.arrow, styles.left]}
                  >
                    <Text style={[styles.chevron, { color: section.ink }]}>{'\u2039'}</Text>
                  </Pressable>
                )}
                {index < fanSections.length - 1 && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Next: ${fanSections[index + 1].name}`}
                    onPress={() => goTo(index + 1)}
                    style={[styles.arrow, styles.right]}
                  >
                    <Text style={[styles.chevron, { color: section.ink }]}>{'\u203A'}</Text>
                  </Pressable>
                )}
              </View>
              <View style={styles.footer}>
                <View style={styles.dots} accessible accessibilityLabel={`Page ${index + 1} of ${fanSections.length}`}>
                  {fanSections.map((item, dot) => (
                    <View key={item.id} style={[styles.dot, { backgroundColor: section.ink, opacity: dot === index ? 1 : 0.35 }]} />
                  ))}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Rankings"
                  onPress={() => router.push('/rankings')}
                  style={({ pressed }) => [styles.rankings, pressed && styles.pressed]}
                >
                  {[10, 20, 14].map((height) => (
                    <View key={height} style={[styles.bar, { backgroundColor: section.ink, height }]} />
                  ))}
                </Pressable>
              </View>
            </SafeAreaView>
          );
        })}
      </ScrollView>
      {showIntro && (
        <View style={StyleSheet.absoluteFill}>
          {showTitle ? <StadiumTitle onFinish={finishIntro} /> : <OpeningMontage onFinish={finishMontage} />}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#087443' },
  page: { flexShrink: 0 },
  main: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  open: { maxWidth: '74%', minHeight: 48, alignItems: 'center', gap: 23 },
  pressed: { opacity: 0.7 },
  logo: { width: 190, maxWidth: '100%', height: 170 },
  city: { fontSize: 46, fontWeight: '900', letterSpacing: -2 },
  caption: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  arrow: { position: 'absolute', width: 46, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  left: { left: 6 },
  right: { right: 6 },
  chevron: { fontSize: 32, lineHeight: 36 },
  footer: { height: 60, justifyContent: 'center', alignItems: 'center' },
  dots: { flexDirection: 'row', gap: 7 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  rankings: { position: 'absolute', right: 14, width: 48, height: 48, flexDirection: 'row', gap: 3, alignItems: 'flex-end', paddingBottom: 14, justifyContent: 'center' },
  bar: { width: 4, borderRadius: 2 },
  titleScreen: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center', padding: 26 },
  shard: { width: 0, height: 0, borderColor: 'transparent', borderStyle: 'solid' },
  montage: { ...StyleSheet.absoluteFill, backgroundColor: '#000000' },
  title: { color: '#FAF9F2', fontSize: 40, fontWeight: '900', letterSpacing: -1.8, textAlign: 'center' },
  titleCity: { color: '#FAF9F2', fontSize: 19, fontWeight: '600', marginTop: 8 },
});
