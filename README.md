# [Game name]: desi hangman (v1)

Indian hangman for phones: endless runs across five desi categories plus Masala Mix, with filmy humour throughout. Built with Expo (React Native + TypeScript + Expo Router), so one codebase covers iOS, Android and the web build that WhatsApp challenge links open.

The product brief is in [BRIEF.md](BRIEF.md). The design references are in `design/`: rendered mockups in `design/screens/`, mockup sources in `design/source/`, and screenshots of this build in `design/build-screenshots/`.

## Running it

Needs Node 20+ (CI uses Node 22).

```sh
npm install
npm start          # Expo dev server: scan the QR code with Expo Go, or press w for web
npm run web        # web only
```

Checks (the same ones CI runs):

```sh
npm run lint
npm run typecheck
npm test
npx expo export --platform web   # static web build in dist/
```

The web build is a single-page app (`web.output: "single"`). Whatever hosts `dist/` must serve `index.html` for every path, so `/c/<wordId>` challenge links work.

### Test builds

Two build-time switches exist for testing only. Release builds refuse them: a build with `RELEASE_BUILD=1`, or an EAS build on the `preview` or `production` profile, fails in `app.config.ts` if either one is set to any non-empty value (see `src/lib/releaseGuard.ts`).

- `EXPO_PUBLIC_TEST_LADDER=1` uses a short club ladder (first club at 2 hits) so a milestone is quick to reach by hand.
- `EXPO_PUBLIC_TEST_HOOKS=1` exposes the current answer on `globalThis.__HANGMAN__` so browser tests can play a run.

```sh
EXPO_PUBLIC_TEST_LADDER=1 npm run web
```

## How the code is laid out

```
src/
  app/                 routes: / (home), /play/[theme] (difficulty), /play/[theme]/[difficulty] (run), /c/[wordId] (challenge)
  game/                pure TypeScript game logic, with unit tests in game/__tests__
    config.ts          every tuning number: lives, pools, club ladder, power-up counts
    run.ts             run state: guesses, lives, hits, boss rounds, milestone refill
    powerUps.ts        the four power-up slots
    milestones.ts      the club ladder (continues past 1000 Cr)
    shuffleBag.ts      no repeats until the pool is used up; boss-word draw
    answer.ts          canonical answers, auto-reveal of non-letters
    tileLayout.ts      tile wrapping and shrinking
  data/words/          one JSON word bank per category, plus the loader and its validation test
  themes/              a theme is config: colours, lives sign, scenes, power-up names and icons
    themes.ts          the six themes
    scenes/ported/     scene art ported from the mockups (generated, see below)
  copy/strings.ts      every line of copy, including all themed lines
  config/game.json     game name, web domain and bundle IDs (placeholders)
  components/          shared UI
  screens/             game, milestone and run-over screens
  hooks/useRun.ts      connects a saved run (lib/runController) to the run screen: app lifecycle, haptics, the Masala Mix reel
scripts/port-scenes.js converts the mockup SVG scenes into react-native-svg components
```

Scene art comes straight from the mockups. To change a scene, edit the SVG in `design/source/<Screen>.dc.html` and run `npm run port-scenes`. Don't edit files in `src/themes/scenes/ported/` by hand. Two scene parts respond to the game, so they're drawn by hand-written components: Tyohar's nine diyas (`DiyaRow`, one per life) and the Masala Mix slot reel (`SlotReel`).

## Adding or editing words

Each category has one file: `src/data/words/filmy.json`, `khana.json`, `safar.json`, `cricket.json` and `tyohar.json`. Masala Mix draws from all five.

```json
{
  "id": "filmy-003",
  "answer": "KUCH KUCH HOTA HAI",
  "difficulty": "easy",
  "chips": ["1998", "Romance"],
  "clue": "Rahul, Anjali aur Tina. Kyunki pyaar dosti hai.",
  "extraClue": "Summer camp, chhoti Anjali aur mummy ki chitthiyan.",
  "status": "draft"
}
```

