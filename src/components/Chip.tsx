import { View } from 'react-native';

import { THEMES } from '@/themes/themes';
import type { CategoryId } from '@/game/types';

import { useTheme } from './ThemeContext';
import { Txt } from './Txt';

export function Chip({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ backgroundColor: colors.chip.bg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 2 }}>
      <Txt size={12} weight={700} lh={1.35} color={colors.chip.text}>
        {text}
      </Txt>
    </View>
  );
}

/** Masala Mix: a category chip drawn in that category's own colours. */
export function CategoryChip({ category }: { category: CategoryId }) {
  const t = THEMES[category];
  return (
    <View
      style={{
        backgroundColor: t.categoryChip.bg,
        borderColor: t.categoryChip.border,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 1,
      }}
    >
      <Txt size={12} weight={800} lh={1.35} color={t.categoryChip.text}>
        {t.copy.name}
      </Txt>
    </View>
  );
}
