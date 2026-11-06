import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ChoiceButton, NoticeSheet, SheetLine } from '@/components/Notice';
import { Txt } from '@/components/Txt';
import { wordReplaced } from '@/copy/strings';
import { DIFFICULTY_ORDER } from '@/game/config';
import { livesLeft } from '@/game/run';
import { ladderOf } from '@/game/runSnapshot';
import type { Difficulty, ThemeId } from '@/game/types';
import { useChallengeShare } from '@/hooks/useChallengeShare';
import { useFlopDelay } from '@/hooks/useFlopDelay';
import { useRun } from '@/hooks/useRun';
import { FlopView } from '@/screens/FlopView';
import { GameView } from '@/screens/GameView';
import { MilestoneView } from '@/screens/MilestoneView';
import { isThemeId, themeFor } from '@/themes/themes';

export default function RunRoute() {
  const params = useLocalSearchParams<{ theme: string; difficulty: string }>();
  if (!isThemeId(params.theme) || !DIFFICULTY_ORDER.includes(params.difficulty as Difficulty)) {
    return <Redirect href="/" />;
  }
  return <Run key={`${params.theme}:${params.difficulty}`} themeId={params.theme} difficulty={params.difficulty as Difficulty} />;
}

function Run({ themeId, difficulty }: { themeId: ThemeId; difficulty: Difficulty }) {
  const router = useRouter();
  const theme = themeFor(themeId);
  const game = useRun(themeId, difficulty);
  const { share, prompt } = useChallengeShare(theme);
  const { run, doc } = game;

  // Hold the game screen briefly when the last life goes, then show the flop.
  const showFlop = useFlopDelay(run?.status === 'over');

  const home = () => router.replace('/');

  // Bad data waits for its notice, which the picker shows; with no word to play there is nothing to open.
  if (game.phase === 'recoveryPending' || game.phase === 'empty') return <Redirect href={`/play/${themeId}`} />;
  if (game.phase === 'loading' || !run?.current || !doc) return null;

  if (run.status === 'milestone') {
    return (
      <>
        <MilestoneView theme={theme} run={run} onKeepPlaying={game.keepPlaying} onBack={home} share={share} />
        {prompt}
      </>
    );
  }

  if (run.status === 'over' && showFlop) {
    return (
      <>
        <FlopView
          theme={theme}
          run={run}
          best={game.best}
          isNewBest={game.isNewBest}
          onRestart={game.restart}
          onChangeDifficulty={() => router.replace(`/play/${themeId}`)}
          onBack={home}
          share={share}
        />
        {prompt}
      </>
    );
  }

  const migration = game.notice?.migration;
  const club = ladderOf(doc.rules).reached(run.hits);
  return (
    <>
      <GameView
        theme={theme}
        run={run}
        mode="run"
        reelLanded={game.reelLanded}
        onReelLanded={game.onReelLanded}
        onPress={game.press}
        onPower={game.usePower}
        powerEnabled={game.powerEnabled}
        onBack={home}
        saved={game.saved}
      />
      <NoticeSheet
        theme={theme}
        visible={!!migration}
        onRequestClose={game.dismissNotice}
        title={wordReplaced.title}
        icon="swap"
        testID="word-replaced"
      >
        <View style={styles.lines}>
          <SheetLine text={wordReplaced.body1} />
          <SheetLine text={wordReplaced.body2(run.hits, livesLeft(run, doc.rules.config), club?.crore ?? null)} />
        </View>
        <View style={styles.chips}>
          {migration &&
            wordReplaced.refunds(migration.refunds, theme.copy.powerUps).map((text) => (
              <View key={text} style={[styles.chip, { backgroundColor: theme.colors.chip.bg }]}>
                <Txt size={12} weight={800} em={0.08} lh={1.3} color={theme.colors.chip.text}>
                  {text}
                </Txt>
              </View>
            ))}
        </View>
        <ChoiceButton
          label={wordReplaced.cta}
          variant="primary"
          height={52}
          onPress={game.dismissNotice}
          testID="word-replaced-ok"
        />
      </NoticeSheet>
    </>
  );
}

const styles = StyleSheet.create({
  lines: { gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
});
