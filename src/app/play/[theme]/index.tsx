/**
 * Difficulty picker, Picker layout A (#57): a saved run's card expands in place with Resume and
 * New run (which asks first), the other cards just start. Shows bests whether or not a run is
 * saved, and says so when saving is off or a saved run couldn't be restored.
 */
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Header } from '@/components/Header';
import { LivesSign } from '@/components/LivesSign';
import { ChoiceButton, Notice, NoticeSheet, SheetLine } from '@/components/Notice';
import { SceneBox } from '@/components/SceneBox';
import { Screen, useScreenSize } from '@/components/Screen';
import { Txt } from '@/components/Txt';
import { DIFFICULTY_LABEL, a11y, difficultyPicker, newRun, picker, recovery, unsaved } from '@/copy/strings';
import { DIFFICULTY_ORDER } from '@/game/config';
import { lifeMarks, rulesFor } from '@/game/difficulty';
import { livesLeft } from '@/game/run';
import { ladderOf, settleBest, type SlotDoc } from '@/game/runSnapshot';
import type { Difficulty, ThemeId } from '@/game/types';
import { subscribeLifecycle } from '@/lib/device';
import {
  inspectSlots,
  markRecoveryShown,
  pendingRecoveries,
  recoveryShown,
  startNewRun,
  tapRecoveryCard,
  type RecoveryEntry,
  type SlotCard,
} from '@/lib/runController';
import type { UnsavedCause } from '@/lib/runStore';
import { Icon } from '@/themes/icons';
import { isThemeId, themeFor } from '@/themes/themes';
import type { Theme } from '@/themes/types';

type Cards = Record<Difficulty, SlotCard>;

export default function DifficultyPicker() {
  const { theme: themeParam } = useLocalSearchParams<{ theme: string }>();
  if (!isThemeId(themeParam)) return <Redirect href="/" />;
  return <Picker key={themeParam} themeId={themeParam} />;
}

/** The first recovery notice the player hasn't been shown, from the registry or from what inspect found. */
function nextNotice(themeId: ThemeId, cards: Cards): RecoveryEntry | null {
  const registry = pendingRecoveries(themeId);
  for (const d of DIFFICULTY_ORDER) {
    const entry = registry.find((e) => e.difficulty === d);
    if (entry) return entry;
    const card = cards[d];
    if (card.kind === 'recovery' && !recoveryShown(themeId, d)) {
      return { theme: themeId, difficulty: d, reason: card.reason, best: card.best };
    }
  }
  return null;
}

/** "Best: 9 hits · 50 Cr Club", "Not played yet", "No best yet" or "Best: unavailable". */
function bestText(card: SlotCard | undefined): string {
  if (!card) return '';
  switch (card.kind) {
    case 'unavailable':
      return picker.bestUnavailable;
    case 'saved':
      if (card.unsaved === 'read-failed') return picker.bestUnavailable;
      return card.doc.best ? picker.best(card.doc.best) : picker.noBestYet;
    case 'fresh':
    case 'recovery':
      return card.best ? picker.best(card.best) : picker.notPlayed;
  }
}

