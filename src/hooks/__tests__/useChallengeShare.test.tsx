import { useEffect } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { ThemeProvider } from '@/components/ThemeContext';
import { namePrompt } from '@/copy/strings';
import { save } from '@/lib/storage';
import { shareText } from '@/lib/share';
import { THEMES } from '@/themes/themes';
import type { ThemeId } from '@/game/types';

import { useChallengeShare } from '../useChallengeShare';

jest.mock('@/lib/storage', () => ({
  keys: { playerName: 'playerName' },
  load: jest.fn(() => Promise.resolve('')),
  save: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/lib/share', () => ({ shareText: jest.fn(() => Promise.resolve('shared')) }));

// The first render of a cold cache loads the whole component graph.
jest.setTimeout(30000);

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Share = ReturnType<typeof useChallengeShare>['share'];
const handle: { share?: Share } = {};

/** Mounts the hook the way the run route does: prompt beside the screen, no theme above it. */
function Harness({ themeId }: { themeId: ThemeId }) {
  const hook = useChallengeShare(THEMES[themeId]);
  useEffect(() => {
    handle.share = hook.share;
  });
  return hook.prompt;
}

async function mount(themeId: ThemeId, wrap?: ThemeId): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    const harness = <Harness themeId={themeId} />;
    tree = create(wrap ? <ThemeProvider value={THEMES[wrap]}>{harness}</ThemeProvider> : harness);
  });
  return tree;
}

const style = (n: ReactTestInstance) => StyleSheet.flatten(n.props.style) ?? {};
const buttons = (t: ReactTestRenderer) => t.root.findAll((n) => n.props.accessibilityRole === 'button' && typeof n.type === 'function' && n.props.onPress);
const find = (t: ReactTestRenderer, pred: (s: ReturnType<typeof style>) => boolean) =>
  t.root.findAll((n) => typeof n.type === 'string' && pred(style(n)));

async function openPrompt(tree: ReactTestRenderer, build = (n: string) => `msg:${n}`) {
  await act(async () => handle.share?.(build));
  expect(tree.root.findAllByType(TextInput)).toHaveLength(1);
}

beforeEach(() => jest.clearAllMocks());

describe.each<ThemeId>(['filmy', 'khana', 'safar', 'cricket', 'tyohar', 'masala'])('name prompt in %s', (id) => {
  const { colors } = THEMES[id];

  it('uses the active theme with no ThemeProvider above it', async () => {
    const tree = await mount(id);
    await openPrompt(tree);

    expect(find(tree, (s) => s.backgroundColor === colors.panel && s.borderColor === colors.border)).toHaveLength(1);
    const input = style(tree.root.findByType(TextInput));
    expect(input.backgroundColor).toBe(colors.text);
    expect(input.color).toBe(colors.bg);
    expect(tree.root.findByType(TextInput).props.placeholderTextColor).toBe(colors.muted);
    expect(find(tree, (s) => s.backgroundColor === colors.primary.bg)).not.toHaveLength(0);
  });

  it('ignores a different theme around it', async () => {
    const other: ThemeId = id === 'filmy' ? 'khana' : 'filmy';
    const tree = await mount(id, other);
    await openPrompt(tree);

    expect(find(tree, (s) => s.backgroundColor === colors.panel && s.borderColor === colors.border)).toHaveLength(1);
  });
});

describe('submit and cancel', () => {
  it('submitting a trimmed name saves it and shares exactly the built message', async () => {
    const tree = await mount('khana');
    const build = jest.fn((n: string) => `challenge from ${n}`);
    await openPrompt(tree, build);

    await act(async () => tree.root.findByType(TextInput).props.onChangeText('  Ravi  '));
    const [, submit] = buttons(tree);
    await act(async () => submit.props.onPress());

    expect(save).toHaveBeenCalledWith('playerName', 'Ravi');
    expect(build).toHaveBeenCalledTimes(1);
    expect(build).toHaveBeenCalledWith('Ravi');
    expect(shareText).toHaveBeenCalledTimes(1);
    expect(shareText).toHaveBeenCalledWith('challenge from Ravi');
    expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
  });

  it('cancelling never shares or saves', async () => {
    const tree = await mount('safar');
    await openPrompt(tree);

    const [cancel] = buttons(tree);
    expect(cancel.findAll((n) => n.children.includes(namePrompt.cancel)).length).toBeGreaterThan(0);
    await act(async () => cancel.props.onPress());

    expect(shareText).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
  });

  it('a blank name cannot be submitted', async () => {
    const tree = await mount('cricket');
    await openPrompt(tree);

    await act(async () => tree.root.findByType(TextInput).props.onChangeText('   '));
    const [, submit] = buttons(tree);
    await act(async () => submit.props.onPress());

    expect(shareText).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });
});
