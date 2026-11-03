/**
 * Challenge landing (/c/<wordId>?from=<name>): "<name> ne challenge kiya!",
 * then a one-word game, then "Challenge back". Not designed in the mockups;
 * built in the same visual language and flagged for design review.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LinkButton, OutlineButton, PrimaryButton } from '@/components/Buttons';
import { CategoryChip, Chip } from '@/components/Chip';
import { Header } from '@/components/Header';
import { SceneBox } from '@/components/SceneBox';
import { Screen, useScreenSize } from '@/components/Screen';
import { Stamp } from '@/components/Stamp';
import { Tiles } from '@/components/Tiles';
import { Txt } from '@/components/Txt';
import { GAME_NAME, challenge, challengeMessage } from '@/copy/strings';
import { challengePool, wordById } from '@/data/words';
import { displayAnswer } from '@/game/answer';
import { lifeMarks } from '@/game/difficulty';
import { pick } from '@/game/rng';
import type { Word } from '@/game/types';
import { useChallengeShare } from '@/hooks/useChallengeShare';
import { useRun } from '@/hooks/useRun';
import { challengeUrl } from '@/lib/share';
import { FLOP_STAMP } from '@/screens/FlopView';
import { GameView } from '@/screens/GameView';
import { wordFacts } from '@/screens/MilestoneView';
import { THEMES } from '@/themes/themes';

export default function ChallengeRoute() {
  const { wordId, from } = useLocalSearchParams<{ wordId: string; from?: string }>();
  const word = wordId ? wordById(wordId) : undefined;
  const name = typeof from === 'string' ? from.trim().slice(0, 24) : '';
  if (!word) return <BadLink />;
  return <Challenge key={word.id} word={word} from={name} />;
}

function Challenge({ word, from }: { word: Word; from: string }) {
  const router = useRouter();
  const theme = THEMES[word.category];
  const { colors, copy } = theme;
  const [accepted, setAccepted] = useState(false);
  // The challenge plays with the rules of the word's own difficulty tier.
  const game = useRun(word.category, word.difficulty, { challengeWord: word });
  const { share, prompt } = useChallengeShare();
  const { contentWidth } = useScreenSize();
  const home = () => router.replace('/');
  const Scene = theme.scenes.Game;

  const challengeBack = () => {
    const others = challengePool(word.category).filter((w) => w.id !== word.id);
    const next = pick(others.length ? others : [word], Math.random);
    share((me) => challengeMessage(word.category, challengeUrl(next.id, me)));
  };

  if (!accepted) {
    return (
      <Screen theme={theme} testID="challenge-landing">
        <Header label={GAME_NAME.toUpperCase()} title={copy.name} onBack={home} backLabel={challenge.home} />
        <SceneBox artHeight={200} bg={theme.scene.game.bg} border={theme.scene.game.border} label={theme.scenes.labels.game} style={styles.scene}>
          <Scene marks={lifeMarks(word.difficulty, 0)} category={word.category} spinKey={null} instantReel />
        </SceneBox>
        <View style={[styles.card, { backgroundColor: colors.panel, borderColor: colors.border }]}>
          <Txt size={11} weight={800} em={0.14} lh={1.3} color={colors.accent}>
            {challenge.label}
          </Txt>
          <Txt display size={26} lh={1.2} color={colors.text} accessibilityRole="header">
            {from ? challenge.from(from) : challenge.anonymous}
          </Txt>
          <Txt size={15} lh={1.35} color={colors.muted}>
            {challenge.intro(copy.name)}
          </Txt>
          <View style={styles.chips}>
            <CategoryChip category={word.category} />
            <Chip text={challenge.oneWord} />
          </View>
        </View>
        <View style={styles.buttons}>
          <PrimaryButton label={challenge.accept} onPress={() => setAccepted(true)} testID="accept-challenge" />
          <LinkButton label={challenge.home} onPress={home} />
        </View>
      </Screen>
    );
  }

  const { run } = game;
  if (!run.current) return null;
  const done = run.status === 'solved' || run.status === 'over';

  if (!done) {
    return (
      <GameView
        theme={theme}
        run={run}
        mode="challenge"
        reelLanded
        onReelLanded={game.onReelLanded}
        onPress={game.press}
        onPower={game.usePower}
        powerEnabled={game.powerEnabled}
        onBack={home}
      />
    );
  }

  const won = run.status === 'solved';
  const ResultScene = won ? theme.scenes.Win : theme.scenes.Lose;
  return (
    <Screen theme={theme} testID="challenge-result">
      <Header label={challenge.label} title={`${copy.name} · ${challenge.oneWord}`} onBack={home} backLabel={challenge.home} />
      <SceneBox
        artHeight={won ? 200 : 220}
        bg={won ? theme.scene.win.bg : theme.scene.lose.bg}
        border={won ? theme.scene.win.border : theme.scene.lose.border}
        label={won ? theme.scenes.labels.win : theme.scenes.labels.lose}
        style={styles.resultScene}
        overlay={
          <Stamp
            text={won ? copy.winStamp : copy.flopStamp}
            color={won ? colors.winStamp : FLOP_STAMP}
            bg={colors.bg}
            size={won ? theme.stamp.winSize : theme.stamp.loseSize}
            rotate={won ? theme.stamp.winRotate : 6}
            placement={won ? 'bottom' : 'center'}
          />
        }
      >
        <ResultScene />
      </SceneBox>
      <View style={styles.word}>
        <Tiles answer={word.answer} shown="all" maxWidth={contentWidth} maxSize={34} aspect={42 / 34} lineGap={6} />
        <Txt size={13} lh={1.4} color={colors.muted}>
          {wordFacts(theme, word)}
        </Txt>
      </View>
      <View style={styles.center}>
        <Txt display size={26} lh={1.2} color={colors.text} align="center">
          {won ? challenge.solvedTitle : challenge.failedTitle}
        </Txt>
        <Txt size={14} lh={1.35} color={colors.muted} align="center">
          {won ? challenge.solvedLine(from || undefined) : `${displayAnswer(word.answer, word.display)}. ${challenge.failedLine}`}
        </Txt>
      </View>
      <View style={styles.buttons}>
        <PrimaryButton label={challenge.challengeBack} icon="share" onPress={challengeBack} testID="challenge-back" />
        <OutlineButton label={challenge.fullRun} onPress={() => router.replace(`/play/${word.category}`)} testID="full-run" />
        <LinkButton label={challenge.home} onPress={home} />
      </View>
      {prompt}
    </Screen>
  );
}

function BadLink() {
  const router = useRouter();
  const theme = THEMES.filmy;
  return (
    <Screen theme={theme} testID="challenge-bad-link">
      <Header label={GAME_NAME.toUpperCase()} title={challenge.label} onBack={() => router.replace('/')} backLabel={challenge.home} />
      <View style={styles.badBody}>
        <Txt display size={26} lh={1.2} color={theme.colors.text} align="center">
          {challenge.badLinkTitle}
        </Txt>
        <Txt size={15} lh={1.35} color={theme.colors.muted} align="center">
          {challenge.badLinkLine}
        </Txt>
      </View>
      <View style={styles.buttons}>
        <PrimaryButton label={challenge.home} onPress={() => router.replace('/')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scene: { minHeight: 120 },
  resultScene: { minHeight: 100 },
  card: { borderRadius: 14, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 16, gap: 6 },
  chips: { flexDirection: 'row', gap: 6, marginTop: 4 },
  word: { alignItems: 'center', gap: 6 },
  center: { gap: 4 },
  buttons: { marginTop: 'auto', gap: 8 },
  badBody: { flex: 1, justifyContent: 'center', gap: 10 },
});
