import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  type PressableProps,
  ScrollView,
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fanSections } from '@/constants/fan-sections';
import { haptic } from '@/ui/haptics';
import { useLayout } from '@/ui/layout';
import { ToastHost } from '@/ui/toast';
import { palette, radius, space, type } from '@/ui/tokens';

export type SectionTheme = { gameBackground: string; gameBackgroundDeep: string; surface: string; accent: string };

const SectionContext = createContext<SectionTheme>(fanSections[0]);
export const useSection = () => useContext(SectionContext);

/* ----------------------------------------------------------------- keyboard */

type ViewRef = ComponentRef<typeof View>;
type RevealContext = { reveal: (node: ViewRef) => void };
const ScrollRevealContext = createContext<RevealContext | null>(null);

/**
 * Attach `ref` to the block holding a text field and its suggestions, and call
 * `reveal` on focus (and whenever the block moves). The screen scrolls so the block
 * sits at the top of the visible area, keeping suggestions clear of the keyboard.
 */
export function useRevealOnFocus() {
  const context = useContext(ScrollRevealContext);
  const ref = useRef<ViewRef>(null);
  const reveal = useCallback(() => {
    if (ref.current) context?.reveal(ref.current);
  }, [context]);
  return [ref, reveal] as const;
}

/* ----------------------------------------------------------------- motion */

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setReduced(value); }, () => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { active = false; sub.remove(); };
  }, []);
  return reduced;
}

type FadeInProps = { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> };

/** Fades and lifts its children in on mount (native). */
function AnimatedFadeIn({ children, delay = 0, style }: FadeInProps) {
  const reduced = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1, duration: reduced ? 0 : 380, delay: reduced ? 0 : delay, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, progress, reduced]);
  return (
    <Animated.View style={[style, {
      opacity: progress,
      transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
    }]}>
      {children}
    </Animated.View>
  );
}

/** On the web, content appears immediately: desktop pages shouldn't wait on entrance animations. */
function StaticFadeIn({ children, style }: FadeInProps) {
  return <View style={style}>{children}</View>;
}

export const FadeIn = Platform.OS === 'web' ? StaticFadeIn : AnimatedFadeIn;

type PressableScaleProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  pressedScale?: number;
  feedback?: keyof typeof haptic | null;
};

/** Pressable with a springy scale and a light haptic tap. On the web it also lifts slightly on hover. */
export function PressableScale({ style, pressedScale = 0.97, feedback = 'tap', onPressIn, onPressOut, onPress, onHoverIn, onHoverOut, children, ...rest }: PressableScaleProps) {
  const [scale] = useState(() => new Animated.Value(1));
  const hovered = useRef(false);
  const to = (value: number) => Animated.spring(scale, { toValue: value, useNativeDriver: Platform.OS !== 'web', speed: 40, bounciness: 6 }).start();
  return (
    <Pressable
      {...rest}
      onHoverIn={(event) => { hovered.current = true; if (!rest.disabled) to(1.015); onHoverIn?.(event); }}
      onHoverOut={(event) => { hovered.current = false; to(1); onHoverOut?.(event); }}
      onPressIn={(event) => { to(pressedScale); onPressIn?.(event); }}
      onPressOut={(event) => { to(hovered.current ? 1.015 : 1); onPressOut?.(event); }}
      onPress={(event) => { if (feedback) haptic[feedback](); onPress?.(event); }}
    >
      {(state) => (
        <Animated.View style={[style, { transform: [{ scale }] }]}>
          {typeof children === 'function' ? children(state) : children}
        </Animated.View>
      )}
    </Pressable>
  );
}

/* ----------------------------------------------------------------- layout */

type ScreenProps = {
  section: SectionTheme;
  back?: Href;
  backLabel?: string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  /** Desktop column width; game screens use the default, hubs pass something wider. */
  desktopWidth?: number;
};

export function Screen({ section, back, backLabel = 'Back', eyebrow, title, subtitle, right, children, scroll = true, desktopWidth }: ScreenProps) {
  const layout = useLayout();
  const maxWidth = layout.wide ? desktopWidth ?? layout.contentWidth : layout.contentWidth;
  const body = (
    <>
      {(eyebrow || title || subtitle) && (
        <FadeIn style={[styles.titleBlock, layout.wide && styles.titleBlockWide]}>
          {!!eyebrow && <Text style={[type.eyebrow, { color: section.accent }]}>{eyebrow}</Text>}
          {!!title && <Text accessibilityRole="header" style={[type.display, layout.wide && styles.displayWide]}>{title}</Text>}
          {!!subtitle && <Text style={type.muted}>{subtitle}</Text>}
        </FadeIn>
      )}
      {children}
    </>
  );
  return (
    <SectionContext.Provider value={section}>
      <View style={styles.flex}>
        <StatusBar style="light" />
        <LinearGradient colors={[section.gameBackground, section.gameBackgroundDeep]} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
          {layout.wide ? <WebNav back={back} backLabel={backLabel} right={right} /> : (
            <View style={styles.header}>
              {back ? (
                <PressableScale accessibilityRole="button" accessibilityLabel={backLabel} hitSlop={8} style={styles.backButton}
                  onPress={() => router.dismissTo(back)}>
                  <Text style={styles.backIcon}>‹</Text>
                </PressableScale>
              ) : <View style={styles.backButton} />}
              <View style={styles.headerRight}>{right}</View>
            </View>
          )}
          {scroll
            ? <ScrollBody maxWidth={maxWidth} wide={layout.wide}>{body}</ScrollBody>
            : <View style={[styles.content, { maxWidth }, styles.flex]}>{body}</View>}
        </SafeAreaView>
        <ToastHost />
      </View>
    </SectionContext.Provider>
  );
}

