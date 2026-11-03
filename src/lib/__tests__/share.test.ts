import { challengeMessage } from '@/copy/strings';
import { ALL_WORDS } from '@/data/words';

import { challengeUrl } from '../share';

const letters = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

describe('challenge links never contain the answer', () => {
  it.each(ALL_WORDS.map((w) => [w.id, w] as const))('%s', (_id, w) => {
    const url = challengeUrl(w.id, 'Ravi');
    const parsed = new URL(url);

    expect(parsed.pathname).toBe('/c/' + encodeURIComponent(w.id));
    expect([...parsed.searchParams.keys()]).toEqual(['from']);
    expect(parsed.searchParams.get('from')).toBe('Ravi');

    const answer = letters(w.answer);
    expect(letters(parsed.pathname + parsed.search)).not.toContain(answer);

    // The share text, minus the origin (config, not word data).
    const message = challengeMessage(w.category, url).replace(parsed.origin, '');
    expect(letters(message)).not.toContain(answer);
  });
});

describe('challengeUrl', () => {
  it('has no from parameter without a name', () => {
    expect(challengeUrl('abc')).not.toContain('?');
    expect(challengeUrl('abc', '')).not.toContain('?');
  });

  it('encodes names with spaces and ampersands', () => {
    const parsed = new URL(challengeUrl('abc', 'Ravi & Co'));
    expect(parsed.search).toBe('?from=Ravi%20%26%20Co');
    expect(parsed.searchParams.get('from')).toBe('Ravi & Co');
  });
});