| Field | Rules |
|---|---|
| `id` | `<category>-NNN`. Never reuse or renumber an ID: challenge links point at IDs. To retire a word, delete it. Old links to it then show "link toot gaya". |
| `answer` | Uppercase, one canonical spelling, single spaces. A–Z are guessed; digits and punctuation (`3 IDIOTS`, `BARFI!`, `LORD'S`) are shown automatically. Keep each word to 11 letters or fewer so it fits on a narrow phone. |
| `difficulty` | `easy`, `medium` or `hard`. Easy runs use easy words; Medium uses easy + medium; Hard uses medium + hard. |
| `chips` | 0–2 short facts, up to 20 characters each. Shown on Easy, on the milestone screen and on the flop screen (a 4-digit year chip appears as "(1998)"). |
| `clue` | One friendly Hinglish line, 90 characters max. |
| `extraClue` | Unlocked by the slot-2 power-up, 90 characters max. |
| `status` | `draft` or `approved`. |
| `display` | Optional. How to write the answer in sentences when automatic title case gets it wrong, e.g. `"IPL"`. (Words with no vowels, like `PK` or `MBBS`, already stay uppercase.) |

`npm test` checks every entry: valid fields, unique IDs, clues that don't give the answer away (no answer word of 4+ letters in the clue, extra clue or chips), answers that fit on screen, and pools big enough for every theme and difficulty. Run it after editing.

**Researching facts:** to gather sources for new words (dates, spellings, aliases), use `npm run words:sources -- Diwali 'Holi' Q10434` (or `--file titles.txt` with one title or Wikidata Q-id per line; single-quote titles so the shell leaves `$` alone). It fetches English Wikipedia intros and Wikidata labels, Hindi aliases and sitelinks in batches, waits between requests and backs off when rate-limited, and saves each source with its URL, revision ID and fetch time in `.cache/word-sources/` (git-ignored). Later runs reuse the cache; add `--refresh` to fetch again and `--show` to print the text. Titles it couldn't fetch are listed with the reason, and nothing is invented. Use it instead of many one-by-one page calls; see [`expo-tooling.md`](.claude/reference/expo-tooling.md#helper-commands).

**Drafts:** all ~150 words are `draft`. Until they are reviewed, `INCLUDE_DRAFT_WORDS` in `src/game/config.ts` is `true`, so drafts are played. Once the bank is approved, set it to `false`, and only `approved` words are used.

## Adding a category

1. Add the word bank `src/data/words/<id>.json` and register it in `src/data/words/index.ts`.
2. Add the ID to `CategoryId` in `src/game/types.ts`.
3. Add its copy (`themeCopy`) in `src/copy/strings.ts`.
4. Add its theme entry in `src/themes/themes.ts`: colours, lives-sign style, power-up icons and scenes. For scenes, add the three mockup files to `design/source/` and run `npm run port-scenes`.
5. Add a glyph for the home card and the Masala Mix reel in `src/themes/glyphs.tsx`.

No new screens are needed.

## Release pipeline

- **CI** (`.github/workflows/ci.yml`) runs on every pull request and on pushes to main: lint, typecheck, unit tests, then the web export. On a pull request it skips what the changed files can't affect. Docs, design, `.claude/` and most `.github/` changes run nothing. Test, `scripts/` and lint-config changes skip the web export. Any other file runs everything. The exact rules are in [`expo-tooling.md`](.claude/reference/expo-tooling.md#ci-and-pr-rules).
- **Release** (`.github/workflows/release.yml`) is written but switched off. It only runs when started by hand, and only if the repo variable `RELEASES_ENABLED` is `true`. Before it can work, it needs:
  - the `EXPO_TOKEN` secret in GitHub
  - `eas init`, to create the Expo project
  - the Play service-account key and App Store Connect API key stored in EAS
  - real bundle IDs in `src/config/game.json`
  - the App Store Connect app ID in `eas.json`
  - a web host for `dist/`
  - a GitHub `production` environment with reviewers

  Its header comment lists the triggers to switch on: merge to main for web and preview builds, and a release tag for production.
