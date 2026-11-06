import type { ExpoConfig } from 'expo/config';

import game from './src/config/game.json';
// The Expo config loader only resolves a TS file when the extension is explicit.
// @ts-expect-error TS5097: tsconfig does not allow .ts import paths (noEmit, so they are safe).
import { assertReleaseEnv } from './src/lib/releaseGuard.ts';

// Fail release builds (RELEASE_BUILD=1, EAS preview/production) that set test-only switches.
assertReleaseEnv(process.env);

/**
 * App config. The name and bundle IDs are placeholders until the open
 * decisions are made. The web origin is the real production address
 * (https://hangman-desi.vercel.app). They all live in src/config/game.json.
 */
const config: ExpoConfig = {
  name: game.name,
  slug: game.slug,
  scheme: game.scheme,
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'dark',
  backgroundColor: '#2A0710',
  ios: {
    bundleIdentifier: game.iosBundleId,
    supportsTablet: false,
    icon: './assets/expo.icon',
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: game.androidPackage,
    adaptiveIcon: {
      backgroundColor: '#2A0710',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    // A single-page app: every path (including /c/<wordId>) serves index.html.
    output: 'single',
    favicon: './assets/images/favicon.png',
    name: game.name,
    themeColor: '#2A0710',
    backgroundColor: '#2A0710',
  },
  plugins: [
    'expo-router',
    'expo-font',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#2A0710',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
  ],
  experiments: {
    typedRoutes: false,
    reactCompiler: true,
  },
};

export default config;
