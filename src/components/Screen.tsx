import type { ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Theme } from '@/themes/types';

import { ThemeProvider } from './ThemeContext';

/** Widest the layout gets (web on desktop shows a phone-width column). */
export const MAX_WIDTH = 430;

/** Below this height the layout tightens its gaps so everything still fits. */
export const COMPACT_HEIGHT = 780;

export function useScreenSize() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const w = Math.min(width, MAX_WIDTH);
  const h = height - insets.top - insets.bottom;
  return { width: w, height: h, contentWidth: w - 24, compact: h < COMPACT_HEIGHT };
}

interface ScreenProps {
  theme: Theme;
  children: ReactNode;
  /** Gap between blocks (mockups: 12 on game and flop, 8 on win). */
  gap?: number;
  /** Fixed-height screens never scroll; others may pass false and scroll themselves. */
  fixed?: boolean;
  testID?: string;
}

/**
 * Full-height themed column: safe areas, 14/12/20 padding as in the mockups,
 * and a phone-width cap on wide screens.
 */
export function Screen({ theme, children, gap = 12, fixed = true, testID }: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <ThemeProvider value={theme}>
      <View style={[styles.outer, { backgroundColor: theme.colors.bg }]} testID={testID}>
        <View
          style={[
            styles.column,
            {
              paddingTop: insets.top + 14,
              paddingBottom: insets.bottom + 20,
              gap,
              overflow: fixed ? 'hidden' : 'visible',
            },
          ]}
        >
          {children}
        </View>
      </View>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, alignItems: 'center' },
  column: { flex: 1, width: '100%', maxWidth: MAX_WIDTH, paddingHorizontal: 12 },
});
