import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';

import { DIFFICULTY_ORDER } from '@/game/config';
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
  const { share, prompt } = useChallengeShare();
  const { run } = game;

  // Hold the game screen briefly when the last life goes, then show the flop.
  const showFlop = useFlopDelay(run.status === 'over');

  const home = () => router.replace('/');

  if (!run.current) return null;

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

  return (
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
    />
  );
}
