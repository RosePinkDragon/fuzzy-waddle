/**
 * Difficulty picker. Not designed in the mockups; built in the same visual
 * language and flagged for design review (see README).
 */
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Header } from '@/components/Header';
import { LivesSign } from '@/components/LivesSign';
import { SceneBox } from '@/components/SceneBox';
import { Screen } from '@/components/Screen';
import { Txt } from '@/components/Txt';
import { DIFFICULTY_LABEL, difficultyPicker, home } from '@/copy/strings';
import { DIFFICULTY_ORDER } from '@/game/config';
import { lifeMarks, rulesFor } from '@/game/difficulty';
import { clubShort, ladder } from '@/game/milestones';
import type { Difficulty } from '@/game/types';
import { keys, load, type Best } from '@/lib/storage';
import { Icon } from '@/themes/icons';
import { isThemeId, themeFor } from '@/themes/themes';

export default function DifficultyPicker() {
  const { theme: themeParam } = useLocalSearchParams<{ theme: string }>();
  const router = useRouter();
  const [bests, setBests] = useState<Partial<Record<Difficulty, Best | null>>>({});
  const valid = isThemeId(themeParam);

  useFocusEffect(
    useCallback(() => {
      if (!isThemeId(themeParam)) return;
      let alive = true;
      Promise.all(DIFFICULTY_ORDER.map(async (d) => [d, await load<Best | null>(keys.best(themeParam, d), null)] as const)).then(
        (rows) => alive && setBests(Object.fromEntries(rows)),
      );
      return () => {
        alive = false;
      };
    }, [themeParam]),
  );

  if (!valid) return <Redirect href="/" />;
  const theme = themeFor(themeParam);
  const { colors, copy } = theme;
  const Scene = theme.scenes.Game;

  return (
    <Screen theme={theme} testID="difficulty-screen">
      <Header label={copy.label} title={difficultyPicker.title} onBack={() => router.replace('/')} />
      <SceneBox artHeight={200} bg={theme.scene.game.bg} border={theme.scene.game.border} label={theme.scenes.labels.game} style={styles.scene}>
        <Scene marks={lifeMarks('easy', 0)} category={theme.mixed ? 'safar' : null} spinKey={null} instantReel />
      </SceneBox>
      <Txt size={11} weight={800} em={0.14} lh={1.3} color={colors.accent}>
        {difficultyPicker.subtitle.toUpperCase()}
      </Txt>
      <View style={styles.options}>
        {DIFFICULTY_ORDER.map((d) => {
          const best = bests[d];
          const club = best ? ladder.reached(best.hits) : null;
          return (
            <Pressable
              key={d}
              testID={`difficulty-${d}`}
              accessibilityRole="button"
              accessibilityLabel={`${DIFFICULTY_LABEL[d]}: ${difficultyPicker.detail[d]}`}
              onPress={() => router.push(`/play/${theme.id}/${d}`)}
              style={({ pressed }) => [styles.option, { backgroundColor: colors.panel, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
            >
              <View style={styles.optionTop}>
                <View style={styles.flex}>
                  <Txt display size={22} lh={1.2} color={colors.text}>
                    {DIFFICULTY_LABEL[d]}
                  </Txt>
                  <Txt size={13} lh={1.3} color={colors.muted}>
                    {difficultyPicker.detail[d]}
                  </Txt>
                </View>
                <View style={styles.right}>
                  <Txt size={11} weight={700} lh={1.3} color={colors.accent} align="right">
                    {best ? home.best(best.hits, club ? clubShort(club) : null) : home.noBest}
                  </Txt>
                  <View style={[styles.go, { backgroundColor: colors.accent }]}>
                    <View style={styles.flip}>
                      <Icon name="back" size={18} color={colors.onAccent} strokeWidth={2.6} />
                    </View>
                  </View>
                </View>
              </View>
              <View style={styles.sign}>
                <LivesSign marks={lifeMarks(d, 0)} left={rulesFor(d).lives} boxed={false} />
              </View>
            </Pressable>
          );
        })}
      </View>
      <Txt size={12} lh={1.35} color={colors.muted} align="center" style={styles.foot}>
        {difficultyPicker.footnote}
      </Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scene: { minHeight: 90, maxHeight: 170 },
  options: { gap: 10 },
  option: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, gap: 6 },
  optionTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  right: { alignItems: 'flex-end', gap: 6 },
  go: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  flip: { transform: [{ scaleX: -1 }] },
  sign: { alignItems: 'flex-start' },
  foot: { marginTop: 'auto' },
});
