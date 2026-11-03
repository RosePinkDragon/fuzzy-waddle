import { StyleSheet, View } from 'react-native';

import { LinkButton, OutlineButton, PrimaryButton } from '@/components/Buttons';
import { Header } from '@/components/Header';
import { LivesSign } from '@/components/LivesSign';
import { SceneBox } from '@/components/SceneBox';
import { Screen, useScreenSize } from '@/components/Screen';
import { Segments } from '@/components/Segments';
import { Stamp } from '@/components/Stamp';
import { Txt } from '@/components/Txt';
import { DIFFICULTY_LABEL, challengeMessage, nearMiss, ui } from '@/copy/strings';
import { displayAnswer } from '@/game/answer';
import { lifeMarks } from '@/game/difficulty';
import { clubLong, clubShort, ladder } from '@/game/milestones';
import type { RunState } from '@/game/run';
import type { Word } from '@/game/types';
import type { Best } from '@/lib/storage';
import { challengeUrl } from '@/lib/share';
import { THEMES } from '@/themes/themes';
import type { Theme } from '@/themes/types';

export const FLOP_STAMP = '#FF5A64';

/** "(1998)" for films with a year chip, "(Safar)" in Masala Mix. */
export function answerSuffix(theme: Theme, word: Word): string {
  if (theme.mixed) return ` (${THEMES[word.category].copy.name})`;
  const year = word.chips.find((c) => /^\d{4}$/.test(c));
  return year ? ` (${year})` : '';
}

interface FlopViewProps {
  theme: Theme;
  run: RunState;
  best: Best | null;
  isNewBest: boolean;
  onRestart: () => void;
  onChangeDifficulty: () => void;
  onBack: () => void;
  share: (build: (name: string) => string) => void;
}

export function FlopView({ theme, run, best, isNewBest, onRestart, onChangeDifficulty, onBack, share }: FlopViewProps) {
  const { colors, copy } = theme;
  const { compact } = useScreenSize();
  const word = run.current!.word;
  const reached = ladder.reached(run.hits);
  const progress = ladder.progress(run.hits);
  const miss = nearMiss(clubLong(progress.to), progress.remaining);
  const bestHits = Math.max(best?.hits ?? 0, run.hits);
  const bestClub = ladder.reached(bestHits);
  const Scene = theme.scenes.Lose;

  return (
    <Screen theme={theme} gap={compact ? 8 : 12} testID="flop-screen">
      <Header label={copy.label} title={`${DIFFICULTY_LABEL[run.difficulty]} · ${ui.runOver}`} club={reached ? clubShort(reached) : null} onBack={onBack} />
      <SceneBox
        artHeight={220}
        bg={theme.scene.lose.bg}
        border={theme.scene.lose.border}
        label={theme.scenes.labels.lose}
        style={styles.scene}
        overlay={<Stamp text={copy.flopStamp} color={FLOP_STAMP} bg={colors.bg} size={theme.stamp.loseSize} rotate={6} placement="center" />}
      >
        <Scene />
      </SceneBox>

      <LivesSign marks={lifeMarks(run.difficulty, 99)} left={0} boxed={false} />

      <View style={styles.center}>
        <Txt display size={26} lh={1.2} color={colors.text} align="center">
          {copy.flopLine}
        </Txt>
        <Txt size={14} lh={1.35} color={colors.muted} align="center">
          {ui.answerWas(copy.answerNoun)}
          <Txt size={14} weight={800} lh={1.35} color={colors.text}>
            {displayAnswer(word.answer)}
          </Txt>
          {`${answerSuffix(theme, word)}.`}
        </Txt>
      </View>

      <View style={styles.stats}>
        <Stat label={ui.thisRun} value={ui.hits(run.hits)} sub={reached ? clubLong(reached) : ui.noClub} theme={theme} />
        <Stat
          label={isNewBest ? ui.newBest.toUpperCase() : ui.yourBest(run.difficulty)}
          value={ui.hits(bestHits)}
          sub={bestClub ? clubLong(bestClub) : ui.noClub}
          theme={theme}
        />
      </View>

      <View style={styles.near}>
        <Txt size={13} weight={700} lh={1.3} color={colors.text}>
          {miss.before}
          <Txt size={13} weight={700} lh={1.3} color={colors.accent}>
            {miss.highlight}
          </Txt>
          {miss.after}
        </Txt>
        <View style={styles.segs}>
          <Segments total={progress.segments} filled={progress.filled} />
        </View>
      </View>

      <View style={styles.buttons}>
        <PrimaryButton label={copy.restart} sublabel={ui.newRandomRun} onPress={onRestart} testID="restart" />
        <OutlineButton
          label={ui.challengeThisOne}
          icon="share"
          testID="share-flop"
          onPress={() => share((name) => challengeMessage(word.category, challengeUrl(word.id, name)))}
        />
        <LinkButton label={ui.changeDifficulty} onPress={onChangeDifficulty} testID="change-difficulty" />
      </View>
    </Screen>
  );
}

function Stat({ label, value, sub, theme }: { label: string; value: string; sub: string; theme: Theme }) {
  const { colors } = theme;
  return (
    <View style={[styles.stat, { backgroundColor: colors.panel, borderColor: colors.border }]}>
      <Txt size={11} weight={800} em={0.08} lh={1.3} color={colors.accent}>
        {label}
      </Txt>
      <Txt display size={22} lh={1.25} color={colors.text}>
        {value}
      </Txt>
      <Txt size={12} lh={1.3} color={colors.muted}>
        {sub}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  scene: { minHeight: 110 },
  center: { gap: 4 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 12 },
  near: { gap: 6 },
  segs: { flexDirection: 'row' },
  buttons: { marginTop: 'auto', gap: 8 },
});
