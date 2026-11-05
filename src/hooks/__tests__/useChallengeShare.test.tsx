import { StyleSheet, Pressable } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '@/components/ThemeContext';
import { namePrompt } from '@/copy/strings';
import type { ThemeId } from '@/game/types';
import { shareText } from '@/lib/share';
import { save } from '@/lib/storage';
import { THEMES } from '@/themes/themes';

import { useChallengeShare } from '../useChallengeShare';

jest.mock('@/lib/storage', () => ({
  keys: { playerName: 'playerName' },
  load: jest.fn(() => Promise.resolve('')),
  save: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/lib/share', () => ({ shareText: jest.fn(() => Promise.resolve('shared')) }));

// The first render on a cold cache loads the whole component graph.
jest.setTimeout(30000);

const THEME_IDS: ThemeId[] = ['filmy', 'khana', 'safar', 'cricket', 'tyohar', 'masala'];

/** Mounts the hook the way the run route does: a share button, with the prompt beside it. */
function Harness({ themeId, build }: { themeId: ThemeId; build: (name: string) => string }) {
  const { share, prompt } = useChallengeShare(THEMES[themeId]);
  return (
    <>
      <Pressable testID="open" onPress={() => share(build)} />
      {prompt}
    </>
  );
}

const defaultBuild = (n: string) => `msg:${n}`;

/** Renders the harness (optionally inside another theme) and opens the prompt. */
async function openPrompt(themeId: ThemeId, opts: { around?: ThemeId; build?: (name: string) => string } = {}) {
  const harness = <Harness themeId={themeId} build={opts.build ?? defaultBuild} />;
  await render(opts.around ? <ThemeProvider value={THEMES[opts.around]}>{harness}</ThemeProvider> : harness);
  await fireEvent.press(screen.getByTestId('open'));
  expect(screen.getByTestId('name-prompt')).toBeTruthy();
}

const input = () => screen.getByPlaceholderText(namePrompt.placeholder);
const shareButton = () => screen.getByRole('button', { name: namePrompt.share });
const flat = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style as never) ?? {};

beforeEach(() => jest.clearAllMocks());

describe.each(THEME_IDS)('name prompt in %s', (id) => {
  const { colors } = THEMES[id];

  const expectThemed = () => {
    expect(flat(screen.getByTestId('name-prompt'))).toMatchObject({ backgroundColor: colors.panel, borderColor: colors.border });
    expect(flat(input())).toMatchObject({ backgroundColor: colors.text, color: colors.bg });
    expect(input().props.placeholderTextColor).toBe(colors.card.foot);
    expect(flat(shareButton())).toMatchObject({ backgroundColor: colors.primary.bg });
  };

  it('uses the active theme with no ThemeProvider above it', async () => {
    await openPrompt(id);
    expectThemed();
  });

  it('ignores a different theme around it', async () => {
    await openPrompt(id, { around: id === 'filmy' ? 'khana' : 'filmy' });
    expectThemed();
  });
});

describe('submit and cancel', () => {
  it('submitting a trimmed name saves it and shares exactly the built message', async () => {
    const build = jest.fn((n: string) => `challenge from ${n}`);
    await openPrompt('khana', { build });

    await fireEvent.changeText(input(), '  Ravi  ');
    await fireEvent.press(shareButton());

    expect(save).toHaveBeenCalledWith('playerName', 'Ravi');
    expect(build).toHaveBeenCalledTimes(1);
    expect(build).toHaveBeenCalledWith('Ravi');
    expect(shareText).toHaveBeenCalledTimes(1);
    expect(shareText).toHaveBeenCalledWith('challenge from Ravi');
    expect(screen.queryByTestId('name-prompt')).toBeNull();
  });

  it('cancelling never shares or saves', async () => {
    await openPrompt('safar');

    await fireEvent.press(screen.getByRole('button', { name: namePrompt.cancel }));

    expect(shareText).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(screen.queryByTestId('name-prompt')).toBeNull();
  });

  it('a blank name cannot be submitted', async () => {
    await openPrompt('cricket');

    await fireEvent.changeText(input(), '   ');
    await fireEvent.press(shareButton());

    expect(shareText).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByTestId('name-prompt')).toBeTruthy();
  });
});
