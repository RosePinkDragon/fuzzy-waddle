/**
 * A stored best keeps the club it was settled with (#104). The home and game-over screens both read it from
 * `Best.club`, so a ladder that differs from the one the best was set under, whether the live one or the
 * current run's saved one, never renames it.
 */
import { render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import Home from '@/app/index';
import { ThemeProvider } from '@/components/ThemeContext';
import { home, ui } from '@/copy/strings';
import { defaultGameConfig, mergeGameConfig } from '@/game/gameConfig';
import { clubLong, clubShort, ladder } from '@/game/milestones';
import { testEnv } from '@/game/__tests__/helpers';
import { startDoc } from '@/game/runSession';
import { bestToShow, ladderOf, type BestScore, type SavedRules, type SlotDoc } from '@/game/runSnapshot';
import { bestForTheme } from '@/lib/runController';
import { emptyBag } from '@/game/shuffleBag';
import { THEMES } from '@/themes/themes';

import { FlopView } from '../FlopView';

jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: { View }, ZoomIn: { duration: () => undefined } };
});
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
    useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
    Redirect: () => null,
  };
});
jest.mock('@/lib/runController', () => ({ bestForTheme: jest.fn() }));
jest.setTimeout(30000);

const theme = THEMES.filmy;
const noop = () => undefined;

/** The run's own saved rules: 25 Cr at 3 hits, 75 Cr at 6. */
const RUN_RULES: SavedRules = {
  config: mergeGameConfig(defaultGameConfig, {
    ladder: [
      { crore: 25, hits: 3 },
      { crore: 75, hits: 6 },
    ],
  }),
  clues: { showChips: true, shownClues: [], hiddenClues: [] },
  pool: ['easy'],
};

/** A best set under a third ladder, 40 Cr at 12 hits: neither the live ladder (50 Cr there) nor RUN_RULES names it that. */
const STORED: BestScore = { hits: 12, club: 40 };

function lostRun(hits: number): SlotDoc['run'] {
  const doc = startDoc('filmy', 'easy', { bag: emptyBag(), best: null }, testEnv(1));
  if (!doc) throw new Error('empty pool');
  return { ...doc.run, hits, livesLost: 7, status: 'over' };
}

const flop = (run: SlotDoc['run'], best: BestScore | null, isNewBest = false): ReactElement => (
  <ThemeProvider value={theme}>
    <FlopView theme={theme} run={run} rules={RUN_RULES} best={best} isNewBest={isNewBest} onRestart={noop} onChangeDifficulty={noop} onBack={noop} share={noop} />
  </ThemeProvider>
);

describe('the ladders really differ', () => {
  it('names a different club for the stored best than the live and the run ladders do', () => {
    expect(ladder.reached(STORED.hits)!.crore).not.toBe(40);
    expect(ladderOf(RUN_RULES).reached(STORED.hits)!.crore).not.toBe(40);
  });
});

describe('a stored best on the game-over and home screens', () => {
  it('names the same club on both, the one stored with it', async () => {
    // The run lost at 4 hits, below the stored 12, under a ladder that would call 12 hits something else.
    await render(flop(lostRun(4), STORED));
    expect(screen.getByText(ui.hits(12))).toBeTruthy();
    expect(screen.getByText(clubLong({ crore: 40 }))).toBeTruthy();
    expect(screen.queryByText(clubLong(ladderOf(RUN_RULES).reached(12)!))).toBeNull();
    await screen.unmount();

    jest.mocked(bestForTheme).mockResolvedValue(STORED);
    await render(<Home />);
    expect((await screen.findAllByText(home.best(12, clubShort({ crore: 40 })))).length).toBeGreaterThan(0);
    expect(screen.queryByText(home.best(12, clubShort(ladder.reached(12)!)))).toBeNull();
  });

  it('shows no club for a best stored without one, on both screens', async () => {
    const none: BestScore = { hits: 12, club: null };
    await render(flop(lostRun(4), none));
    expect(screen.getAllByText(ui.noClub).length).toBe(1); // this run (4 hits) is in the 25 Cr club
    await screen.unmount();

    jest.mocked(bestForTheme).mockResolvedValue(none);
    await render(<Home />);
    expect((await screen.findAllByText(home.best(12, null))).length).toBeGreaterThan(0);
  });

  it('uses the run own club when this run is the new best', async () => {
    const run = lostRun(7); // 75 Cr is at 6 hits under the run's rules
    await render(flop(run, { hits: 7, club: 75 }, true));
    expect(screen.getAllByText(clubLong({ crore: 75 })).length).toBe(2);
    await screen.unmount();
    // Nothing stored yet (or fewer hits stored): the run's club, which is what settlement stores.
    await render(flop(run, { hits: 5, club: 25 }, true));
    expect(screen.getAllByText(clubLong({ crore: 75 })).length).toBe(2);
  });
});

describe('bestToShow', () => {
  it('keeps a stored best with more hits, club included', () => {
    expect(bestToShow({ hits: 12, club: 40 }, 4, 25)).toEqual({ hits: 12, club: 40 });
  });
  it('keeps the earlier best on a tie, as settlement does', () => {
    expect(bestToShow({ hits: 4, club: null }, 4, 25)).toEqual({ hits: 4, club: null });
  });
  it('uses the run when it beats the stored best or none is stored', () => {
    expect(bestToShow({ hits: 3, club: 25 }, 7, 75)).toEqual({ hits: 7, club: 75 });
    expect(bestToShow(null, 7, 75)).toEqual({ hits: 7, club: 75 });
    expect(bestToShow(null, 2, null)).toEqual({ hits: 2, club: null });
  });
});
