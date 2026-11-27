import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

import { palette, radius, space } from '@/ui/tokens';

type Listener = (text: string) => void;
const listeners = new Set<Listener>();

/** Show a brief message at the bottom of the screen. */
export function showToast(text: string) {
  listeners.forEach((listener) => listener(text));
}

/** Rendered once by each Screen. */
export function ToastHost() {
  const [text, setText] = useState('');
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const listener: Listener = (next) => {
      setText(next);
      clearTimeout(timer);
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
      timer = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start();
      }, 2200);
    };
    listeners.add(listener);
    return () => { listeners.delete(listener); clearTimeout(timer); };
  }, [opacity]);

  if (!text) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.toast, { opacity }]} accessibilityLiveRegion="polite">
      <Text style={styles.text}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute', bottom: 32, alignSelf: 'center', backgroundColor: 'rgba(11,13,18,0.92)',
    borderRadius: radius.pill, paddingHorizontal: space.xl, paddingVertical: space.md,
    borderWidth: 1, borderColor: palette.borderStrong,
  },
  text: { color: palette.text, fontSize: 15, fontWeight: '700' },
});