/** Desktop navigation bar: wordmark home link, back link, page actions, and rankings. */
function WebNav({ back, backLabel, right }: { back?: Href; backLabel: string; right?: ReactNode }) {
  const section = useSection();
  return (
    <View style={styles.webNav}>
      <View style={styles.webNavInner}>
        <View style={styles.webNavLeft}>
          <Pressable accessibilityRole="link" accessibilityLabel="Stadium Pulse home" onPress={() => router.dismissTo('/')}>
            {({ hovered }) => <Text style={[styles.wordmark, hovered && { color: section.accent }]}>STADIUM PULSE</Text>}
          </Pressable>
          {back && back !== '/' && (
            <>
              <Text style={styles.navDivider}>/</Text>
              <Pressable accessibilityRole="link" accessibilityLabel={backLabel} onPress={() => router.dismissTo(back)}>
                {({ hovered }) => <Text style={[styles.navLink, hovered && { color: palette.text }]}>‹ {backLabel}</Text>}
              </Pressable>
            </>
          )}
        </View>
        <View style={styles.headerRight}>
          {right}
          <Pressable accessibilityRole="link" onPress={() => router.navigate('/rankings')}>
            {({ hovered }) => <Text style={[styles.navLink, hovered && { color: palette.text }]}>Rankings</Text>}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function ScrollBody({ children, maxWidth, wide }: { children: ReactNode; maxWidth: number; wide: boolean }) {
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const contentRef = useRef<ViewRef>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const context = useMemo<RevealContext>(() => ({
    reveal: (node) => {
      clearTimeout(timer.current);
      // Wait for the keyboard and any new layout to settle before measuring.
      timer.current = setTimeout(() => {
        const content = contentRef.current;
        if (!content) return;
        node.measureLayout(content, (_x: number, y: number) => {
          scrollRef.current?.scrollTo({ y: Math.max(0, y - space.md), animated: true });
        }, () => {});
      }, 250);
    },
  }), []);
  return (
    <ScrollRevealContext.Provider value={context}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} style={styles.flex} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
          <View ref={contentRef} style={[styles.content, { maxWidth }, wide && styles.contentWide]} collapsable={false}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScrollRevealContext.Provider>
  );
}

export function Card({ children, style, tone = 'default' }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: 'default' | 'raised' | 'outline' | 'success' | 'danger' | 'gold' }) {
  const section = useSection();
  return (
    <View style={[
      styles.card,
      tone === 'default' && { backgroundColor: section.surface },
      tone === 'raised' && { backgroundColor: palette.overlayStrong, borderColor: palette.borderStrong },
      tone === 'outline' && { backgroundColor: 'transparent', borderColor: palette.borderStrong },
      tone === 'success' && { backgroundColor: palette.successBg, borderColor: palette.success },
      tone === 'danger' && { backgroundColor: palette.dangerBg, borderColor: palette.danger },
      tone === 'gold' && { backgroundColor: palette.goldBg, borderColor: palette.gold },
      style,
    ]}>
      {children}
    </View>
  );
}

/* ---------------------------------------------------------------- buttons */

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  accessibilityLabel?: string;
  feedback?: keyof typeof haptic | null;
};

export function Button({ label, onPress, variant = 'primary', disabled, loading, icon, accessibilityLabel, feedback = 'tap' }: ButtonProps) {
  const section = useSection();
  const inactive = disabled || loading;
  const color = variant === 'primary' ? palette.dark : palette.text;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      feedback={feedback}
      style={[
        styles.button,
        variant === 'primary' && { backgroundColor: section.accent },
        variant === 'secondary' && { backgroundColor: palette.overlayStrong, borderColor: palette.border, borderWidth: 1 },
        variant === 'ghost' && styles.ghost,
        inactive && styles.disabled,
      ]}
    >
      {loading ? <ActivityIndicator color={color} /> : (
        <Text style={[styles.buttonText, { color }, variant === 'ghost' && { color: section.accent }]}>
          {icon ? `${icon}  ` : ''}{label}
        </Text>
      )}
    </PressableScale>
  );
}

export type ChoiceState = 'idle' | 'selected' | 'correct' | 'incorrect' | 'reveal' | 'dimmed';

