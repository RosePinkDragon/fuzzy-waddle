import { StyleSheet, View } from 'react-native';

import { GAME_NAME, ui } from '@/copy/strings';

import { useTheme } from './ThemeContext';
import { Txt } from './Txt';

/** Ticket-style share card on the milestone screen. */
export function ShareCard({ line, footer }: { line: string; footer: string }) {
  const { colors, copy } = useTheme();
  const c = colors.card;
  return (
    <View style={[styles.card, { backgroundColor: c.bg }]}>
      <View style={[styles.notch, styles.left, { backgroundColor: colors.bg }]} />
      <View style={[styles.notch, styles.right, { backgroundColor: colors.bg }]} />
      <Txt size={11} weight={800} em={0.14} lh={1.3} color={c.label}>
        {ui.shareCard(copy.cardLabel)}
      </Txt>
      <Txt display size={18} lh={1.25} color={c.text}>
        {line}
      </Txt>
      <View style={[styles.foot, { borderTopColor: c.dash }]}>
        <Txt size={12} weight={600} lh={1.3} color={c.foot}>
          {`${GAME_NAME} · ${footer}`}
        </Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 20, gap: 4, overflow: 'visible' },
  notch: { position: 'absolute', top: '50%', marginTop: -9, width: 18, height: 18, borderRadius: 9 },
  left: { left: -9 },
  right: { right: -9 },
  foot: { borderTopWidth: 2, borderStyle: 'dashed', paddingTop: 5 },
});
