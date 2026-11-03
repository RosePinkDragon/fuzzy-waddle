export type Difficulty = 'easy' | 'medium' | 'hard';

/** A category that owns a word bank. */
export type CategoryId = 'filmy' | 'khana' | 'safar' | 'cricket' | 'tyohar';

/** A playable theme: every category, plus Masala Mix which draws from all of them. */
export type ThemeId = CategoryId | 'masala';

export type WordStatus = 'draft' | 'approved';

/** One entry in a category's JSON word bank (see BRIEF.md section 6). */
export interface WordEntry {
  id: string;
  /** Uppercase, one canonical spelling. Spaces, digits and punctuation are auto-revealed. */
  answer: string;
  difficulty: Difficulty;
  /** 0 to 2 short facts, shown as chips on Easy. */
  chips: string[];
  /** One friendly Hinglish line. */
  clue: string;
  /** Shown by the slot-2 power-up. */
  extraClue: string;
  status: WordStatus;
}

/** A word entry tagged with the category it came from. */
export interface Word extends WordEntry {
  category: CategoryId;
}

/** A clue level that the slot-2 power-up can unlock. */
export type ClueLevel = 'clue' | 'extraClue';

export interface DifficultyRules {
  /** Lives at the start of a run and after a milestone refill. */
  lives: number;
  /** Marks on the lives sign that are pre-locked (always LIVES_MARKS - lives). */
  locked: number;
  /** Whether the chips row shows from the start. */
  showChips: boolean;
  /** Clue levels visible from the start. */
  shownClues: ClueLevel[];
  /** Clue levels the slot-2 power-up unlocks, in order. */
  hiddenClues: ClueLevel[];
  /** Word difficulties that make up the pool. */
  pool: Difficulty[];
}

export interface Club {
  /** 0-based position on the ladder. */
  index: number;
  /** Crore amount in the club's name, e.g. 100 for "100 Crore Club". */
  crore: number;
  /** Total hits needed to enter. */
  hits: number;
}

/** Returns a float in [0, 1). Injected so tests can be deterministic. */
export type Rng = () => number;