export function Choice({ label, detail, state = 'idle', onPress, disabled, accessibilityLabel, badge }: {
  label: string;
  detail?: string;
  state?: ChoiceState;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  badge?: string;
}) {
  const section = useSection();
  const mark = state === 'correct' ? '✓' : state === 'incorrect' ? '✕' : state === 'selected' ? '●' : state === 'reveal' ? '✓' : badge;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: state === 'selected' || state === 'correct', disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      feedback="select"
      style={[
        styles.choice,
        state === 'selected' && { borderColor: section.accent, backgroundColor: palette.overlayStrong },
        state === 'correct' && { borderColor: palette.success, backgroundColor: palette.successBg },
        state === 'incorrect' && { borderColor: palette.danger, backgroundColor: palette.dangerBg },
        state === 'reveal' && { borderColor: palette.success, borderStyle: 'dashed' },
        state === 'dimmed' && styles.dimmed,
      ]}
    >
      <View style={styles.flex}>
        <Text style={styles.choiceText}>{label}</Text>
        {!!detail && <Text style={type.small}>{detail}</Text>}
      </View>
      {!!mark && (
        <Text style={[styles.choiceMark,
          state === 'selected' && { color: section.accent },
          (state === 'correct' || state === 'reveal') && { color: palette.success },
          state === 'incorrect' && { color: palette.danger }]}>{mark}</Text>
      )}
    </PressableScale>
  );
}

/* ------------------------------------------------------------------ bits */

export function Tag({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'accent' | 'success' | 'danger' | 'gold' }) {
  const section = useSection();
  const color = tone === 'accent' ? section.accent : tone === 'success' ? palette.success
    : tone === 'danger' ? palette.danger : tone === 'gold' ? palette.gold : palette.textMuted;
  return (
    <View style={[styles.tag, { borderColor: color }]}>
      <Text style={[styles.tagText, { color }]}>{label}</Text>
    </View>
  );
}

export function ProgressBar({ value, color, height = 6 }: { value: number; color?: string; height?: number }) {
  const section = useSection();
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(progress, { toValue: Math.max(0, Math.min(1, value)), duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [progress, value]);
  return (
    <View style={[styles.track, { height, borderRadius: height }]} accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}>
      <Animated.View style={{
        height, borderRadius: height, backgroundColor: color ?? section.accent,
        width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
      }} />
    </View>
  );
}

export function Stat({ value, label, color }: { value: string | number; label: string; color?: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
      <Text style={type.eyebrow}>{label}</Text>
    </View>
  );
}

export function Row({ children, style, gap = space.md }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[styles.row, { gap }, style]}>{children}</View>;
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function Notice({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={styles.notice}>
      {!!title && <Text style={[type.small, { color: palette.text, fontWeight: '700' }]}>{title}</Text>}
      <Text style={type.small}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { height: 52, paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.overlay },
  backIcon: { color: palette.text, fontSize: 30, lineHeight: 32, marginTop: -3, marginLeft: -2 },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: space.xl, paddingBottom: 56, paddingTop: space.sm, gap: space.lg },
  titleBlock: { gap: space.sm, marginBottom: space.sm },
  titleBlockWide: { marginTop: space.lg, marginBottom: space.lg },
  displayWide: { fontSize: 48, lineHeight: 54, letterSpacing: -2 },
  contentWide: { paddingTop: space.xl, paddingBottom: 96, gap: 20 },
  webNav: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border, backgroundColor: 'rgba(0,0,0,0.18)' },
  webNavInner: {
    height: 64, width: '100%', maxWidth: 1200, alignSelf: 'center', paddingHorizontal: space.xl,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  webNavLeft: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  wordmark: { color: palette.text, fontSize: 14, fontWeight: '900', letterSpacing: 2.6 },
  navDivider: { color: palette.textFaint, fontSize: 16 },
  navLink: { color: palette.textMuted, fontSize: 15, fontWeight: '700' },
  card: { borderRadius: radius.lg, padding: 18, gap: space.md, borderWidth: 1, borderColor: palette.border },
  button: { minHeight: 56, borderRadius: radius.md, paddingHorizontal: space.xl, alignItems: 'center', justifyContent: 'center' },
  ghost: { backgroundColor: 'transparent', minHeight: 44 },
  buttonText: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  disabled: { opacity: 0.4 },
  choice: {
    minHeight: 58, borderRadius: radius.md, borderWidth: 1.5, borderColor: palette.border,
    backgroundColor: palette.overlay, paddingHorizontal: space.lg, paddingVertical: space.md,
    flexDirection: 'row', alignItems: 'center', gap: space.md,
  },
  choiceText: { color: palette.text, fontSize: 17, fontWeight: '600', lineHeight: 23 },
  choiceMark: { color: palette.textMuted, fontSize: 18, fontWeight: '800' },
  dimmed: { opacity: 0.45 },
  tag: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  tagText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  track: { backgroundColor: palette.overlayStrong, overflow: 'hidden', width: '100%' },
  stat: { flex: 1, gap: 2 },
  statValue: { color: palette.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: palette.borderStrong },
  notice: { gap: 4, paddingVertical: space.md, paddingHorizontal: space.lg, borderRadius: radius.md, backgroundColor: palette.overlay },
});
