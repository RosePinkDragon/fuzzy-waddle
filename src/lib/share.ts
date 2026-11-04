import { Platform, Share } from 'react-native';

import game from '@/config/game.json';

/** Where challenge links point. On web we use the current origin so previews work anywhere. */
export function webOrigin(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return game.webOrigin;
}

/** https://<domain>/c/<wordId>?from=<name>: carries the word ID, never the answer. */
export function challengeUrl(wordId: string, from?: string): string {
  const base = `${webOrigin()}/c/${encodeURIComponent(wordId)}`;
  return from ? `${base}?from=${encodeURIComponent(from)}` : base;
}

export type ShareResult = 'shared' | 'cancelled' | 'failed' | 'fallback';

const isCancel = (e: unknown) => typeof e === 'object' && e !== null && (e as { name?: unknown }).name === 'AbortError';

/**
 * Opens the native share sheet. On web it uses the Web Share API where
 * available and otherwise opens WhatsApp's share link.
 *
 * With Web Share available, a cancel (AbortError) just stops, and any other
 * failure is logged and stops too: neither opens a WhatsApp tab the player
 * didn't ask for. Only a browser with no Web Share falls back to WhatsApp.
 * The fallback uses 'noopener', which makes window.open return null even on
 * success, so a blocked popup can't be detected. That is accepted.
 */
export async function shareText(message: string): Promise<ShareResult> {
  if (Platform.OS === 'web') {
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    if (typeof nav?.share === 'function') {
      try {
        await nav.share({ text: message });
        return 'shared';
      } catch (e) {
        if (isCancel(e)) return 'cancelled';
        console.warn('Web share failed', e);
        return 'failed';
      }
    }
    if (typeof window !== 'undefined') {
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
      return 'fallback';
    }
    return 'failed';
  }
  try {
    const result = await Share.share({ message });
    return result.action === Share.dismissedAction ? 'cancelled' : 'shared';
  } catch (e) {
    // The native sheet reports a dismissal as a result, so a throw is a real failure.
    console.warn('Share failed', e);
    return 'failed';
  }
}
