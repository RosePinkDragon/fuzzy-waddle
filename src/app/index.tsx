/**
 * Home: category picker. Not designed in the mockups; built in the same visual
 * language and flagged for design review (see README).
 */
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MAX_WIDTH } from '@/components/Screen';
import { Txt } from '@/components/Txt';
import { GAME_NAME, home } from '@/copy/strings';
import { clubShort, ladder } from '@/game/milestones';
import type { ThemeId } from '@/game/types';
import type { BestScore } from '@/game/runSnapshot';
import { bestForTheme } from '@/lib/runController';
import { GlyphImage } from '@/themes/glyphs';
import { THEME_ORDER, THEMES } from '@/themes/themes';

const SHELL = THEMES.filmy.colors;

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [bests, setBests] = useState<Partial<Record<ThemeId, BestScore | null>>>({});

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      Promise.all(THEME_ORDER.map(async (t) => [t, await bestForTheme(t)] as const)).then((rows) => {
        if (alive) setBests(Object.fromEntries(rows));
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  return (
    <View style={[styles.outer, { backgroundColor: SHELL.bg }]} testID="home-screen">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]}
      >
        <View style={styles.title}>
          <Txt display size={34} lh={1.15} color={SHELL.accent} align="center" accessibilityRole="header">
            {GAME_NAME}
          </Txt>
          <Txt size={14} lh={1.35} color={SHELL.muted} align="center">
            {home.tagline}
          </Txt>
        </View>
        <Txt size={11} weight={800} em={0.14} lh={1.3} color={SHELL.accent}>
          {home.pick}
        </Txt>
        <View style={styles.grid}>
          {THEME_ORDER.map((id) => {
            const t = THEMES[id];
            const best = bests[id];
            const club = best ? ladder.reached(best.hits) : null;
            return (
              <Pressable
                key={id}
                testID={`category-${id}`}
                accessibilityRole="button"
                accessibilityLabel={`${t.copy.name}: ${t.copy.blurb}`}
                onPress={() => router.push(`/play/${id}`)}
                style={({ pressed }) => [
                  styles.card,
                  { backgroundColor: t.colors.panel, borderColor: t.colors.border, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <View style={[styles.glyph, { backgroundColor: t.colors.bg, borderColor: t.colors.accent }]}>
                  <GlyphImage id={id} size={40} />
                </View>
                <Txt size={17} weight={800} lh={1.2} color={t.colors.text}>
                  {t.copy.name}
                </Txt>
                <Txt size={12} lh={1.3} color={t.colors.muted} numberOfLines={2}>
                  {t.copy.blurb}
                </Txt>
                <Txt size={11} weight={700} lh={1.3} color={t.colors.accent} style={styles.best}>
                  {best ? home.best(best.hits, club ? clubShort(club) : null) : home.noBest}
                </Txt>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, alignItems: 'center' },
  scroll: { width: '100%', maxWidth: MAX_WIDTH },
  content: { paddingHorizontal: 12, gap: 14 },
  title: { gap: 4, paddingBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: '48.5%',
    flexGrow: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 2,
    minHeight: 148,
  },
  glyph: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  best: { marginTop: 'auto', paddingTop: 4 },
});
