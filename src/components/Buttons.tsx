import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/themes/icons';

import { useTheme } from './ThemeContext';
import { Txt } from './Txt';

interface BtnProps {
  label: string;
  onPress: () => void;
  icon?: IconName;
  sublabel?: string;
  testID?: string;
}

export function PrimaryButton({ label, sublabel, icon, onPress, testID }: BtnProps) {
  const { colors } = useTheme();
  const h = sublabel ? 56 : 52;
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={sublabel ? `${label}. ${sublabel}` : label}
      style={({ pressed }) => [styles.btn, { height: h, borderRadius: h / 2, backgroundColor: colors.primary.bg, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={styles.inline}>
        {icon && <Icon name={icon} size={20} color={colors.primary.text} strokeWidth={2.2} />}
        <Txt size={16} weight={800} lh={1.2} color={colors.primary.text}>
          {label}
        </Txt>
      </View>
      {sublabel && (
        <Txt size={12} weight={700} lh={1.2} color={colors.primary.text}>
          {sublabel}
        </Txt>
      )}
    </Pressable>
  );
}

export function OutlineButton({ label, icon, onPress, testID }: BtnProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      style={({ pressed }) => [styles.btn, styles.outline, { borderColor: colors.accent, opacity: pressed ? 0.75 : 1 }]}
    >
      <View style={styles.inline}>
        {icon && <Icon name={icon} size={18} color={colors.accent} strokeWidth={2.2} />}
        <Txt size={15} weight={800} lh={1.2} color={colors.accent}>
          {label}
        </Txt>
      </View>
    </Pressable>
  );
}

export function LinkButton({ label, onPress, testID }: BtnProps) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} testID={testID} accessibilityRole="button" style={styles.link}>
      <Txt size={14} weight={700} lh={1.2} color={colors.text} style={styles.underline}>
        {label}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { alignItems: 'center', justifyContent: 'center' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  outline: { height: 44, borderRadius: 22, borderWidth: 1.5 },
  link: { height: 44, alignItems: 'center', justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
});
