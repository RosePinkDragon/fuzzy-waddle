import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { layoutTiles, type TileLayout } from '@/game/tileLayout';

import { useTheme } from './ThemeContext';
import { Txt } from './Txt';

interface TilesProps {
  answer: string;
  /** Letters to show; 'all' shows every tile (win screen). */
  shown: Set<string> | 'all';
  maxWidth: number;
  /** Largest tile width: 38 on the game screen, 34 on the win screen. */
  maxSize?: number;
  maxLines?: number;
  maxHeight?: number;
  /** Tile height / width (game 48/38, win 42/34). */
  aspect?: number;
  lineGap?: number;
  /** Hide letters (Masala Mix while the reel spins). */
  concealed?: boolean;
}

export function useTileLayout(answer: string, opts: Omit<TilesProps, 'answer' | 'shown'>): TileLayout {
  return layoutTiles(answer, {
    maxWidth: opts.maxWidth,
    maxSize: opts.maxSize,
    maxLines: opts.maxLines,
    maxHeight: opts.maxHeight,
    aspect: opts.aspect,
    lineGap: opts.lineGap,
  });
}

/**
 * Answer tiles. Wrap at word breaks; shrink (to ~26px) when a word will not
 * fit on one line. Non-letters are always shown.
 */
export function Tiles({ answer, shown, maxWidth, maxSize = 38, maxLines = 3, maxHeight, aspect = 48 / 38, lineGap = 8, concealed }: TilesProps) {
  const { colors } = useTheme();
  const layout = useTileLayout(answer, { maxWidth, maxSize, maxLines, maxHeight, aspect, lineGap });
  const radius = Math.max(6, Math.round(layout.size * 0.21));
  return (
    <View style={[styles.col, { gap: lineGap }]} accessibilityLabel={concealed ? undefined : describe(answer, shown)} accessible>
      {layout.lines.map((line, li) => (
        <View key={li} style={[styles.row, { gap: layout.wordGap }]}>
          {line.map((word, wi) => (
            <View key={wi} style={[styles.row, { gap: layout.gap }]}>
              {word.map((t, ti) => {
                const visible = !concealed && (t.auto || shown === 'all' || shown.has(t.ch));
                return visible ? (
                  <Animated.View
                    key={`${ti}-on`}
                    entering={shown === 'all' || t.auto ? undefined : ZoomIn.duration(160)}
                    style={[styles.tile, { width: layout.size, height: layout.height, borderRadius: radius, backgroundColor: colors.text }]}
                  >
                    <Txt display size={layout.fontSize} lh={1.15} color={colors.bg}>
                      {t.ch}
                    </Txt>
                  </Animated.View>
                ) : (
                  <View
                    key={`${ti}-off`}
                    style={[
                      styles.tile,
                      {
                        width: layout.size,
                        height: layout.height,
                        borderRadius: radius,
                        backgroundColor: colors.panel,
                        borderBottomWidth: 3,
                        borderBottomColor: colors.accent,
                      },
                    ]}
                  />
                );
              })}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function describe(answer: string, shown: Set<string> | 'all') {
  if (shown === 'all') return answer;
  return answer
    .split('')
    .map((ch) => (ch === ' ' ? ' / ' : /[A-Z]/.test(ch) && !shown.has(ch) ? 'blank' : ch))
    .join(' ');
}

const styles = StyleSheet.create({
  col: { alignItems: 'center' },
  row: { flexDirection: 'row' },
  tile: { alignItems: 'center', justifyContent: 'center' },
});
