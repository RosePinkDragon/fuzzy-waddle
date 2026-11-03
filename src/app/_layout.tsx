import { Mukta_400Regular, Mukta_600SemiBold, Mukta_700Bold, Mukta_800ExtraBold } from '@expo-google-fonts/mukta';
import { YatraOne_400Regular } from '@expo-google-fonts/yatra-one';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FONTS } from '@/components/Txt';
import { THEMES } from '@/themes/themes';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [loaded, error] = useFonts({
    [FONTS[400]]: Mukta_400Regular,
    [FONTS[600]]: Mukta_600SemiBold,
    [FONTS[700]]: Mukta_700Bold,
    [FONTS[800]]: Mukta_800ExtraBold,
    [FONTS.display]: YatraOne_400Regular,
  });
  const ready = loaded || !!error;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: THEMES.filmy.colors.bg }} />;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: THEMES.filmy.colors.bg } }} />
    </SafeAreaProvider>
  );
}
