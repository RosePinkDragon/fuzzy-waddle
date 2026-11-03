# Design system

How screens look and fit, and how mockups are made and checked. Read this before designing, reviewing or building a screen. For the code layout, see [codebase-map.md](codebase-map.md).

**Source of truth:**
- UI rules and copy tone: [BRIEF.md section 4](../../BRIEF.md#4-ui-rules-from-design-reviews) and [section 5](../../BRIEF.md#5-copy).
- Built colour values per theme: [`src/themes/themes.ts`](../../src/themes/themes.ts), which copies them exactly from the mockups.
- Mockups and scene art: [`design/source/*.dc.html`](../../design/source/), rendered to [`design/screens/`](../../design/screens/).
- Copy: [`src/copy/strings.ts`](../../src/copy/strings.ts).

This sheet points at values rather than copying them. List conflicts under Disagreements below.

*Last checked against `c636a30` (main, 2026-11-04).*

## Themes are config

- **Six themes:** `filmy`, `khana`, `safar`, `cricket`, `tyohar` and `masala` (`THEME_ORDER` in `themes.ts`).
- **Same layout everywhere:** every screen has one layout for all six. Themes differ only in colours, scene art, the lives-sign style, icons and copy. A theme never gets its own screen.
- **Tokens:** each theme's `colors` block names the tokens screens use: `bg`, `panel`, `border`, `accent`, `text`, `muted`, `onAccent`, `chip`, `badge`, `primary`, `keyRight`, `keyWrong`, `winStamp` and `card`. Use a token. Never write a hex value in a component.
- **Flop stamp:** it's the same colour in every theme (BRIEF section 4), so it's one constant, `FLOP_STAMP` in `src/screens/FlopView.tsx`.
- **Fonts:** **Mukta** (400, 600, 700, 800) for text, and **Yatra One** for display titles and stamps (`Txt display`). Both come from `@expo-google-fonts`.

## Screens

| Screen | Mockup | Built in |
|---|---|---|
| Game (×6) | `Main`, `Khana`, `Safar`, `Cricket`, `Tyohar`, `MasalaMix` | `src/screens/GameView.tsx` |
| Win, the milestone screen (×6) | `Win`, `KhanaWin`, … | `src/screens/MilestoneView.tsx` |
| Flop (×6) | `Lose`, `KhanaLose`, … | `src/screens/FlopView.tsx` |
| Home, difficulty picker, challenge | **None.** Built in the same style and flagged for review ([README](../../README.md#flagged-for-design-review)). | `src/app/` |

## Layout and fit

- **Fit:** everything fits from 390×700 to 390×844 with no scrolling. Content width is capped by `MAX_WIDTH` in `src/components/Screen.tsx`.
- **Short screens:** below `COMPACT_HEIGHT` (`Screen.tsx`), each screen tightens its gaps. See the `compact` gap in `GameView`, `MilestoneView` and `FlopView`.
- **Scenes:** art is drawn at the sizes in BRIEF section 4 (`artHeight` in `SceneBox`). It's capped at that height and crops from the top on short phones. There's no writing inside scenes except the lives sign.
- **Lives sign:** top-centre in the scene, always worded "X LEFT". It moves above the scene when the scene is shorter than `SIGN_INSIDE_MIN` in `GameView.tsx`.
- **Tiles:** sized between the `maxSize` and `minSize` defaults in `tileLayout.ts`. They wrap only at word breaks. `MilestoneView` passes its own `maxSize`.
- **Keyboard:** QWERTY, with `KEY_HEIGHT` in `Keyboard.tsx`.
  - Correct keys take the accent and lock.
  - Wrong keys dim, strike through and lock.
  - Removed keys dim with no strike.
- **Order on screen:** power-ups sit right above the keyboard. On win and flop, the buttons sit at the bottom, and there's one clear main action within thumb reach.
- **Progress:** shown plainly, so players never do maths ("2 hits to go", not "8/10").

## Accessibility

- **Touch targets:** at least 44px. See the button and header styles in `Buttons.tsx` and `Header.tsx`.
- **Contrast:** at least 4.5:1 for text, and 3:1 for large text and icons. Work it out from the hex values with a quick `node -e` script; don't guess.
- **Colour:** never the only signal. Wrong keys are struck through as well as dimmed.
- **Labels:** icon-only buttons, keys, power-ups, scenes and the lives sign all have accessibility labels.

## Copy

- **Tone:** Hinglish in Roman script, WhatsApp tone, like a real fan rather than a translation. Functional UI (buttons, labels) stays in plain English.
- **Location:** all copy lives in `src/copy/strings.ts`. Themed lines live in `themeCopy`.
- **Review:** the lines are waiting on a review by real fans. Mark new lines for that review rather than treating them as final.

## Making and checking mockups

1. Write each screen as `design/source/<Name>.dc.html`, starting from the closest existing file and keeping its structure.
2. `node scripts/render-mockups.js design/source/<Name>.dc.html` saves `design/screens/<Name>.png` at 390×844 and lists layout problems.
3. `node scripts/render-mockups.js --height 700 --out /tmp/mockups-700 design/source/<Name>.dc.html` checks the short phone. Don't commit those renders.
4. Changed scene art goes into the app with `npm run port-scenes`. Never edit `src/themes/scenes/ported/` by hand.

## Checking built screens

`npm run screenshots` captures the web build at both sizes into `design/build-screenshots/` and lists problems. Use `--screens` and `--themes` for an everyday UI change, and the full sweep for big UI changes and releases. Compare the results with `design/screens/`. See [expo-tooling.md](expo-tooling.md#helper-commands).

## Lessons from past reviews

- Captions under scenes confuse players, because they look like clues.
- Stamps must not cover the art.
- Avoid big empty gaps.
- Keep headers compact.

## Disagreements

- **Keyboard key width vs the 44px touch-target rule.** At 390px wide, a 10-key QWERTY row makes keys about 33px wide (`keyWidth` in `Keyboard.tsx`). Since #44, each key's touch area is its full cell (key plus half of each gap, about 37px), so there are no dead gaps, but it's still under 44px wide. Height meets 44px. The brief sets only the 46px height; the 44px rule comes from the review agents. **Owner decision needed:** are keyboard keys exempt from the 44px width?
- **Mockups for home, difficulty and challenge.** BRIEF section 2 lists them as not designed, and #40 is reconciling mockups with the built screens. Until then, the built screens are the reference for these three.
