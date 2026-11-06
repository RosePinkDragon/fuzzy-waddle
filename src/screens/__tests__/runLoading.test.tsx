/**
 * #107: while the saved run loads, the run route used to render nothing, so the stack's Filmy backdrop
 * flashed through. It now renders a placeholder in the route's own theme background.
 */
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import RunRoute from '@/app/play/[theme]/[difficulty]';
import { THEMES } from '@/themes/themes';

let mockParams: { theme: string; difficulty: string } = { theme: 'safar', difficulty: 'easy' };
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
// Stamp animates with Reanimated, which needs native worklets that Jest doesn't have.
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: { View }, ZoomIn: { duration: () => undefined } };
});
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => mockParams,
  Redirect: () => null,
}));
jest.mock('@/hooks/useRun', () => ({
  useRun: () => ({ phase: 'loading', run: null, doc: null }),
}));
jest.mock('@/hooks/useChallengeShare', () => ({
  useChallengeShare: () => ({ share: jest.fn(), prompt: null }),
}));

// The first render on a cold cache loads the whole component graph.
jest.setTimeout(30000);

const bgOf = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style as never)?.backgroundColor;

describe('run route while the saved run loads', () => {
  it.each(['safar', 'khana', 'cricket', 'tyohar', 'masala', 'filmy'] as const)(
    'shows a %s placeholder, not nothing',
    async (theme) => {
      mockParams = { theme, difficulty: 'easy' };
      await render(<RunRoute />);
      const placeholder = screen.getByTestId('run-loading');
      expect(bgOf(placeholder)).toBe(THEMES[theme].colors.bg);
    },
  );

  it('does not use Filmy red for another theme', async () => {
    mockParams = { theme: 'safar', difficulty: 'hard' };
    await render(<RunRoute />);
    expect(bgOf(screen.getByTestId('run-loading'))).not.toBe(THEMES.filmy.colors.bg);
  });
});