- `eas.json` has a `preview` profile (Play internal testing and TestFlight) and a `production` profile.

## Flagged for design review

These two screens have no mockups. They are built in the same visual language and need a designer's eye. (The difficulty picker is designed: `design/screens/Resume-*.png`, #57.)

- **Home** (category picker): 2×3 grid of themed cards with each category's glyph and your best score.
- **Challenge landing** (`/c/<wordId>?from=<name>`): "<name> ne challenge kiya!", then a one-word game, then a result screen with "Challenge back" and "Play a full run".

## Decisions made while building (please check)

- **Challenge difficulty.** A challenge plays with the rules of the word's own difficulty tier: an easy word gets Easy rules, a hard word gets Hard rules. The link format in the brief carries no difficulty.
- **Challenge back.** Shares a *different* random word from the same category, with your name.
- **Your name for links.** The first share asks for your name (it goes into `?from=`) and remembers it on the device.
- **Hard mode clue box.** Shows the category chip ("category only"). Slot 2 first unlocks the clue line, then the extra clue. On Easy and Medium, slot 2 unlocks the extra clue.
- **Undo (slot 3).** Gives back the life from the most recent wrong guess on the current word. That key stays struck out, since the letter is still known to be wrong.
- **Remove (slot 4).** Removed keys are dimmed without the strike-through, so they look different from your own wrong guesses.
- **Boss words.** Picked at random from the 3 hardest/longest words left in the shuffle bag (harder tier first, then more distinct letters).
- **Ladder after 1000 Cr.** Gaps grow by 5 hits each time: 1500 Cr at 110 hits, 2000 Cr at 145, 3000 Cr at 185, and then +1000 Cr per club.
- **Progress bars.** One segment per hit, as in the mockups. Gaps longer than 20 hits are drawn as 20 proportional segments; the text always gives the exact count.
- **Before the first club,** the header badge reads "No club yet".
- **Pre-locked marks** are drawn very faint on every lives sign (e.g. Filmy uses a dark letter colour), as the brief asks. Only Masala Mix and Safar had locked styles in the mockups; the other themes' locked colours are my choice.
- **Short screens.** Below 780px of usable height, the gaps tighten from 12px to 8px. When the scene ends up under 170px, the lives sign moves above it. Answers needing 3 lines shrink their tiles.
- **Flop screen best score.** "Your best" includes the run just finished; if it beat the old best, the label reads "New best!".
- **Web sharing.** Uses the Web Share API where the browser has it. A cancelled share just stops, and any other failure is logged, with no WhatsApp tab either way. Only a browser without Web Share opens WhatsApp's share link.

## What's left

- Name, store accounts and web domain (see open decisions). The bundle IDs `com.placeholder.hangman` and the domain `example.com` are placeholders.
- Word bank review: every entry is a draft written for this build; facts were checked from memory, so a fan review is still needed, as the brief says. Copy lines are also waiting on that review.
- App icon and splash art: the template's placeholder images are still in `assets/images/`.
- Universal and app links for `/c/...` (later, per the brief).
- Sound effects (nice-to-have).
- Animation is light: tile pop on reveal, stamp drop-in, the Masala Mix reel. Scenes are static apart from the Tyohar diyas.
- Not tested on a physical device or in Expo Go yet; only the web build was exercised (see below).
- Accessibility pass: screen-reader labels exist on keys, power-ups, scenes and lives, but haven't been tried with VoiceOver or TalkBack.

## Open decisions

- **Name:** Tukka, Bachao!, Akkad Bakkad or Guess Karo. Set it in `src/config/game.json`.
- **Account owner:** whose name the store accounts go under.
- **Web domain:** goes in `src/config/game.json` (`webOrigin`) and is used for challenge links from the native apps.
