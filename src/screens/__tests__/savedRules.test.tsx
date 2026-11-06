/**
 * A saved run is shown under the rules it started with (#95): lives, marks, ladder, clues and the reward chip
 * come from `doc.rules`, not from the live `config.ts`. These tests give a saved run rules that differ from
 * the live ones, so a screen that still read the live config would show the wrong numbers.
 */
import { render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { ThemeProvider } from '@/components/ThemeContext';
import { ui } from '@/copy/strings';
import { defaultGameConfig, mergeGameConfig } from '@/game/gameConfig';
import { clubLong, clubShort } from '@/game/milestones';
import { testEnv } from '@/game/__tests__/helpers';
import { startDoc, type SessionEnv } from '@/game/runSession';
import { currentRules, ladderOf, type SavedRules, type SlotDoc } from '@/game/runSnapshot';
import { emptyBag } from '@/game/shuffleBag';
import { THEMES } from '@/themes/themes';

import { FlopView } from '../FlopView';
import { GameView } from '../GameView';
import { MilestoneView } from '../MilestoneView';

jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
// Stamp and Tiles animate with Reanimated, which needs native worklets that Jest doesn't have.
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: { View }, ZoomIn: { duration: () => undefined } };
});
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }), Redirect: () => null }));
jest.setTimeout(30000);

const theme = THEMES.filmy;
const noop = () => undefined;

/** Rules unlike the live Easy ones in every way a screen shows: 6 lives, a short ladder, no chips, locked clues, a bigger reward. */
const SAVED: SavedRules = {
  config: mergeGameConfig(defaultGameConfig, {
    lives: { easy: 6 },
    ladder: [
      { crore: 25, hits: 3 },
      { crore: 75, hits: 6 },
    ],
    milestoneReward: { slot: 2, amount: 2 },
  }),
  clues: { showChips: false, shownClues: [], hiddenClues: ['clue', 'extraClue'] },
  pool: ['easy'],
};

/** The clubs of the saved ladder (25 Cr at 3 hits, 75 Cr at 6) and of the live one. */
const savedClub = (hits: number) => ladderOf(SAVED).reached(hits)!;
const liveClub = (hits: number) => ladderOf(currentRules('easy')).reached(hits)!;

function fresh(env: SessionEnv = testEnv(1)): SlotDoc {
  const doc = startDoc('filmy', 'easy', { bag: emptyBag(), best: null }, env);
  if (!doc) throw new Error('empty pool');
  return doc;
}

/** A run that was started under SAVED, 2 lives down. */
function savedDoc(patch: Partial<SlotDoc['run']> = {}): SlotDoc {
  const doc = fresh();
  return { ...doc, rules: SAVED, run: { ...doc.run, livesLost: 2, ...patch } };
}

function ui2(el: ReactElement) {
  return render(<ThemeProvider value={theme}>{el}</ThemeProvider>);
}

const game = (doc: SlotDoc, rules?: SavedRules) => (
  <GameView theme={theme} run={doc.run} rules={rules} mode="run" reelLanded onReelLanded={noop} onPress={noop} onPower={noop} powerEnabled={[true, true, true, true]} onBack={noop} />
);
const milestone = (doc: SlotDoc, rules?: SavedRules) => (
  <MilestoneView theme={theme} run={doc.run} rules={rules} onKeepPlaying={noop} onBack={noop} share={noop} />
);
const flop = (doc: SlotDoc, rules?: SavedRules) => (
  <FlopView theme={theme} run={doc.run} rules={rules} best={null} isNewBest={false} onRestart={noop} onChangeDifficulty={noop} onBack={noop} share={noop} />
);

describe('the game screen under saved rules', () => {
  it('shows lives, the ladder, chips and clues from the saved rules, not the live ones', async () => {
    const doc = savedDoc();
    await ui2(game(doc, doc.rules));
    // 6 lives, 2 lost: 4 left and 3 locked (live Easy would say 7 LEFT with nothing locked).
    expect(screen.getByLabelText(`${ui.livesLeft(4)}, 3 locked`)).toBeTruthy();
    // The saved ladder's first club is 25 Cr at 3 hits; the live one starts at 50 Cr.
    expect(screen.getByText(clubShort(savedClub(3)))).toBeTruthy();
    // No chips and the clue is locked, though the live Easy rules show both.
    const word = doc.run.current!.word;
    expect(screen.queryByText(word.chips[0])).toBeNull();
    expect(screen.queryByText(word.clue)).toBeNull();
    expect(screen.getByLabelText(ui.clueLocked(theme.copy.powerUps[1]))).toBeTruthy();
  });

  it('shows the live rules when no saved rules are passed (a challenge)', async () => {
    const doc = savedDoc();
    await ui2(game(doc));
    expect(screen.getByLabelText(ui.livesLeft(7))).toBeTruthy();
    expect(screen.getByText(doc.run.current!.word.clue)).toBeTruthy();
    expect(screen.getByText(doc.run.current!.word.chips[0])).toBeTruthy();
  });

  it('renders the same as the live screen when the saved rules match the live ones', async () => {
    const doc = fresh();
    const withRules = await ui2(game(doc, currentRules('easy')));
    const a = JSON.stringify(withRules.toJSON());
    await withRules.unmount();
    const without = await ui2(game(doc));
    expect(JSON.stringify(without.toJSON())).toBe(a);
  });
});

describe('the milestone screen under saved rules', () => {
  const at = { hits: 3, status: 'milestone' as const, lastClub: savedClub(3) };

  it('shows the refill, the reward and the next club from the saved rules', async () => {
    const doc = savedDoc(at);
    await ui2(milestone(doc, doc.rules));
    expect(screen.getByText(ui.livesRefilled(6))).toBeTruthy();
    expect(screen.getByText(ui.plusOne(theme.copy.powerUps[2], 2))).toBeTruthy();
    expect(screen.getByText(clubLong(savedClub(6)))).toBeTruthy();
  });

  it('renders the same as the live screen when the saved rules match the live ones', async () => {
    const live = currentRules('easy');
    const doc = { ...fresh(), run: { ...fresh().run, hits: 10, status: 'milestone' as const, lastClub: liveClub(10) } };
    const withRules = await ui2(milestone(doc, live));
    const a = JSON.stringify(withRules.toJSON());
    await withRules.unmount();
    expect(JSON.stringify((await ui2(milestone(doc))).toJSON())).toBe(a);
  });
});

describe('the flop screen under saved rules', () => {
  it('shows an empty sign with the saved locked marks and the club from the saved ladder', async () => {
    const doc = savedDoc({ hits: 4, livesLost: 6, status: 'over' });
    await ui2(flop(doc, doc.rules));
    expect(screen.getByLabelText(`${ui.livesLeft(0)}, 3 locked`)).toBeTruthy();
    expect(screen.getAllByText(clubLong(savedClub(3))).length).toBeGreaterThan(0);
  });

  it('renders the same as the live screen when the saved rules match the live ones', async () => {
    const doc = { ...fresh(), run: { ...fresh().run, hits: 12, livesLost: 9, status: 'over' as const } };
    const withRules = await ui2(flop(doc, currentRules('easy')));
    const a = JSON.stringify(withRules.toJSON());
    await withRules.unmount();
    expect(JSON.stringify((await ui2(flop(doc))).toJSON())).toBe(a);
  });
});
