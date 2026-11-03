/**
 * Answers are stored uppercase with one canonical spelling. Only A-Z are
 * guessable; spaces split words, and digits and punctuation are revealed
 * automatically.
 */

export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const ALLOWED = /^[A-Z0-9 '&.,!?:-]+$/;

export function isGuessable(ch: string): boolean {
  return ch.length === 1 && ch >= 'A' && ch <= 'Z';
}

/** Uppercases, trims and collapses whitespace. */
export function normalizeAnswer(raw: string): string {
  return raw.toUpperCase().trim().replace(/\s+/g, ' ');
}

/** Returns a problem description, or null if the answer is in canonical form. */
export function answerProblem(answer: string): string | null {
  if (answer !== normalizeAnswer(answer)) return 'not in canonical form (uppercase, single spaces, trimmed)';
  if (!ALLOWED.test(answer)) return 'contains characters outside A-Z, 0-9, space and basic punctuation';
  if (!answer.split('').some(isGuessable)) return 'has no guessable letters';
  return null;
}

/** Distinct guessable letters in the answer. */
export function lettersOf(answer: string): Set<string> {
  return new Set(answer.split('').filter(isGuessable));
}

export interface Tile {
  ch: string;
  /** Non-letters (digits, punctuation) are shown from the start. */
  auto: boolean;
}

/** Splits an answer into words of tiles. Spaces become word breaks. */
export function tokenize(answer: string): Tile[][] {
  return answer
    .split(' ')
    .filter(Boolean)
    .map((word) => word.split('').map((ch) => ({ ch, auto: !isGuessable(ch) })));
}

export function isSolved(answer: string, correct: Iterable<string>): boolean {
  const got = new Set(correct);
  for (const l of lettersOf(answer)) if (!got.has(l)) return false;
  return true;
}

/** Display form for sentences: "KUCH KUCH HOTA HAI" -> "Kuch Kuch Hota Hai". */
const SMALL_WORDS = new Set(['OF', 'THE', 'AND', 'IN', 'ON', 'AT', 'TO', 'FOR']);
export function displayAnswer(answer: string): string {
  return answer
    .split(' ')
    .map((w, i) => {
      if (i > 0 && SMALL_WORDS.has(w)) return w.toLowerCase();
      return w.charAt(0) + w.slice(1).toLowerCase();
    })
    .join(' ');
}
