/**
 * Small AsyncStorage wrapper (localStorage on web). Failures are swallowed:
 * losing a saved bag or best score must never break a game.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Difficulty, ThemeId } from '@/game/types';

const PREFIX = 'hangman:v1:';

export const keys = {
  bag: (theme: ThemeId, d: Difficulty) => `bag:${theme}:${d}`,
  best: (theme: ThemeId, d: Difficulty) => `best:${theme}:${d}`,
  playerName: 'playerName',
};

/** Best score for one theme + difficulty: hits and the club reached (crore), if any. */
export interface Best {
  hits: number;
  club: number | null;
}

export async function load<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export async function save(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable (private mode): keep playing.
  }
}
