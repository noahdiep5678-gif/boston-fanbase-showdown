import { Platform, Share } from 'react-native';

import { showToast } from '@/ui/toast';

/**
 * Share text via the native share sheet. On desktop browsers without a share sheet,
 * copy to the clipboard instead and confirm with a toast.
 */
export async function shareText(message: string) {
  if (Platform.OS === 'web') {
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    if (nav?.share && /Mobi|Android|iPhone|iPad/i.test(nav.userAgent)) {
      try {
        await nav.share({ text: message });
        return;
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') return;
      }
    }
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(message);
      showToast('Copied to clipboard — paste it anywhere');
      return;
    }
    throw new Error('Sharing is not available in this browser.');
  }
  await Share.share({ message });
}
