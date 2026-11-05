/**
 * Plays one challenge word: local state only. It writes nothing, keeps no bag or
 * best and never imports the saved-run store or storage, so a challenge can't
 * touch a real run (`challengeRunStoreGuard.test.ts` checks both).
 *
 * The word is played with the rules of its own difficulty tier.
 */
import { useCallback, useEffect, useState } from 'react';

import { ladder } from '@/game/milestones';
import { applyPowerUp, canUse, type PowerUpSlot } from '@/game/powerUps';
import { defaultRng } from '@/game/rng';
import { beginWord, guess, startRun, type RunState } from '@/game/run';
import type { Word } from '@/game/types';
import { exposeRunForTests, wrongHaptic } from '@/lib/device';

const noop = () => undefined;

export function useChallenge(word: Word) {
  const [run, setRun] = useState<RunState>(() => beginWord(startRun(word.category, word.difficulty), word, false));

  useEffect(() => exposeRunForTests(run), [run]);

  const press = useCallback(
    (letter: string) => {
      const r = guess(run, letter, ladder);
      if (r.result === 'ignored') return;
      if (r.result === 'wrong') wrongHaptic();
      setRun(r.run);
    },
    [run],
  );

  const usePower = useCallback(
    (slot: PowerUpSlot) => {
      const r = applyPowerUp(run, slot, defaultRng, ladder);
      if (!r.effect) return;
      setRun(r.run);
    },
    [run],
  );

  const powerEnabled = ([0, 1, 2, 3] as PowerUpSlot[]).map((s) => canUse(run, s));

  // A challenge word has no reel to wait for, so there is nothing to do when it lands.
  return { run, press, usePower, powerEnabled, onReelLanded: noop };
}