function Picker({ themeId }: { themeId: ThemeId }) {
  const router = useRouter();
  const theme = themeFor(themeId);
  const { colors } = theme;
  const { compact } = useScreenSize();
  const Scene = theme.scenes.Game;

  const [cards, setCards] = useState<Cards | null>(null);
  const [notice, setNotice] = useState<RecoveryEntry | null>(null);
  const [sheet, setSheet] = useState<{ difficulty: Difficulty; doc: SlotDoc } | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const noticeRef = useRef<RecoveryEntry | null>(null);
  const loadSeq = useRef(0);

  const showNotice = useCallback((entry: RecoveryEntry | null) => {
    noticeRef.current = entry;
    setNotice(entry);
  }, []);

  /** Shows the next unseen recovery notice, if none is showing. Showing one marks it seen. */
  const surfaceNotice = useCallback(
    (found: Cards) => {
      if (noticeRef.current) return;
      const entry = nextNotice(themeId, found);
      if (!entry) return;
      markRecoveryShown(themeId, entry.difficulty);
      showNotice(entry);
    },
    [themeId, showNotice],
  );

  const refresh = useCallback(async () => {
    const seq = (loadSeq.current += 1);
    const found = await inspectSlots(themeId);
    if (seq !== loadSeq.current) return;
    setCards(found);
    surfaceNotice(found);
  }, [themeId, surfaceNotice]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      // Coming back to the app can mean another tab or a restart changed what is saved.
      const off = subscribeLifecycle({ onLeave: () => undefined, onReturn: () => void refresh() });
      return () => {
        loadSeq.current += 1;
        off();
      };
    }, [refresh]),
  );

  const dismissNotice = () => {
    showNotice(null);
    if (cards) surfaceNotice(cards);
  };

  const open = (d: Difficulty) => router.push(`/play/${themeId}/${d}`);

  /** Runs one choice at a time, so a second tap can't start anything while the first is finishing. */
  const exclusive = async (job: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await job();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  /** A card was chosen: Resume, or the whole card of a slot with nothing to resume. */
  const choose = (d: Difficulty) =>
    exclusive(async () => {
      const card = cards?.[d];
      // Bad data the player hasn't been told about gets its notice first, read before the tap
      // (the helper takes the slot out of the registry); the next tap goes on to the game.
      const waiting = pendingRecoveries(themeId).find((e) => e.difficulty === d);
      const entry: RecoveryEntry | null =
        waiting ?? (card?.kind === 'recovery' ? { theme: themeId, difficulty: d, reason: card.reason, best: card.best } : null);
      if (entry && tapRecoveryCard(themeId, d) === 'show notice') {
        showNotice(entry);
        return;
      }
      // A finished run never resumes: the tap starts a new one, of the run the player saw.
      if (card?.kind === 'fresh' && card.terminalRunId) {
        const out = await startNewRun(themeId, d, card.terminalRunId);
        if (out === 'started') open(d);
        else await refresh();
        return;
      }
      open(d);
    });

  const confirmNewRun = () =>
    exclusive(async () => {
      if (!sheet) return;
      const { difficulty, doc } = sheet;
      const out = await startNewRun(themeId, difficulty, doc.runId);
      setSheet(null);
      if (out === 'started') open(difficulty);
      else await refresh();
    });

  const savedCount = cards ? DIFFICULTY_ORDER.filter((d) => cards[d].kind === 'saved').length : 0;
  const savingOff =
    !!cards &&
    DIFFICULTY_ORDER.some((d) => {
      const card = cards[d];
      return card.kind === 'unavailable' || (card.kind === 'saved' && !!card.unsaved);
    });

  return (
    <Screen theme={theme} gap={compact ? 8 : 12} testID="difficulty-screen">
      <Header label={theme.copy.label} title={difficultyPicker.title} onBack={() => router.replace('/')} />
      <SceneBox artHeight={200} bg={theme.scene.game.bg} border={theme.scene.game.border} label={theme.scenes.labels.game} style={styles.scene}>
        <Scene marks={lifeMarks('easy', 0)} category={theme.mixed ? 'safar' : null} spinKey={null} instantReel />
      </SceneBox>
      <Txt size={11} weight={800} em={0.14} lh={1.3} color={colors.accent}>
        {difficultyPicker.subtitle.toUpperCase()}
      </Txt>
      {notice && (
        <Notice
          icon="warning"
          title={recovery.title(notice.difficulty)}
          body={recovery.body(!!notice.best)}
          onDismiss={dismissNotice}
          compact={compact}
          testID="recovery-notice"
        />
      )}
      {savingOff && <Notice icon="cloudOff" title={unsaved.pickerTitle} body={unsaved.pickerBody} compact={compact} testID="saving-off-notice" />}
      <View style={[styles.options, { gap: compact ? 8 : 10 }]}>
        {DIFFICULTY_ORDER.map((d) => {
          const card = cards?.[d];
          return card?.kind === 'saved' ? (
            <SavedCard
              key={d}
              theme={theme}
              difficulty={d}
              doc={card.doc}
              unsavedCause={card.unsaved}
              best={bestText(card)}
              compact={compact}
              busy={busy}
              onResume={() => void choose(d)}
              onNewRun={() => setSheet({ difficulty: d, doc: card.doc })}
            />
          ) : (
            <PlainCard
              key={d}
              theme={theme}
              difficulty={d}
              best={bestText(card)}
              compact={compact}
              disabled={busy}
              onPress={() => void choose(d)}
            />
          );
        })}
      </View>
      {savedCount < 2 && (
        <Txt size={12} lh={1.35} color={colors.muted} align="center" style={styles.foot}>
          {difficultyPicker.footnote}
        </Txt>
      )}
      <NewRunSheet
        theme={theme}
        sheet={sheet}
        busy={busy}
        onKeep={() => setSheet(null)}
        onConfirm={() => void confirmNewRun()}
      />
    </Screen>
  );
}

