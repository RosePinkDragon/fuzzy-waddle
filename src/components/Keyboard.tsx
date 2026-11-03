import { Pressable, StyleSheet, View } from 'react-native';

import { ui } from '@/copy/strings';

import { useTheme } from './ThemeContext';
import { Txt } from './Txt';

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
export const KEY_HEIGHT = 46;
export const KEYBOARD_HEIGHT = KEY_HEIGHT * 3 + 6 * 2;

export type KeyState = 'open' | 'right' | 'wrong' | 'removed';

interface KeyboardProps {
  stateOf: (letter: string) => KeyState;
  onPress: (letter: string) => void;
  width: number;
  disabled?: boolean;
}

/** QWERTY with 46px keys. Correct keys take the accent and lock; wrong ones dim, strike through and lock. */
export function Keyboard({ stateOf, onPress, width, disabled }: KeyboardProps) {
  const { colors } = useTheme();
  const keyWidth = Math.min(40, Math.floor((width - 9 * 4) / 10));
  return (
    <View style={styles.col}>
      {ROWS.map((row) => (
        <View key={row} style={styles.row}>
          {row.split('').map((l) => {
            const s = stateOf(l);
            const bg = s === 'open' ? colors.text : s === 'right' ? colors.keyRight.bg : colors.keyWrong.bg;
            const fg = s === 'open' ? colors.bg : s === 'right' ? colors.keyRight.text : colors.keyWrong.text;
            return (
              <Pressable
                key={l}
                disabled={disabled || s !== 'open'}
                onPress={() => onPress(l)}
                accessibilityRole="button"
                accessibilityLabel={ui.keyA11y(l, s)}
                accessibilityState={{ disabled: disabled || s !== 'open' }}
                testID={`key-${l}`}
                style={({ pressed }) => [
                  styles.key,
                  { width: keyWidth, backgroundColor: bg, opacity: s === 'removed' ? 0.5 : pressed ? 0.75 : 1 },
                ]}
              >
                <View>
                  <Txt size={18} weight={800} lh={1.2} color={fg}>
                    {l}
                  </Txt>
                  {s === 'wrong' && <View style={[styles.strike, { backgroundColor: fg }]} />}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  col: { gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 4 },
  key: { height: KEY_HEIGHT, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  strike: { position: 'absolute', left: -2, right: -2, top: '48%', height: 2, borderRadius: 1 },
});
