# [Game name] — v1 build brief

Indian hangman for phones: endless runs across six desi categories, with filmy humour throughout. The name isn't decided yet, so keep it in one config value (placeholder `[Game name]`).

Design reference: the canvas at https://claude.ai/artifact/NetLvgo1qba4de5Cn2A4Eq (private until the owner shares it). Rendered PNGs of every screen are in `design/screens/`, and the mockup source files are in `design/source/`.

## 1. Stack

- **Expo (React Native) + TypeScript, Expo Router.** One codebase for iOS, Android and web. The web export is what WhatsApp challenge links open, so nobody has to install the app to accept a challenge.
- **Libraries:** `react-native-svg` for scenes, `react-native-reanimated` for animation, `expo-font` with Mukta + Yatra One (`@expo-google-fonts`), `expo-haptics`, AsyncStorage for best scores and shuffle-bag state.
- **Not in v1:** backend, accounts, ads.
- **Releases:** EAS Build + EAS Submit, triggered from GitHub. The free plan covers 15 iOS + 15 Android builds a month, and submissions are included.

## 2. Screens

| Screen | Status |
|---|---|
| Game (×6 themes) | Designed — `Main`, `Khana`, `Safar`, `Cricket`, `Tyohar`, `MasalaMix` |
| Milestone win (×6) | Designed — `Win`, `KhanaWin`, … |
| Run over / flop (×6) | Designed — `Lose`, `KhanaLose`, … |
| Home (category picker) | **Not designed** — build in the same style, flag for review |
| Difficulty picker | **Not designed** — same |
| Challenge landing | **Not designed** — "<name> ne challenge kiya!" then a one-word game, then "Challenge back" |

## 3. Game rules

**Runs**
- Pick a category and a difficulty, then play endless random words. Lives carry over from word to word, and each solved word is 1 hit.
- When lives hit 0 the run ends and the flop screen shows. "New random run" starts again.

**Difficulty**

| | Lives | Clues shown | Word pool |
|---|---|---|---|
| Easy | 9 | chips + clue line | `easy` |
| Medium | 7 (2 pre-locked) | clue line only | `easy` + `medium` |
| Hard | 5 (4 pre-locked) | category only, clue locked | `medium` + `hard` |

The lives sign always shows 9 marks, with pre-locked ones drawn much fainter than lost ones.

**Lives by theme**

| Theme | Lives |
|---|---|
| Filmy | letters of BOLLYWOOD |
| Khana | 9 cooker whistles |
| Safar | 9 coaches |
| Cricket | 9 wickets |
| Tyohar | 9 diyas |
| Masala Mix | letters of DESI MASTI |

**Milestones**
- Clubs come at a set number of hits: 50 Cr Club (10), 100 Cr (20), 200 Cr (35), 500 Cr (55), 1000 Cr (80). Keep the ladder in config and continue it sensibly after 1000.
- The word that reaches a club is a **boss round**: a longer or harder word. Winning it shows the milestone screen, refills lives to the difficulty's maximum and gives +1 of the slot-1 power-up. Losing it ends the run.

**Power-ups**
- Four slots, and each slot does the same thing in every theme. Only the name and icon change.
- Each run starts with 2 of slot 1 and 1 of each of the others. These numbers live in config.

| Slot | Does | Filmy | Khana | Safar | Cricket | Tyohar | Masala Mix |
|---|---|---|---|---|---|---|---|
| 1 | Reveal a letter | Director's Cut | Chakh Lo | Window Seat | Free Hit | Phuljhadi | Jugaad |
| 2 | Extra clue | Trailer | Maa se Pucho | Rasta Pucho | Commentary | Dadi se Pucho | Gyaan |
| 3 | Undo a wrong guess | Flashback | Aloo Daalo | Chain Kheecho | DRS | Diya Jalao | U-Turn |
| 4 | Remove 3 wrong letters | Censor Board | Chhaan Lo | TC Check | Run Out | Safai | Bhagao |

**Masala Mix:** each word comes from a random category. A slot-reel animation reveals the category before the word, and the category chip shows in the clue box as the first clue.

**Randomness:** keep one shuffle bag per category + difficulty, so no word repeats until the pool is used up. Save it between runs.

**Best scores:** save one per category + difficulty: hits and club.

**Flop screen:** shows the answer, this run vs your best, and a near-miss bar ("100 Crore Club bas 2 hits door tha").

## 4. UI rules (from design reviews)

- **No writing inside scene animations**, except the lives sign. The first reviewer found captions confusing because they looked like clues.
- **Lives sign:** top-centre inside the scene, always worded "X LEFT". If the scene is shorter than about 170px, move the sign above the scene so it doesn't cover the hero.
- **Scene size:** the art is drawn at 366×200 (game, win) and 366×220 (flop). Cap the scene at that height and let it shrink on short phones, cropping from the top.
- **Tiles:** 38px max. Wrap at word breaks, and shrink tiles (min ~26px) when a single word won't fit on one line.
- **Answers:** stored in uppercase with one canonical spelling. Spaces, numbers and punctuation are revealed automatically.
- **Keyboard:** QWERTY with 46px keys. Correct keys turn the accent colour and lock; wrong keys go dim, struck through, and lock. Wrong guesses give a short haptic.
- **Layout:** power-ups sit right above the keyboard. On win and flop screens, the buttons sit at the bottom.
- **Screen fit:** everything must fit from 700px to 844px tall without scrolling.

