/**
 * Small platform helpers shared by the run hooks: the wrong-guess haptic, the
 * test hook that exposes the current run, and the app lifecycle (leave and
 * return) in one shape for native and web.
 *
 * Never imports the saved-run store: challenges use this file too.
 */
import * as Haptics from 'expo-haptics';
import { AppState, Platform } from 'react-native';

import type { RunState } from '@/game/run';

export function wrongHaptic(): void {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
}

/** Test builds expose the current answer so browser tests can play a run. */
export function exposeRunForTests(run: RunState): void {
  if (process.env.EXPO_PUBLIC_TEST_HOOKS !== '1') return;
  (globalThis as Record<string, unknown>).__HANGMAN__ = {
    answer: run.current?.word.answer,
    status: run.status,
    hits: run.hits,
    livesLost: run.livesLost,
    isBoss: run.current?.isBoss,
  };
}

// ---------- lifecycle ----------

export interface LifecycleHandlers {
  /** The app went to the background, the tab was hidden or the page was put away. */
  onLeave(): void;
  /** The app came back after a leave. Called once per leave however many events arrive. */
  onReturn(): void;
}

interface Listenable {
  addEventListener(type: string, listener: (event: any) => void): void;
  removeEventListener(type: string, listener: (event: any) => void): void;
}

/** The platform pieces `subscribeLifecycle` reads. Injected so tests can pass fakes. */
export type LifecycleEnv =
  | {
      kind: 'native';
      appState: {
        /** What the app is doing right now. Read once when subscribing, so an already-hidden app counts as a leave. */
        currentState?: string | null;
        addEventListener(type: 'change', listener: (state: string) => void): { remove(): void };
      };
    }
  | { kind: 'web'; document: Listenable & { visibilityState: string }; window: Listenable };

function defaultEnv(): LifecycleEnv {
  if (Platform.OS === 'web') {
    return { kind: 'web', document: globalThis.document, window: globalThis.window };
  }
  return { kind: 'native', appState: AppState };
}

/**
 * Reports when the app leaves and returns, and returns the unsubscribe function.
 *
 * - Native: `AppState` `background` is a leave and `active` after a leave is a return.
 *   `inactive` is ignored, so the iOS Control Center doesn't trigger a reopen.
 * - Web: `visibilitychange` (hidden or visible) and `pagehide` / `pageshow` with `persisted`
 *   (a back-forward cache restore). It does not use `AppState`, so no event is counted twice.
 *
 * A return with no earlier leave is ignored, and a second leave while away is too.
 *
 * If the app is already hidden when this starts (`AppState.currentState` is `background`, or
 * `document.visibilityState` is `hidden`), `onLeave()` is called at once, so a hook whose effect
 * re-runs while hidden still has its timers stopped and its next return re-opens exactly once.
 */
export function subscribeLifecycle({ onLeave, onReturn }: LifecycleHandlers, env: LifecycleEnv = defaultEnv()): () => void {
  let away = false;
  const leave = () => {
    if (away) return;
    away = true;
    onLeave();
  };
  const back = () => {
    if (!away) return;
    away = false;
    onReturn();
  };

  if (env.kind === 'native') {
    const sub = env.appState.addEventListener('change', (state) => {
      if (state === 'background') leave();
      else if (state === 'active') back();
    });
    if (env.appState.currentState === 'background') leave();
    return () => sub.remove();
  }

  const onVisibility = () => (env.document.visibilityState === 'hidden' ? leave() : back());
  const onPageHide = () => leave();
  const onPageShow = (event: { persisted?: boolean }) => {
    if (event?.persisted) back();
  };
  env.document.addEventListener('visibilitychange', onVisibility);
  env.window.addEventListener('pagehide', onPageHide);
  env.window.addEventListener('pageshow', onPageShow);
  if (env.document.visibilityState === 'hidden') leave();
  return () => {
    env.document.removeEventListener('visibilitychange', onVisibility);
    env.window.removeEventListener('pagehide', onPageHide);
    env.window.removeEventListener('pageshow', onPageShow);
  };
}
