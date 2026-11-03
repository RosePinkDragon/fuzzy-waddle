/**
 * Word bank loader. Each category has one JSON file next to this one; see the
 * README section "Adding or editing words".
 */
import { INCLUDE_DRAFT_WORDS } from '@/game/config';
import { poolDifficulties } from '@/game/difficulty';
import type { CategoryId, Difficulty, ThemeId, Word, WordEntry } from '@/game/types';

import cricket from './cricket.json';
import filmy from './filmy.json';
import khana from './khana.json';
import safar from './safar.json';
import tyohar from './tyohar.json';

export const CATEGORY_IDS: CategoryId[] = ['filmy', 'khana', 'safar', 'cricket', 'tyohar'];

export const RAW_BANKS: Record<CategoryId, WordEntry[]> = {
  filmy: filmy as WordEntry[],
  khana: khana as WordEntry[],
  safar: safar as WordEntry[],
  cricket: cricket as WordEntry[],
  tyohar: tyohar as WordEntry[],
};

export const ALL_WORDS: Word[] = CATEGORY_IDS.flatMap((category) =>
  RAW_BANKS[category].map((w) => ({ ...w, category })),
);

const BY_ID = new Map(ALL_WORDS.map((w) => [w.id, w]));

export function wordById(id: string): Word | undefined {
  return BY_ID.get(id);
}

function playable(w: Word): boolean {
  return w.status === 'approved' || (INCLUDE_DRAFT_WORDS && w.status === 'draft');
}

/** Words a run of this theme and difficulty draws from. Masala Mix uses every category. */
export function poolFor(theme: ThemeId, difficulty: Difficulty): Word[] {
  const tiers = new Set(poolDifficulties(difficulty));
  return ALL_WORDS.filter(
    (w) => (theme === 'masala' || w.category === theme) && tiers.has(w.difficulty) && playable(w),
  );
}

/** Words available for a one-off challenge from this category. */
export function challengePool(category: CategoryId): Word[] {
  return ALL_WORDS.filter((w) => w.category === category && playable(w));
}
