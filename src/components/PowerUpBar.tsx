import { Pressable, StyleSheet, View } from 'react-native';

import { POWER_UP_DOES, ui } from '@/copy/strings';
import type { PowerUpSlot } from '@/game/powerUps';
import { Icon } from '@/themes/icons';

import { useTheme } from './ThemeContext';
import { Txt } from './Txt';

interface PowerUpBarProps {
  counts: number[];
  enabled: boolean[];
  onUse: (slot: PowerUpSlot) => void;
}

/** Four power-up slots; each does the same thing in every theme, only name and icon change. */
export function PowerUpBar({ counts, enabled, onUse }: PowerUpBarProps) {
  const theme = useTheme();
  const { colors } = theme;
  return (
    <View style={styles.row}>
      {([0, 1, 2, 3] as PowerUpSlot[]).map((slot) => {
        const name = theme.copy.powerUps[slot];
        const on = enabled[slot];
        return (
          <Pressable
            key={slot}
            onPress={() => onUse(slot)}
            disabled={!on}
            accessibilityRole="button"
            accessibilityLabel={ui.powerUpA11y(name, POWER_UP_DOES[slot], counts[slot])}
            accessibilityState={{ disabled: !on }}
            testID={`powerup-${slot}`}
            style={({ pressed }) => [
              styles.btn,
              { borderColor: colors.border, backgroundColor: colors.panel, opacity: on ? (pressed ? 0.8 : 1) : 0.45 },
            ]}
          >
            <Icon name={theme.powerUpIcons[slot]} size={22} color={colors.accent} />
            <Txt size={11.5} weight={700} lh={1.2} color={colors.text} numberOfLines={1} style={styles.label}>
              {name}
            </Txt>
            <View style={[styles.badge, { backgroundColor: colors.badge.bg }]}>
              <Txt size={12} weight={800} lh={1.2} color={colors.badge.text}>
                {counts[slot]}
              </Txt>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1,
    height: 54,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  label: { maxWidth: '100%', paddingHorizontal: 2 },
  badge: {
    position: 'absolute',
    top: -6,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
