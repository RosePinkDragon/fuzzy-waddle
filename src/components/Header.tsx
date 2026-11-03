import { Pressable, StyleSheet, View } from 'react-native';

import { ui } from '@/copy/strings';
import { Icon } from '@/themes/icons';

import { useTheme } from './ThemeContext';
import { Txt } from './Txt';

interface HeaderProps {
  label: string;
  title: string;
  /** Club badge text, e.g. "50 Cr Club"; null shows an outlined "No club yet". */
  club?: string | null;
  onBack?: () => void;
  backLabel?: string;
}

/** Back button, category label + title, and the club badge. */
export function Header({ label, title, club, onBack, backLabel = 'Back to categories' }: HeaderProps) {
  const { colors } = useTheme();
  const hasClub = club !== undefined;
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        style={[styles.back, { borderColor: colors.border, backgroundColor: colors.panel }]}
      >
        <Icon name="back" size={20} color={colors.text} strokeWidth={2.4} />
      </Pressable>
      <View style={styles.middle}>
        <Txt size={11} weight={800} em={0.14} color={colors.accent} lh={1.3}>
          {label}
        </Txt>
        <Txt size={17} weight={700} color={colors.text} lh={1.2} accessibilityRole="header">
          {title}
        </Txt>
      </View>
      {hasClub ? (
        <View
          style={[
            styles.badge,
            club
              ? { backgroundColor: colors.accent, borderColor: colors.accent }
              : { backgroundColor: 'transparent', borderColor: colors.border },
          ]}
        >
          <Icon name="ticket" size={16} color={club ? colors.onAccent : colors.muted} strokeWidth={2.2} />
          <Txt size={club ? 14 : 12} weight={800} color={club ? colors.onAccent : colors.muted} lh={1.2}>
            {club ?? ui.noClub}
          </Txt>
        </View>
      ) : (
        <View style={styles.spacer} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  middle: { alignItems: 'center', flexShrink: 1, paddingHorizontal: 6 },
  badge: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  spacer: { width: 44 },
});
