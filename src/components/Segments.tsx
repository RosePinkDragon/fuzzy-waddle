import { StyleSheet, View } from 'react-native';

import { useTheme } from './ThemeContext';

/** The rounded progress segments used for club progress and the near-miss bar. */
export function Segments({ total, filled }: { total: number; filled: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: total }, (_, i) =>
        i < filled ? (
          <View key={i} style={[styles.seg, { backgroundColor: colors.accent }]} />
        ) : (
          <View key={i} style={[styles.seg, styles.off, { borderColor: colors.border, backgroundColor: colors.panel }]} />
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', gap: 3 },
  seg: { flex: 1, height: 8, borderRadius: 4 },
  off: { borderWidth: 1 },
});
