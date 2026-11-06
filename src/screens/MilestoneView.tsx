import { StyleSheet, View } from 'react-native';

import { OutlineButton, PrimaryButton } from '@/components/Buttons';
import { Chip } from '@/components/Chip';
import { Header } from '@/components/Header';
import { SceneBox } from '@/components/SceneBox';
import { Screen, useScreenSize } from '@/components/Screen';
import { Segments } from '@/components/Segments';
import { ShareCard } from '@/components/ShareCard';
import { Stamp } from '@/components/Stamp';
import { Tiles } from '@/components/Tiles';
import { Txt } from '@/components/Txt';
import { DIFFICULTY_LABEL, milestoneHeading, shareLineFor, shareMessage, ui } from '@/copy/strings';
import { defaultGameConfig } from '@/game/gameConfig';
import { clubLong, clubShort, ladder } from '@/game/milestones';
import { maxLives, type RunState } from '@/game/run';
import { ladderOf, type SavedRules } from '@/game/runSnapshot';
import type { Word } from '@/game/types';
import { challengeUrl } from '@/lib/share';
import { THEMES } from '@/themes/themes';
import type { Theme } from '@/themes/types';

/** Facts under the solved word: its chips, led by the category in Masala Mix. */
export function wordFacts(theme: Theme, word: Word): string {
  const facts = theme.mixed ? [THEMES[word.category].copy.name, ...word.chips] : word.chips;
  return facts.slice(0, 2).join(' · ');
}

interface MilestoneViewProps {
  theme: Theme;
  run: RunState;
  onKeepPlaying: () => void;
  onBack: () => void;
  share: (build: (name: string) => string) => void;
  /** The rules a saved run started under; without them the live rules apply. */
  rules?: SavedRules;
}

export function MilestoneView({ theme, run, onKeepPlaying, onBack, share, rules }: MilestoneViewProps) {
  const { colors, copy } = theme;
  const { contentWidth, compact } = useScreenSize();
  const rungs = rules ? ladderOf(rules) : ladder;
  const reward = (rules?.config ?? defaultGameConfig).milestoneReward;
  const club = run.lastClub ?? rungs.reached(run.hits)!;
  const word = run.current!.word;
  const next = rungs.progress(run.hits);
  const lives = maxLives(run, rules?.config);
  const line = shareLineFor(theme.id, clubLong(club));
  const Scene = theme.scenes.Win;

  return (
    <Screen theme={theme} gap={compact ? 6 : 8} testID="milestone-screen">
      <Header
        label={copy.label}
        title={`${DIFFICULTY_LABEL[run.difficulty]} · ${ui.hits(run.hits)}`}
        club={clubShort(club)}
        onBack={onBack}
      />
      <SceneBox
        artHeight={200}
        bg={theme.scene.win.bg}
        border={theme.scene.win.border}
        label={theme.scenes.labels.win}
        style={styles.scene}
        overlay={
          <Stamp
            text={copy.winStamp}
            color={colors.winStamp}
            bg={colors.bg}
            size={theme.stamp.winSize}
            rotate={theme.stamp.winRotate}
            placement="bottom"
          />
        }
      >
        <Scene />
      </SceneBox>

      <View style={styles.word}>
        <Tiles answer={word.answer} shown="all" maxWidth={contentWidth} maxSize={34} aspect={42 / 34} lineGap={6} maxLines={3} />
        <Txt size={13} lh={1.4} color={colors.muted}>
          {wordFacts(theme, word)}
        </Txt>
      </View>

      <View style={[styles.panel, { backgroundColor: colors.panel, borderColor: colors.border }]}>
        <Txt size={11} weight={800} em={0.12} lh={1.3} color={colors.accent}>
          {ui.bossCleared}
        </Txt>
        <Txt display size={22} lh={1.2} color={colors.text}>
          {milestoneHeading(clubLong(club))}
        </Txt>
        <View style={styles.chips}>
          <Chip text={ui.livesRefilled(lives)} />
          <Chip text={ui.plusOne(copy.powerUps[reward.slot], reward.amount)} />
        </View>
      </View>

      <View style={styles.next}>
        <View style={styles.nextRow}>
          <Txt size={13} weight={700} lh={1.3} color={colors.text}>
            {ui.next}
            <Txt size={13} weight={700} lh={1.3} color={colors.accent}>
              {clubLong(next.to)}
            </Txt>
          </Txt>
          <Txt size={13} weight={700} lh={1.3} color={colors.text}>
            {ui.hitsToGo(next.remaining)}
          </Txt>
        </View>
        <View style={styles.segs}>
          <Segments total={next.segments} filled={next.filled} />
        </View>
      </View>

      <ShareCard line={line} footer={`${copy.name} · ${DIFFICULTY_LABEL[run.difficulty]}`} />

      <View style={styles.buttons}>
        <PrimaryButton
          label={ui.shareChallenge}
          icon="share"
          testID="share-win"
          onPress={() => share((name) => shareMessage(line, challengeUrl(word.id, name)))}
        />
        <OutlineButton label={ui.keepPlaying} onPress={onKeepPlaying} testID="keep-playing" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scene: { minHeight: 80 },
  word: { alignItems: 'center', gap: 6 },
  panel: { borderRadius: 14, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 14, gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  next: { gap: 6 },
  nextRow: { flexDirection: 'row', justifyContent: 'space-between' },
  segs: { flexDirection: 'row' },
  buttons: { marginTop: 'auto', gap: 8 },
});
