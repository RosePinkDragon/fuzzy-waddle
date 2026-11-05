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
  /** The authoritative saved session for one theme + difficulty (see `runStore`). */
  run: (theme: ThemeId, d: Difficulty) => `run:${theme}:${d}`,
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

/** A read that says whether storage answered: `raw` is null only when the key is really absent. */
export type RawRead = { ok: true; raw: string | null } | { ok: false };

/** Like `load`, but tells a missing key apart from a failed read. Parsing is the caller's job. */
export async function readRaw(key: string): Promise<RawRead> {
  try {
    return { ok: true, raw: await AsyncStorage.getItem(PREFIX + key) };
  } catch {
    return { ok: false };
  }
}

/** Like `save`, but reports whether the write completed. */
export async function writeRaw(key: string, raw: string): Promise<boolean> {
  try {
    await AsyncStorage.setItem(PREFIX + key, raw);
    return true;
  } catch {
    return false;
  }
}
