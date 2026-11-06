/**
 * Every line of copy in the app. Themed lines are Hinglish in Roman script;
 * functional UI (buttons, labels) stays in plain English. The themed lines are
 * waiting on a review by real fans, so edit freely here.
 */
import game from '@/config/game.json';
import type { CategoryId, Difficulty, ThemeId } from '@/game/types';

/** The game name is undecided (see README "Open decisions"); change it in src/config/game.json. */
export const GAME_NAME: string = game.name;

/** A best as copy needs it. Structural, so this file never imports the saved-run modules (challenges use it). */
interface BestLike {
  hits: number;
  club: number | null;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

export const ui = {
  back: 'Back',
  clues: 'CLUES',
  livesLeft: (n: number) => `${n} LEFT`,
  hits: (n: number) => plural(n, 'hit', 'hits'),
  runOver: 'Run over',
  noClub: 'No club yet',
  moreTo: (n: number) => `${n} more to `,
  /** Before the club name (shown highlighted) while the word in play is a boss round. */
  bossWinFor: 'Boss round · Win for ',
  clueLocked: (powerUp: string) => `Clue locked. Use ${powerUp} to unlock it.`,
  bossCleared: 'BOSS ROUND CLEARED',
  livesRefilled: (n: number) => `Lives refilled: ${n} of ${n}`,
  plusOne: (powerUp: string, amount = 1) => `+${amount} ${powerUp}`,
  next: 'Next: ',
  hitsToGo: (n: number) => `${plural(n, 'hit', 'hits')} to go`,
  shareCard: (label: string) => `${label} · SHARE CARD`,
  shareChallenge: 'Share challenge',
  keepPlaying: 'Keep playing',
  newRandomRun: 'New random run',
  challengeThisOne: 'Challenge a friend with this one',
  changeDifficulty: 'Change difficulty',
  thisRun: 'THIS RUN',
  yourBest: (d: Difficulty) => `YOUR BEST · ${DIFFICULTY_LABEL[d].toUpperCase()}`,
  newBest: 'New best!',
  answerWas: (noun: string) => `The ${noun} was `,
  powerUpA11y: (name: string, does: string, n: number) => `${name}: ${does}, ${n} left`,
  keyA11y: (l: string, state: 'right' | 'wrong' | 'removed' | 'open') =>
    state === 'open' ? l : `${l}, ${state === 'right' ? 'in the answer' : state === 'wrong' ? 'not in the answer' : 'removed'}`,
};

/** What each power-up slot does (same in every theme). */
export const POWER_UP_DOES = ['reveal one letter', 'get an extra clue', 'undo a wrong guess', 'remove 3 wrong letters'];

export const milestoneHeading = (clubLong: string) => `${clubLong} mein entry!`;

/** "100 Crore Club bas 2 hits door tha" split so the hit count can be highlighted. */
export const nearMiss = (clubLong: string, n: number) => ({
  before: `${clubLong} bas `,
  highlight: plural(n, 'hit', 'hits'),
  after: ' door tha',
});

export interface ThemeCopy {
  /** Label above the header title, e.g. "FILMY". */
  label: string;
  /** Name in sentences and the share card, e.g. "Filmy". */
  name: string;
  /** Home screen one-liner. */
  blurb: string;
  winStamp: string;
  flopStamp: string;
  flopLine: string;
  restart: string;
  /** Share line on the milestone screen. `{club}` is replaced with the club reached. */
  shareLine: string;
  /** Share card ticket label, e.g. "ADMIT ONE". */
  cardLabel: string;
  /** Flop screen: "The movie was ...". */
  answerNoun: string;
  /** Word shown on the lives sign before the marks (letter-style signs have none). */
  livesLabel?: string;
  /** Power-up names for slots 1 to 4. */
  powerUps: [string, string, string, string];
}

export const themeCopy: Record<ThemeId, ThemeCopy> = {
  filmy: {
    label: 'FILMY',
    name: 'Filmy',
    blurb: 'Hindi film titles',
    winStamp: 'Blockbuster!',
    flopStamp: 'Box Office Flop',
    flopLine: 'Interval se pehle hi The End.',
    restart: 'Sequel banao',
    shareLine: '{club} pahunch gaya. Tu kitne pe atka?',
    cardLabel: 'ADMIT ONE',
    answerNoun: 'movie',
    powerUps: ["Director's Cut", 'Trailer', 'Flashback', 'Censor Board'],
  },
  khana: {
    label: 'KHANA',
    name: 'Khana',
    blurb: 'Dishes, street food, mithai',
    winStamp: 'Swaad Aa Gaya!',
    flopStamp: 'Dal Jal Gayi!',
    flopLine: 'Mummy ko mat batana.',
    restart: 'Phir se banao',
    shareLine: 'Ek bhi dish nahi jali. Tera kya scene?',
    cardLabel: 'BILL',
    answerNoun: 'dish',
    livesLabel: 'SEETI',
    powerUps: ['Chakh Lo', 'Maa se Pucho', 'Aloo Daalo', 'Chhaan Lo'],
  },
  safar: {
    label: 'SAFAR',
    name: 'Safar',
    blurb: 'Cities, monuments, hill stations',
    winStamp: 'Pahunch Gaye!',
    flopStamp: 'Train Chhoot Gayi!',
    flopLine: 'Agli wali pakad lena.',
    restart: 'Agli train pakdo',
    shareLine: 'Ek bhi train miss nahi hui. Tu bata?',
    cardLabel: 'TICKET',
    answerNoun: 'place',
    livesLabel: 'COACHES',
    powerUps: ['Window Seat', 'Rasta Pucho', 'Chain Kheecho', 'TC Check'],
  },
  cricket: {
    label: 'CRICKET',
    name: 'Cricket',
    blurb: 'Terms, grounds, tournaments',
    winStamp: 'Chhakka!',
    flopStamp: 'All Out!',
    flopLine: 'Pitch hi kharab thi.',
    restart: 'Phir se batting',
    shareLine: 'Match jeeta, wo bhi last ball pe. Tu?',
    cardLabel: 'MATCH PASS',
    answerNoun: 'answer',
    livesLabel: 'WICKETS',
    powerUps: ['Free Hit', 'Commentary', 'DRS', 'Run Out'],
  },
  tyohar: {
    label: 'TYOHAR',
    name: 'Tyohar',
    blurb: 'Festivals',
    winStamp: 'Badhai Ho!',
    flopStamp: 'Light Chali Gayi!',
    flopLine: 'Mehmaan aa gaye, ghar mein andhera.',
    restart: 'Diye phir jalao',
    shareLine: 'Saare diye jalte rahe. Tu bata?',
    cardLabel: 'GREETINGS',
    answerNoun: 'festival',
    livesLabel: 'DIYAS',
    powerUps: ['Phuljhadi', 'Dadi se Pucho', 'Diya Jalao', 'Safai'],
  },
  masala: {
    label: 'MASALA MIX',
    name: 'Masala Mix',
    blurb: 'Sab kuch, thoda thoda',
    winStamp: 'Paisa Vasool!',
    flopStamp: 'Mirchi Lag Gayi!',
    flopLine: 'Thanda paani piyo, phir aao.',
    restart: 'Ek aur plate',
    shareLine: 'Sab mix tha, phir bhi jeet gaya. Tu?',
    cardLabel: 'MIX PLATE',
    answerNoun: 'answer',
    powerUps: ['Jugaad', 'Gyaan', 'U-Turn', 'Bhagao'],
  },
};

export const shareLineFor = (theme: ThemeId, clubLong: string) => themeCopy[theme].shareLine.replace('{club}', clubLong);

/** Share-sheet message for a challenge link. */
export const challengeMessage = (category: CategoryId, url: string) =>
  `Ek ${themeCopy[category].name} word. Guess karke dikha! ${url}`;

export const shareMessage = (line: string, url: string) => `${line} ${url}`;

export const home = {
  tagline: 'Desi hangman. Endless runs, filmy drama.',
  pick: 'PICK A CATEGORY',
  best: (hits: number, club: string | null) => `Best: ${plural(hits, 'hit', 'hits')}${club ? ` · ${club}` : ''}`,
  noBest: 'Not played yet',
};

export const difficultyPicker = {
  title: 'Kitna tough?',
  subtitle: 'Pick a difficulty',
  detail: {
    easy: '9 lives · chips + clue',
    medium: '7 lives · clue only',
    hard: '5 lives · category only',
  } satisfies Record<Difficulty, string>,
  footnote: 'Lives carry over from word to word. Every club is a boss round.',
};

/** "50 Cr Club", from a stored club's crore. */
export const clubText = (crore: number) => `${crore} Cr Club`;

/** The Resume and New run choices on the difficulty picker (Picker layout A, #57). */
export const picker = {
  resume: 'Resume',
  newRun: 'New run',
  runProgress: (hits: number, club: number | null) => `${plural(hits, 'hit', 'hits')}${club ? ` · ${clubText(club)}` : ''}`,
  best: (best: BestLike) => home.best(best.hits, best.club ? clubText(best.club) : null),
  notPlayed: home.noBest,
  noBestYet: 'No best yet',
  bestUnavailable: 'Best: unavailable',
  chip: { saved: 'SAVED RUN', notSaved: 'NOT SAVED' },
};

/** What a New run costs, shown before a saved run is ended. */
export const newRun = {
  title: 'Naya run shuru karna hai?',
  ends: (difficulty: Difficulty, hits: number, lives: number) =>
    `Your ${DIFFICULTY_LABEL[difficulty]} run ends here: ${plural(hits, 'hit', 'hits')}, ${plural(lives, 'life', 'lives')} left.`,
  bestUp: (difficulty: Difficulty, from: number, to: number) =>
    `Your ${DIFFICULTY_LABEL[difficulty]} best goes up from ${from} to ${plural(to, 'hit', 'hits')}.`,
  bestStays: (difficulty: Difficulty, best: number) => `Your ${DIFFICULTY_LABEL[difficulty]} best stays at ${plural(best, 'hit', 'hits')}.`,
  noHits: 'No hits yet, so nothing is recorded.',
  clubUp: (difficulty: Difficulty, crore: number) => `Your ${DIFFICULTY_LABEL[difficulty]} club best goes up to ${clubText(crore)}.`,
  clubStays: (difficulty: Difficulty, crore: number) => `Your ${DIFFICULTY_LABEL[difficulty]} club best stays at ${clubText(crore)}.`,
  keep: 'Keep this run',
  confirm: 'End it, start new run',
  /**
   * The lines under the title: where the run ends, then what happens to the best. `settled` is the best
   * after the run is folded in (`settleBest` in the caller), so the sheet says exactly what will be saved.
   * No hits replaces both best lines. The club line is left out when there's no club, and says "goes up"
   * only when the club best actually changes.
   */
  lines: (difficulty: Difficulty, hits: number, lives: number, best: BestLike | null, settled: BestLike | null): string[] => {
    const lines = [newRun.ends(difficulty, hits, lives)];
    if (hits <= 0) return [...lines, newRun.noHits];
    if (!settled) return lines;
    lines.push(
      hits > (best?.hits ?? 0) ? newRun.bestUp(difficulty, best?.hits ?? 0, settled.hits) : newRun.bestStays(difficulty, settled.hits),
    );
    if (settled.club) {
      lines.push(settled.club !== (best?.club ?? null) ? newRun.clubUp(difficulty, settled.club) : newRun.clubStays(difficulty, settled.club));
    }
    return lines;
  },
};

export const recovery = {
  title: (difficulty: Difficulty) => `Last ${DIFFICULTY_LABEL[difficulty]} run khul nahi paaya`,
  /** The bests line is left out when no best survived, so it never promises something that isn't there. */
  body: (hasBest: boolean) =>
    `It couldn't be restored safely, so it has ended.${hasBest ? ' Your bests stay as they were.' : ''}`,
};

export const unsaved = {
  pickerTitle: 'Saving is off on this device',
  pickerBody: "Play on, but closing the app loses your run. Bests won't be kept.",
  gameStripTitle: 'Not saved:',
  gameStripBody: 'closing the app ends this run.',
  /** The strip's full text, and the compact chip's accessibility label. */
  gameStrip: 'Not saved: closing the app ends this run.',
  gameChip: 'NOT SAVED',
};

export const wordReplaced = {
  title: 'Naya word aa gaya',
  body1: 'Purana word gaya, yeh lo naya.',
  body2: (hits: number, lives: number, club: number | null) => {
    const h = plural(hits, 'hit', 'hits');
    const l = plural(lives, 'life', 'lives');
    return club ? `Your ${h}, ${l} and ${clubText(club)} are kept.` : `Your ${h} and ${l} are kept.`;
  },
  refund: (count: number, powerUp: string) => `GOT BACK: ${count} ${powerUp.toUpperCase()}`,
  cta: 'Play on',
  /** One "GOT BACK" chip per refunded power-up (reveal is slot 0, clue slot 1, remove slot 3). */
  refunds: (refunds: { reveal: number; clue: number; remove: number }, names: readonly string[]): string[] =>
    ([
      [refunds.reveal, names[0]],
      [refunds.clue, names[1]],
      [refunds.remove, names[3]],
    ] as const)
      .filter(([count]) => count > 0)
      .map(([count, name]) => wordReplaced.refund(count, name)),
};

export const a11y = {
  resume: (difficulty: Difficulty, hits: number, lives: number) =>
    `Resume ${DIFFICULTY_LABEL[difficulty]} run: ${plural(hits, 'hit', 'hits')}, ${lives} ${lives === 1 ? 'life' : 'lives'} left`,
  newRun: (difficulty: Difficulty) => `New ${DIFFICULTY_LABEL[difficulty]} run`,
  difficultyCard: (difficulty: Difficulty, meta: string, best: string) => `${DIFFICULTY_LABEL[difficulty]}: ${meta}. ${best}`,
  dismiss: 'Dismiss',
};

export const challenge = {
  from: (name: string) => `${name} ne challenge kiya!`,
  anonymous: 'Tujhe challenge mila hai!',
  intro: (categoryName: string) => `Ek word, ${categoryName} se. Dekhte hain kitna jaanta hai.`,
  accept: 'Accept challenge',
  solvedTitle: 'Ho gaya!',
  solvedLine: (name?: string) => (name ? `${name} ko bata de, tu bhi kam nahi.` : 'Ek dum sahi. Ab kisi aur ko challenge kar.'),
  failedTitle: 'Arre yaar!',
  failedLine: 'Agli baar pakka.',
  challengeBack: 'Challenge back',
  fullRun: 'Play a full run',
  badLinkTitle: 'Ye link toot gaya.',
  badLinkLine: "We couldn't find that challenge. Play a run instead?",
  home: 'Go to home',
  label: 'CHALLENGE',
  oneWord: 'One word',
};

export const namePrompt = {
  title: 'Your name',
  help: (example: string) => `Your friend will see "${example}".`,
  placeholder: 'Naam',
  share: 'Share',
  cancel: 'Cancel',
};