function PlainCard({
  theme,
  difficulty,
  best,
  compact,
  disabled,
  onPress,
}: {
  theme: Theme;
  difficulty: Difficulty;
  best: string;
  compact: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = theme;
  return (
    <Pressable
      testID={`difficulty-${difficulty}`}
      accessibilityRole="button"
      accessibilityLabel={a11y.difficultyCard(difficulty, difficultyPicker.detail[difficulty], best)}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        compact && styles.optionCompact,
        { backgroundColor: colors.panel, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={styles.optionTop}>
        <View style={styles.flex}>
          <Txt display size={22} lh={1.2} color={colors.text}>
            {DIFFICULTY_LABEL[difficulty]}
          </Txt>
          <Txt size={13} lh={1.3} color={colors.muted}>
            {difficultyPicker.detail[difficulty]}
          </Txt>
        </View>
        <View style={styles.right}>
          <Txt size={11} weight={700} lh={1.3} color={colors.accent} align="right">
            {best}
          </Txt>
          <View style={[styles.go, { backgroundColor: colors.accent }]}>
            <View style={styles.flip}>
              <Icon name="back" size={18} color={colors.onAccent} strokeWidth={2.6} />
            </View>
          </View>
        </View>
      </View>
      {!compact && (
        <View style={styles.sign}>
          <LivesSign marks={lifeMarks(difficulty, 0)} left={rulesFor(difficulty).lives} boxed={false} />
        </View>
      )}
    </Pressable>
  );
}

function SavedCard({
  theme,
  difficulty,
  doc,
  unsavedCause,
  best,
  compact,
  busy,
  onResume,
  onNewRun,
}: {
  theme: Theme;
  difficulty: Difficulty;
  doc: SlotDoc;
  unsavedCause: UnsavedCause | null;
  best: string;
  compact: boolean;
  busy: boolean;
  onResume: () => void;
  onNewRun: () => void;
}) {
  const { colors } = theme;
  const lives = livesLeft(doc.run, doc.rules.config);
  const club = ladderOf(doc.rules).reached(doc.run.hits);
  const height = compact ? 46 : 48;
  return (
    <View
      testID={`saved-${difficulty}`}
      style={[styles.option, compact && styles.optionCompact, styles.saved, { backgroundColor: colors.panel, borderColor: colors.accent }]}
    >
      <View style={styles.optionTop}>
        <Txt display size={22} lh={1.2} color={colors.text}>
          {DIFFICULTY_LABEL[difficulty]}
        </Txt>
        {unsavedCause ? (
          <View style={[styles.tag, styles.tagOut, { borderColor: colors.accent }]} testID={`unsaved-chip-${difficulty}`}>
            <Txt size={10.5} weight={800} em={0.08} lh={1.3} color={colors.text}>
              {picker.chip.notSaved}
            </Txt>
          </View>
        ) : (
          <View style={[styles.tag, { backgroundColor: colors.chip.bg }]}>
            <Txt size={10.5} weight={800} em={0.08} lh={1.3} color={colors.chip.text}>
              {picker.chip.saved}
            </Txt>
          </View>
        )}
        <Txt size={11} weight={700} lh={1.3} color={colors.accent} align="right" style={styles.flex}>
          {best}
        </Txt>
      </View>
      <View style={[styles.optionTop, styles.between]}>
        <LivesSign marks={lifeMarks(difficulty, doc.run.livesLost)} left={lives} boxed={false} />
        <Txt size={13} weight={700} lh={1.3} color={colors.text} align="right" style={styles.run}>
          {picker.runProgress(doc.run.hits, club?.crore ?? null)}
        </Txt>
      </View>
      <View style={styles.buttons}>
        <ChoiceButton
          label={picker.resume}
          variant="primary"
          height={height}
          icon="play"
          iconFilled
          disabled={busy}
          accessibilityLabel={a11y.resume(difficulty, doc.run.hits, lives)}
          testID={`resume-${difficulty}`}
          onPress={onResume}
          style={styles.flex}
        />
        <ChoiceButton
          label={picker.newRun}
          variant="outline"
          height={height}
          disabled={busy}
          accessibilityLabel={a11y.newRun(difficulty)}
          testID={`new-run-${difficulty}`}
          onPress={onNewRun}
          style={styles.newRun}
        />
      </View>
    </View>
  );
}

/** Says what ending the run costs, and keeps the run unless the player says otherwise. */
function NewRunSheet({
  theme,
  sheet,
  busy,
  onKeep,
  onConfirm,
}: {
  theme: Theme;
  sheet: { difficulty: Difficulty; doc: SlotDoc } | null;
  busy: boolean;
  onKeep: () => void;
  onConfirm: () => void;
}) {
  const lines = sheet ? newRunLines(sheet.difficulty, sheet.doc) : [];
  return (
    <NoticeSheet theme={theme} visible={!!sheet} onRequestClose={onKeep} title={newRun.title} testID="new-run-sheet">
      <View style={styles.lines}>
        {lines.map((line) => (
          <SheetLine key={line} text={line} />
        ))}
      </View>
      <ChoiceButton label={newRun.keep} variant="primary" height={52} disabled={busy} onPress={onKeep} testID="new-run-keep" style={styles.keep} />
      <ChoiceButton label={newRun.confirm} variant="outline" disabled={busy} onPress={onConfirm} testID="new-run-confirm" style={styles.confirm} />
    </NoticeSheet>
  );
}

/** The lines on the New run sheet for a saved run. */
export function newRunLines(difficulty: Difficulty, doc: SlotDoc): string[] {
  const { hits } = doc.run;
  const club = ladderOf(doc.rules).reached(hits)?.crore ?? null;
  return newRun.lines(difficulty, hits, livesLeft(doc.run, doc.rules.config), doc.best, settleBest(doc.best, hits, club));
}

const styles = StyleSheet.create({
  scene: { minHeight: 90, maxHeight: 200 },
  options: { gap: 10 },
  option: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, gap: 6 },
  optionCompact: { paddingVertical: 8, gap: 4 },
  saved: { borderWidth: 1.5 },
  optionTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // Safar's sign (a COACHES label and nine marks) leaves little room: a tighter gap, and the text wraps rather than clips.
  between: { justifyContent: 'space-between', gap: 6 },
  run: { flexShrink: 1 },
  flex: { flex: 1 },
  right: { alignItems: 'flex-end', gap: 6 },
  go: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  flip: { transform: [{ scaleX: -1 }] },
  sign: { alignItems: 'flex-start' },
  foot: { marginTop: 'auto' },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  tagOut: { backgroundColor: 'transparent', borderWidth: 1.5, borderStyle: 'dashed', paddingHorizontal: 7, paddingVertical: 1 },
  buttons: { flexDirection: 'row', gap: 8, marginTop: 2 },
  newRun: { width: 128 },
  lines: { gap: 6 },
  keep: { marginTop: 4 },
  confirm: { marginTop: 12 },
});