**Theme colours** (exact values are in `design/source/`)

| Theme | Background | Panel | Border | Accent | Text |
|---|---|---|---|---|---|
| Filmy | #2A0710 | #3A0B15 | #7A2633 | #F2B33D / #F28C28 | #FFF4DC |
| Khana | #2B1606 | #3D200B | #6B3A16 | #F2B705 | #FFF4DC |
| Safar | #0F1E3D | #1A2C55 | #2F4A80 | #F5A524 | #F4F1E8 |
| Cricket | #0B2A1A | #12402A | #1F6B45 | #E9F07A (correct keys #1F7A45) | #F4F1E8 |
| Tyohar | #2A0E3A | #3B1652 | #6A2C8C | #FF9F1C | #FFF4E6 |
| Masala Mix | #1E1A17 | #2C2621 | #4A3F35 | #F2B705 | #FFF4DC |

Flop stamps use #FF5A64.

## 5. Copy

Write in Hinglish, WhatsApp tone, in Roman script. Keep functional UI (buttons, labels) in plain English.

| Theme | Win stamp | Flop stamp | Flop line | Restart button | Share line |
|---|---|---|---|---|---|
| Filmy | Blockbuster! | Box Office Flop | Interval se pehle hi The End. | Sequel banao | 100 Crore Club pahunch gaya. Tu kitne pe atka? |
| Khana | Swaad Aa Gaya! | Dal Jal Gayi! | Mummy ko mat batana. | Phir se banao | Ek bhi dish nahi jali. Tera kya scene? |
| Safar | Pahunch Gaye! | Train Chhoot Gayi! | Agli wali pakad lena. | Agli train pakdo | Ek bhi train miss nahi hui. Tu bata? |
| Cricket | Chhakka! | All Out! | Pitch hi kharab thi. | Phir se batting | Match jeeta, wo bhi last ball pe. Tu? |
| Tyohar | Badhai Ho! | Light Chali Gayi! | Mehmaan aa gaye, ghar mein andhera. | Diye phir jalao | Saare diye jalte rahe. Tu bata? |
| Masala Mix | Paisa Vasool! | Mirchi Lag Gayi! | Thanda paani piyo, phir aao. | Ek aur plate | Sab mix tha, phir bhi jeet gaya. Tu? |

The milestone heading is "{Club} mein entry!". Keep all copy in one strings file so it's easy to swap. The lines are waiting on a review by real fans.

## 6. Word bank

- **Format:** JSON per category. Each entry has `id`, `answer`, `difficulty` (easy/medium/hard), `chips` (0–2 short facts), `clue` (one friendly Hinglish line), `extraClue` (shown by the slot-2 power-up), and `status` (`draft` | `approved`).
- **First pass:** draft about 30 entries per category, all marked `draft`. She will edit and approve them.
- **Categories:**
  - Filmy: Hindi film titles
  - Khana: dishes, street food, sweets
  - Safar: cities, monuments, hill stations
  - Cricket: terms, grounds, tournaments; no player names for now
  - Tyohar: festivals
- **Content limits:** facts and titles only. No posters, stills or actor photos, at most a few words of real dialogue, and no brand names in jokes.

## 7. Challenge links

- The link is `https://<domain>/c/<wordId>?from=<name>`. It carries the word ID, never the answer.
- Share through the native share sheet, using the share line plus the link.
- The link opens the web build (universal and app links come later).

## 8. Release pipeline (needs accounts first)

- **Every PR:** lint, typecheck, unit tests, web export.
- **Merge to main:** deploy web; EAS build to Play internal testing and TestFlight.
- **Release tag + manual approval:** EAS Submit to production.
- **Secrets:** `EXPO_TOKEN` in GitHub. The Play service-account key and App Store Connect API key are stored in EAS.
- **Store rules:** Android must target API 36; iOS must be built with Xcode 26. Current Expo SDK and EAS build images handle both.
- **Owner setup:**
  - A Google Play account ($25 once). New personal accounts need a closed test with at least 12 testers for 14 days in a row before going live.
  - An Apple Developer account (₹8,700/yr).
  - An Expo account (free).
  - Bundle IDs, once the name is chosen.

## 9. Not in v1

Online multiplayer, party games (Dumb Charades, Who Am I, etc.), daily puzzle, ads, accounts, Devanagari mode, regional cinema packs, leaderboards. Sound effects are a nice-to-have.

## 10. Open decisions

- **Name:** Tukka, Bachao!, Akkad Bakkad or Guess Karo.
- **Account owner:** whose name the store accounts go under.
- **Web domain.**

## 11. Done for the first build

1. The app runs on web and in Expo Go. All six themes work end to end: home → difficulty → endless run → milestone → flop → restart, plus the challenge-link flow.
2. Screens closely match `design/screens/`. Home, difficulty picker and challenge landing follow the same style and are flagged for review.
3. Unit tests cover lives, difficulty, the milestone ladder, shuffle bag, auto-reveal and power-ups.
4. Draft word bank, about 30 words per category.
5. `eas.json` and app config with placeholder IDs. A CI workflow runs lint, test and web export; the release workflow is written but switched off until the accounts exist.
6. A README covering how to run it, how to add words, and what's left.
