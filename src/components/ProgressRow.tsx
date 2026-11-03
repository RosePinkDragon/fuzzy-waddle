import { StyleSheet, View } from 'react-native';

import { ui } from '@/copy/strings';
import { clubShort, type Progress } from '@/game/milestones';

import { Segments } from './Segments';
import { useTheme } from './ThemeContext';
import { Txt } from './Txt';

/** Club progress on the game screen: segments plus "2 more to 100 Cr Club" or "Next hit: boss round". */
export function ProgressRow({ progress }: { progress: Progress }) {
  const { colors } = useTheme();
  const boss = progress.remaining === 1;
  return (
    <View style={styles.row}>
      <Segments total={progress.segments} filled={progress.filled} />
      <Txt size={12} weight={700} lh={1.3} color={colors.text} numberOfLines={1}>
        {boss ? ui.nextHit : ui.moreTo(progress.remaining)}
        <Txt size={12} weight={700} lh={1.3} color={colors.accent}>
          {boss ? ui.bossRound : clubShort(progress.to)}
        </Txt>
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: 20, flexDirection: 'row', alignItems: 'center', gap: 10 },
});
