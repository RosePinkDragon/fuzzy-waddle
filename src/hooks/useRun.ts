/**
 * Glue between a saved run (`lib/runController`) and the run route. Everything about the run
 * (words, bags, bests, the solved pause, saving, recovery) lives in the controller; this hook
 * wraps it with `useSyncExternalStore`, wires the app lifecycle, plays the wrong-guess haptic
 * and decides when the Masala Mix reel has landed.
 *
 * The controller lives for the route's lifetime, so a StrictMode remount can't open (draw or
 * migrate) twice. A new one is made once a recovery notice has been shown, because a controller
 * that found bad data stays in `recoveryPending` for good.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import type { PowerUpSlot } from '@/game/powerUps';
import { canUse } from '@/game/powerUps';
import type { Difficulty, ThemeId } from '@/game/types';
import { exposeRunForTests, subscribeLifecycle, wrongHaptic } from '@/lib/device';
import { createRunController, recoveryShown, type RunControllerOptions } from '@/lib/runController';

const SLOTS: PowerUpSlot[] = [0, 1, 2, 3];

export function useRun(theme: ThemeId, difficulty: Difficulty, options: RunControllerOptions = {}) {
  const [controller, setController] = useState(() => createRunController(theme, difficulty, options));
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);

  // A controller that stopped for a recovery notice never leaves that phase. Once the notice has
  // been shown the slot can be opened (and replaced), which only a new controller does.
  if (snapshot.phase === 'recoveryPending' && recoveryShown(theme, difficulty)) {
    setController(createRunController(theme, difficulty, options));
  }

  // One effect for the lifecycle and the first open, so the lifecycle's starting state (an app that
  // is already hidden) is seen before the open arms any timer. Cleanup stops listening, then stops timers.
  useEffect(() => {
    const off = subscribeLifecycle({
      onLeave: () => controller.leave(),
      onReturn: () => void controller.return(),
    });
    void controller.start();
    return () => {
      off();
      controller.dispose();
    };
  }, [controller]);

  const { doc } = snapshot;
  const run = doc?.run ?? null;
  useEffect(() => {
    if (run) exposeRunForTests(run);
  }, [run]);

  // Masala Mix spins a reel for each word and takes no input until it lands. A reel is identified by the
  // key the scene spins on (the word and the hits when it was drawn); a run that is not being played
  // (solved, milestone, over) has nothing to wait for.
  const spinKey = run?.current ? `${run.current.word.id}:${run.hits}` : null;
  const spinKeyRef = useRef(spinKey);
  useEffect(() => {
    spinKeyRef.current = spinKey;
  }, [spinKey]);
  const [landedKey, setLandedKey] = useState<string | null>(null);
  const onReelLanded = useCallback(() => setLandedKey(spinKeyRef.current), []);
  const reelLanded = theme !== 'masala' || !run || run.status !== 'playing' || landedKey === spinKey;

  const press = useCallback(
    async (letter: string) => {
      if (!reelLanded) return;
      const result = await controller.press(letter);
      if (result === 'wrong') wrongHaptic();
    },
    [controller, reelLanded],
  );

  const usePower = useCallback(
    async (slot: PowerUpSlot) => {
      if (!reelLanded) return;
      await controller.usePower(slot);
    },
    [controller, reelLanded],
  );

  const keepPlaying = useCallback(() => controller.keepPlaying(), [controller]);
  const restart = useCallback(() => controller.restart(), [controller]);
  const dismissNotice = useCallback(() => controller.dismissNotice(), [controller]);

  const powerEnabled = SLOTS.map((s) => reelLanded && !!run && canUse(run, s));

  return {
    phase: snapshot.phase,
    doc,
    run,
    /** The best for this slot (already settled when a run ends). */
    best: doc?.best ?? null,
    /** False when the run only exists in memory. */
    saved: snapshot.saved,
    /** Set when opening replaced the saved word; cleared by `dismissNotice`. */
    notice: snapshot.notice,
    /** True when this run beat the best it started with. */
    isNewBest: snapshot.isNewBest,
    reelLanded,
    onReelLanded,
    press,
    usePower,
    powerEnabled,
    keepPlaying,
    restart,
    dismissNotice,
  };
}
