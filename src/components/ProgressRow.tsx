import { StyleSheet, View } from 'react-native';

import { ui } from '@/copy/strings';
import { clubShort, type Progress, type ProgressLabel } from '@/game/milestones';

import { Segments } from './Segments';
import { useTheme } from './ThemeContext';
import { Txt } from './Txt';

/**
 * Club progress on the game screen: segments plus "2 more to 100 Cr Club", or
 * "Boss round · Win for 100 Cr Club" while the word in play is the boss round.
 */
export function ProgressRow({ progress, label }: { progress: Progress; label: ProgressLabel }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Segments total={progress.segments} filled={progress.filled} />
      <Txt size={12} weight={700} lh={1.3} color={colors.text} numberOfLines={1}>
        {label.kind === 'boss' ? ui.bossWinFor : ui.moreTo(label.remaining)}
        <Txt size={12} weight={700} lh={1.3} color={colors.accent}>
          {clubShort(label.club)}
        </Txt>
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: 20, flexDirection: 'row', alignItems: 'center', gap: 10 },
});
