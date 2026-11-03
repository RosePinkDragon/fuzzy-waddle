/**
 * Glue between the pure run logic (src/game) and the screens: draws words
 * from the saved shuffle bag, saves best scores, paces the solved pause and
 * fires the wrong-guess haptic.
 */
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { poolFor, wordById } from '@/data/words';
import { SOLVED_PAUSE_MS } from '@/game/config';
import { ladder } from '@/game/milestones';
import { applyPowerUp, canUse, type PowerUpSlot } from '@/game/powerUps';
import { defaultRng } from '@/game/rng';
import { beginWord, continueRun, guess, nextIsBoss, startRun, type RunState } from '@/game/run';
import { drawBoss, drawNext, emptyBag, type BagState } from '@/game/shuffleBag';
import type { Difficulty, ThemeId, Word } from '@/game/types';
import { keys, load, save, type Best } from '@/lib/storage';

function wrongHaptic() {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
}

interface Options {
  /** Challenge links play exactly this one word, with no bag and no best score. */
  challengeWord?: Word;
}

export function useRun(theme: ThemeId, difficulty: Difficulty, { challengeWord }: Options = {}) {
  const [run, setRun] = useState<RunState>(() =>
    challengeWord ? beginWord(startRun(theme, difficulty), challengeWord, false) : startRun(theme, difficulty),
  );
  const [best, setBest] = useState<Best | null>(null);
  const [bestAtStart, setBestAtStart] = useState<Best | null>(null);
  const [reelLanded, setReelLanded] = useState(theme !== 'masala' || !!challengeWord);
  const bag = useRef<BagState>(emptyBag());
  const latest = useRef(run);
  useEffect(() => {
    latest.current = run;
  }, [run]);

  /** Draws the next word (a boss word when the next hit reaches a club) and starts it. */
  const drawInto = useCallback(
    (r: RunState): RunState => {
      const pool = poolFor(theme, difficulty);
      const boss = nextIsBoss(r, ladder);
      const drawn = boss ? drawBoss(bag.current, pool, defaultRng) : drawNext(bag.current, pool.map((w) => w.id), defaultRng);
      bag.current = drawn.bag;
      void save(keys.bag(theme, difficulty), drawn.bag);
      const word = wordById(drawn.id);
      if (!word) return r;
      if (theme === 'masala') setReelLanded(false);
      return beginWord(r, word, boss);
    },
    [theme, difficulty],
  );

  // Load the saved bag and best score, then start the first word.
  useEffect(() => {
    if (challengeWord) return;
    let alive = true;
    Promise.all([load(keys.bag(theme, difficulty), emptyBag()), load<Best | null>(keys.best(theme, difficulty), null)]).then(
      ([savedBag, savedBest]) => {
        if (!alive) return;
        bag.current = savedBag;
        setBest(savedBest);
        setBestAtStart(savedBest);
        setRun(drawInto(startRun(theme, difficulty)));
      },
    );
    return () => {
      alive = false;
    };
  }, [theme, difficulty, challengeWord, drawInto]);

  // Short pause on a solved word, then the next one.
  useEffect(() => {
    if (run.status !== 'solved' || challengeWord) return;
    const t = setTimeout(() => setRun(drawInto(continueRun(latest.current))), SOLVED_PAUSE_MS);
    return () => clearTimeout(t);
  }, [run.status, challengeWord, drawInto]);

  // Test builds expose the current answer so browser tests can play a run.
  useEffect(() => {
    if (process.env.EXPO_PUBLIC_TEST_HOOKS !== '1') return;
    (globalThis as Record<string, unknown>).__HANGMAN__ = {
      answer: run.current?.word.answer,
      status: run.status,
      hits: run.hits,
      livesLost: run.livesLost,
      isBoss: run.current?.isBoss,
    };
  }, [run]);

  /** Saves the best score when a run ends or reaches a club. */
  const recordBest = useCallback(
    (r: RunState) => {
      if (challengeWord || (r.status !== 'over' && r.status !== 'milestone')) return;
      if (best && best.hits >= r.hits) return;
      const next = { hits: r.hits, club: ladder.reached(r.hits)?.crore ?? null };
      setBest(next);
      void save(keys.best(theme, difficulty), next);
    },
    [best, challengeWord, theme, difficulty],
  );

  const press = useCallback(
    (letter: string) => {
      if (!reelLanded) return;
      const r = guess(run, letter, ladder);
      if (r.result === 'ignored') return;
      if (r.result === 'wrong') wrongHaptic();
      setRun(r.run);
      recordBest(r.run);
    },
    [run, reelLanded, recordBest],
  );

  const usePower = useCallback(
    (slot: PowerUpSlot) => {
      if (!reelLanded) return;
      const r = applyPowerUp(run, slot, defaultRng, ladder);
      if (!r.effect) return;
      setRun(r.run);
      recordBest(r.run);
    },
    [run, reelLanded, recordBest],
  );

  const keepPlaying = useCallback(() => setRun(drawInto(continueRun(run))), [run, drawInto]);

  const restart = useCallback(() => {
    setBestAtStart(best);
    setRun(drawInto(startRun(theme, difficulty)));
  }, [best, theme, difficulty, drawInto]);

  const onReelLanded = useCallback(() => setReelLanded(true), []);

  const powerEnabled = ([0, 1, 2, 3] as PowerUpSlot[]).map((s) => reelLanded && canUse(run, s));

  return {
    run,
    best,
    /** True when this run beat the best score saved before it started. */
    isNewBest: run.hits > 0 && run.hits > (bestAtStart?.hits ?? 0),
    reelLanded,
    onReelLanded,
    press,
    usePower,
    powerEnabled,
    keepPlaying,
    restart,
  };
}
