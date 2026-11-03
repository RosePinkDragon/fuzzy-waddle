import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg from 'react-native-svg';

import type { Border } from '@/themes/types';

interface SceneBoxProps {
  /** Height the art is drawn at (200 for game and win, 220 for flop). */
  artHeight: 200 | 220;
  bg: string;
  border?: Border;
  label: string;
  children: ReactNode;
  /** Absolutely positioned things on top of the art (lives sign, stamps). */
  overlay?: ReactNode;
  style?: ViewStyle;
  testID?: string;
}

/**
 * A scene: art drawn at 366 x artHeight, scaled to the box width and cropped
 * from the top when the box is shorter (SVG "xMidYMax slice").
 */
export function SceneBox({ artHeight, bg, border, label, children, overlay, style, testID }: SceneBoxProps) {
  return (
    <View
      testID={testID}
      style={[
        styles.box,
        { backgroundColor: bg, maxHeight: artHeight },
        border && { borderWidth: border.width, borderColor: border.color, borderStyle: border.style ?? 'solid' },
        style,
      ]}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 366 ${artHeight}`}
        preserveAspectRatio="xMidYMax slice"
        accessibilityRole="image"
        accessibilityLabel={label}
      >
        {children}
      </Svg>
      {overlay}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, borderRadius: 14, overflow: 'hidden' },
});
