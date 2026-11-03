import { StyleSheet, View, type ViewStyle } from 'react-native';

import { ui } from '@/copy/strings';
import type { LifeMark } from '@/game/difficulty';
import type { LivesStyle, MarkStyle } from '@/themes/types';

import { useTheme } from './ThemeContext';
import { Txt } from './Txt';

interface LivesSignProps {
  marks: LifeMark[];
  left: number;
  /** Boxed sign (in or above the scene) or bare row (flop screen). */
  boxed?: boolean;
}

function Letter({ ch, mark, style }: { ch: string; mark: LifeMark; style: Extract<LivesStyle, { kind: 'letters' }> }) {
  const color = mark === 'live' ? style.live : mark === 'used' ? style.used : style.locked;
  return (
    <View>
      <Txt display size={style.fontSize} lh={1.4} color={color}>
        {ch}
      </Txt>
      {mark === 'used' && <View style={[styles.strike, { backgroundColor: style.strike }]} />}
    </View>
  );
}

function markStyle(s: MarkStyle): ViewStyle {
  return {
    backgroundColor: s.fill ?? 'transparent',
    borderWidth: s.border ? (s.borderWidth ?? 1) : 0,
    borderColor: s.border,
    borderStyle: s.dashed ? 'dashed' : 'solid',
    transform: s.rotate ? [{ rotate: `${s.rotate}deg` }] : undefined,
  };
}

/**
 * The lives sign: always nine marks (pre-locked ones faint) and "X LEFT".
 * Its look comes from the theme's `lives` config.
 */
export function LivesSign({ marks, left, boxed = true }: LivesSignProps) {
  const theme = useTheme();
  const { colors, lives, copy } = theme;
  const a11y = `${ui.livesLeft(left)}${marks.some((m) => m === 'locked') ? `, ${marks.filter((m) => m === 'locked').length} locked` : ''}`;

  let body: React.ReactNode;
  if (lives.kind === 'letters') {
    // Index of each group's first mark, e.g. DESI starts at 0 and MASTI at 4.
    const starts = lives.groups.map((_, gi) => lives.groups.slice(0, gi).join('').length);
    body = (
      <View style={[styles.row, { gap: lives.groups.length > 1 ? 8 : 4 }]}>
        {lives.groups.map((g, gi) => (
          <View key={g} style={[styles.row, { gap: lives.groups.length > 1 ? 2 : 4 }]}>
            {g.split('').map((ch, ci) => (
              <Letter key={ci} ch={ch} mark={marks[starts[gi] + ci] ?? 'live'} style={lives} />
            ))}
          </View>
        ))}
      </View>
    );
  } else {
    body = (
      <View style={[styles.row, { gap: lives.gap }]}>
        {copy.livesLabel && (
          <Txt size={11} weight={800} em={0.08} color={colors.accent} lh={1.2} style={{ marginRight: 4 - lives.gap / 2 }}>
            {copy.livesLabel}
          </Txt>
        )}
        {marks.map((m, i) => (
          <View
            key={i}
            style={[
              { width: lives.width, height: lives.height, borderRadius: lives.radius },
              markStyle(m === 'live' ? lives.live : m === 'used' ? lives.used : lives.locked),
            ]}
          />
        ))}
      </View>
    );
  }

  return (
    <View
      accessible
      accessibilityLabel={a11y}
      style={[
        styles.row,
        boxed && styles.box,
        boxed && {
          backgroundColor: colors.bg,
          borderColor: colors.accent,
          paddingVertical: lives.kind === 'letters' ? 2 : 5,
        },
      ]}
    >
      {body}
      <Txt size={11} weight={800} em={0.06} color={colors.text} lh={1.2} style={{ marginLeft: lives.kind === 'letters' && lives.groups.length > 1 ? 8 : 6 }}>
        {ui.livesLeft(left)}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  box: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 10, alignSelf: 'center' },
  strike: { position: 'absolute', left: -1, right: -1, top: '52%', height: 2, borderRadius: 1 },
});
