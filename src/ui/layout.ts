import { Platform, useWindowDimensions } from 'react-native';

/** Breakpoints for the web layout. Phones (and narrow browser windows) keep the mobile design. */
export const WIDE = 900;
export const XWIDE = 1240;

export function useLayout() {
  const { width, height } = useWindowDimensions();
  const web = Platform.OS === 'web';
  const wide = web && width >= WIDE;
  return {
    web,
    wide,
    xwide: web && width >= XWIDE,
    width,
    height,
    /** Column width for game screens: phone-like on mobile, roomier on desktop. */
    contentWidth: wide ? 760 : 600,
  };
}
