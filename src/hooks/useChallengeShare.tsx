import { useEffect, useState } from 'react';

import { NamePrompt } from '@/components/NamePrompt';
import { ThemeProvider } from '@/components/ThemeContext';
import { keys, load, save } from '@/lib/storage';
import { shareText } from '@/lib/share';
import type { Theme } from '@/themes/types';

type Build = (name: string) => string;

/**
 * Sharing a challenge needs the player's name for the link. The first time,
 * ask for it; after that, share straight away.
 *
 * The prompt is a Modal that screens render as a sibling of their themed
 * `Screen`, so it can't rely on inheriting the theme. It takes the theme
 * explicitly and provides it to the prompt itself.
 */
export function useChallengeShare(theme: Theme) {
  const [name, setName] = useState('');
  const [pending, setPending] = useState<{ build: Build } | null>(null);

  useEffect(() => {
    let alive = true;
    load(keys.playerName, '').then((n) => alive && setName(n));
    return () => {
      alive = false;
    };
  }, []);

  const share = (build: Build) => {
    if (name) void shareText(build(name));
    else setPending({ build });
  };

  const prompt = (
    <ThemeProvider value={theme}>
      <NamePrompt
        visible={!!pending}
        initial={name}
        onCancel={() => setPending(null)}
        onSubmit={(n) => {
          setName(n);
          void save(keys.playerName, n);
          const msg = pending?.build(n);
          setPending(null);
          if (msg) void shareText(msg);
        }}
      />
    </ThemeProvider>
  );

  return { share, prompt, name };
}
