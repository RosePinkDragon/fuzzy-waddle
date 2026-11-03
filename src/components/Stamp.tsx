import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { Txt } from './Txt';

interface StampProps {
  text: string;
  color: string;
  bg: string;
  size: number;
  rotate: number;
  /** Win stamps sit at the bottom of the scene; flop stamps are centred a bit above middle. */
  placement: 'bottom' | 'center';
}

/** The rubber-stamp label with a double border (CSS "4px double"), as in the mockups. */
export function Stamp({ text, color, bg, size, rotate, placement }: StampProps) {
  return (
    <View pointerEvents="none" style={placement === 'bottom' ? styles.bottom : styles.center}>
      <Animated.View entering={ZoomIn.duration(260)}>
        <View style={[styles.outer, { borderColor: color, backgroundColor: bg, transform: [{ rotate: `${rotate}deg` }] }]}>
          <View style={[styles.inner, { borderColor: color, paddingVertical: placement === 'bottom' ? 1 : 3, paddingHorizontal: size >= 32 ? 14 : 12 }]}>
            <Txt display size={size} lh={1.1} color={color} numberOfLines={1} accessibilityRole="header">
              {text}
            </Txt>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 8, alignItems: 'center' },
  // Centre at 42% of the height, as in the mockups: top 0 to bottom 16%, centred.
  center: { position: 'absolute', left: 0, right: 0, top: 0, bottom: '16%', alignItems: 'center', justifyContent: 'center' },
  outer: { borderWidth: 1.5, borderRadius: 8, padding: 1 },
  inner: { borderWidth: 1.5, borderRadius: 6 },
});
