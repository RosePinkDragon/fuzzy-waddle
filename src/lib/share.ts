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

/**
 * Opens the native share sheet. On web it uses the Web Share API where
 * available and otherwise opens WhatsApp's share link.
 */
export async function shareText(message: string): Promise<void> {
  if (Platform.OS === 'web') {
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    if (nav?.share) {
      try {
        await nav.share({ text: message });
        return;
      } catch {
        // Cancelled or blocked: fall through to WhatsApp.
      }
    }
    if (typeof window !== 'undefined') {
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
    }
    return;
  }
  try {
    await Share.share({ message });
  } catch {
    // User dismissed the sheet.
  }
}
