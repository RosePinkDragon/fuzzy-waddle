/**
 * Every line of copy in the app. Themed lines are Hinglish in Roman script;
 * functional UI (buttons, labels) stays in plain English. The themed lines are
 * waiting on a review by real fans, so edit freely here.
 */
import game from '@/config/game.json';
import type { CategoryId, Difficulty, ThemeId } from '@/game/types';

/** The game name is undecided (see README "Open decisions"); change it in src/config/game.json. */
export const GAME_NAME: string = game.name;

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
  nextHit: 'Next hit: ',
  bossRound: 'boss round',
  clueLocked: (powerUp: string) => `Clue locked. Use ${powerUp} to unlock it.`,
  bossCleared: 'BOSS ROUND CLEARED',
  livesRefilled: (n: number) => `Lives refilled: ${n} of ${n}`,
  plusOne: (powerUp: string) => `+1 ${powerUp}`,
  next: 'Next: ',
  hitsToGo: (n: number) => `${plural(n, 'hit', 'hits')} to go`,
  shareCard: (label: string) => `${label} · SHARE CARD`,
  challengeOnWhatsApp: 'Challenge on WhatsApp',
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
