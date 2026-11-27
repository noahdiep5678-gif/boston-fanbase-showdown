import { StyleSheet } from 'react-native';

export const palette = {
  text: '#FFFFFF',
  textMuted: 'rgba(255,255,255,0.70)',
  textFaint: 'rgba(255,255,255,0.48)',
  border: 'rgba(255,255,255,0.14)',
  borderStrong: 'rgba(255,255,255,0.32)',
  overlay: 'rgba(255,255,255,0.07)',
  overlayStrong: 'rgba(255,255,255,0.13)',
  success: '#5EE39A',
  successBg: 'rgba(94,227,154,0.16)',
  danger: '#FF7A8A',
  dangerBg: 'rgba(255,122,138,0.16)',
  gold: '#FFD166',
  goldBg: 'rgba(255,209,102,0.16)',
  dark: '#0B0D12',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;

export const type = StyleSheet.create({
  display: { color: palette.text, fontSize: 36, fontWeight: '900', letterSpacing: -1.4, lineHeight: 40 },
  title: { color: palette.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.6, lineHeight: 30 },
  heading: { color: palette.text, fontSize: 19, fontWeight: '700', lineHeight: 26 },
  body: { color: palette.text, fontSize: 16, lineHeight: 23 },
  muted: { color: palette.textMuted, fontSize: 15, lineHeight: 22 },
  small: { color: palette.textMuted, fontSize: 13, lineHeight: 18 },
  eyebrow: { color: palette.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase' },
  number: { color: palette.text, fontSize: 44, fontWeight: '900', letterSpacing: -1.5, fontVariant: ['tabular-nums'] },
});
