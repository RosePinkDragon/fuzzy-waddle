import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { CluePanel } from '@/components/CluePanel';
import { Header } from '@/components/Header';
import { Keyboard, type KeyState } from '@/components/Keyboard';
import { LivesSign } from '@/components/LivesSign';
import { PowerUpBar } from '@/components/PowerUpBar';
import { ProgressRow } from '@/components/ProgressRow';
import { SceneBox } from '@/components/SceneBox';
import { Screen, useScreenSize } from '@/components/Screen';
import { Tiles } from '@/components/Tiles';
import { DIFFICULTY_LABEL, challenge, ui } from '@/copy/strings';
import { lettersOf } from '@/game/answer';
import { lifeMarks } from '@/game/difficulty';
import { clubShort, ladder, progressLabel } from '@/game/milestones';
import type { PowerUpSlot } from '@/game/powerUps';
import { livesLeft, type RunState } from '@/game/run';
import type { Theme } from '@/themes/types';

/** Below this scene height the lives sign moves above the scene so it does not cover the hero. */
export const SIGN_INSIDE_MIN = 170;

interface GameViewProps {
  theme: Theme;
  run: RunState;
  mode: 'run' | 'challenge';
  reelLanded: boolean;
  onReelLanded: () => void;
  onPress: (letter: string) => void;
  onPower: (slot: PowerUpSlot) => void;
  powerEnabled: boolean[];
  onBack: () => void;
}

export function GameView({ theme, run, mode, reelLanded, onReelLanded, onPress, onPower, powerEnabled, onBack }: GameViewProps) {
  const { contentWidth, compact } = useScreenSize();
  const [sceneHeight, setSceneHeight] = useState(200);
  const play = run.current!;
  const answer = play.word.answer;
  const marks = lifeMarks(run.difficulty, run.livesLost);
  const left = livesLeft(run);
  const signAbove = sceneHeight < SIGN_INSIDE_MIN;
  const concealed = !!theme.mixed && !reelLanded;
  const playing = run.status === 'playing' && !concealed;

  const shown = new Set(run.status === 'solved' ? lettersOf(answer) : play.correct);
  const inAnswer = lettersOf(answer);
  const stateOf = (l: string): KeyState => {
    if (play.correct.includes(l)) return 'right';
    if (play.wrong.includes(l)) return 'wrong';
    if (play.removed.includes(l)) return 'removed';
    return 'open';
  };

  // Physical keyboards (web, tablets with keyboards).
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[a-z]$/i.test(e.key)) onPress(e.key.toUpperCase());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onPress]);

  const reached = ladder.reached(run.hits);
  const Scene = theme.scenes.Game;
  const sign = <LivesSign marks={marks} left={left} />;

  return (
    <Screen theme={theme} gap={compact ? 8 : 12} testID="game-screen">
      {mode === 'run' ? (
        <Header
          label={theme.copy.label}
          title={`${DIFFICULTY_LABEL[run.difficulty]} · ${ui.hits(run.hits)}`}
          club={reached ? clubShort(reached) : null}
          onBack={onBack}
        />
      ) : (
        <Header label={challenge.label} title={`${theme.copy.name} · ${challenge.oneWord}`} onBack={onBack} backLabel={challenge.home} />
      )}
      {mode === 'run' && <ProgressRow progress={ladder.progress(run.hits)} label={progressLabel(run)} />}

      <View
        style={styles.sceneRegion}
        onLayout={(e: LayoutChangeEvent) => setSceneHeight(Math.round(e.nativeEvent.layout.height))}
      >
        {signAbove && sign}
        <SceneBox
          artHeight={200}
          bg={theme.scene.game.bg}
          border={theme.scene.game.border}
          label={theme.scenes.labels.game}
          testID="game-scene"
          overlay={signAbove ? null : <View style={styles.signInside}>{sign}</View>}
        >
          <Scene
            marks={marks}
            category={play.word.category}
            spinKey={`${play.word.id}:${run.hits}`}
            onReelLanded={onReelLanded}
          />
        </SceneBox>
      </View>

      <Tiles
        answer={answer}
        shown={shown}
        maxWidth={contentWidth}
        maxHeight={compact ? 104 : 160}
        concealed={concealed}
      />

      <CluePanel word={play.word} difficulty={run.difficulty} cluesRevealed={play.cluesRevealed} concealed={concealed} />

      <View style={styles.bottom}>
        <PowerUpBar counts={run.powerUps} enabled={playing ? powerEnabled : [false, false, false, false]} onUse={onPower} />
        <Keyboard
          stateOf={(l) => {
            const s = stateOf(l);
            // When the word is solved, the answer letters light up even if not guessed.
            return run.status === 'solved' && s === 'open' && inAnswer.has(l) ? 'right' : s;
          }}
          onPress={onPress}
          width={contentWidth}
          disabled={!playing}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sceneRegion: { flex: 1, minHeight: 64, maxHeight: 200, gap: 6 },
  signInside: { position: 'absolute', top: 12, left: 0, right: 0, alignItems: 'center' },
  bottom: { marginTop: 'auto', gap: 12 },
});
