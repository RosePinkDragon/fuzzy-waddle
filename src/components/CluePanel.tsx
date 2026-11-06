import { StyleSheet, View } from 'react-native';

import { ui } from '@/copy/strings';
import { visibleClues, type ClueSettings } from '@/game/difficulty';
import type { Difficulty, Word } from '@/game/types';
import { Icon } from '@/themes/icons';
import { THEMES } from '@/themes/themes';

import { CategoryChip, Chip } from './Chip';
import { useTheme } from './ThemeContext';
import { Txt } from './Txt';

interface CluePanelProps {
  word: Word;
  difficulty: Difficulty;
  cluesRevealed: number;
  /** The clue settings a saved run started with; without them the live ones for `difficulty` apply. */
  clues?: ClueSettings;
  /** Hidden while the Masala Mix reel is still spinning. */
  concealed?: boolean;
}

export function CluePanel({ word, difficulty, cluesRevealed, clues, concealed }: CluePanelProps) {
  const theme = useTheme();
  // Masala Mix shows the word's category as the first clue.
  const showCategory = !!theme.mixed;
  const { colors } = theme;
  const v = visibleClues(difficulty, cluesRevealed, clues);
  const slot2 = theme.copy.powerUps[1];
  // Hard shows "category only": the category chip even outside Masala Mix.
  const categoryChip = showCategory || difficulty === 'hard';
  return (
    <View style={[styles.panel, { backgroundColor: colors.panel, borderColor: colors.border }]}>
      <View style={styles.head}>
        <Txt size={11} weight={800} em={0.1} color={colors.accent} lh={1.3} style={styles.label}>
          {ui.clues}
        </Txt>
        {!concealed && categoryChip && (
          <CategoryChipFor category={word.category} masala={showCategory} />
        )}
        {!concealed && v.chips && word.chips.map((c) => <Chip key={c} text={c} />)}
      </View>
      {concealed ? (
        <LockedLines />
      ) : (
        <>
          {v.clue ? (
            <Txt size={15} lh={1.35} color={colors.text}>
              {word.clue}
            </Txt>
          ) : (
            <View style={styles.locked} accessible accessibilityLabel={ui.clueLocked(slot2)}>
              <Icon name="lock" size={22} color={colors.muted} />
              <LockedLines />
            </View>
          )}
          {v.extraClue && (
            <View style={styles.extra}>
              <Icon name={theme.powerUpIcons[1]} size={16} color={colors.accent} />
              <Txt size={14} lh={1.35} color={colors.muted} style={styles.flex}>
                {word.extraClue}
              </Txt>
            </View>
          )}
        </>
      )}
    </View>
  );
}

function CategoryChipFor({ category, masala }: { category: Word['category']; masala: boolean }) {
  if (masala) return <CategoryChip category={category} />;
  return <Chip text={THEMES[category].copy.name} />;
}

function LockedLines() {
  const { colors } = useTheme();
  return (
    <View style={styles.lines}>
      <View style={[styles.bar, { width: '100%', backgroundColor: colors.border }]} />
      <View style={[styles.bar, { width: '62%', backgroundColor: colors.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' },
  label: { marginRight: 'auto' },
  locked: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lines: { flex: 1, gap: 6, paddingVertical: 2 },
  bar: { height: 10, borderRadius: 5 },
  extra: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  flex: { flex: 1 },
});
