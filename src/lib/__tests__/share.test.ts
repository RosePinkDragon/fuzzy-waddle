import { Platform, Share } from 'react-native';

import { challengeMessage } from '@/copy/strings';
import { ALL_WORDS } from '@/data/words';

import { challengeUrl, shareText } from '../share';

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

describe('shareText', () => {
  const g = globalThis as Record<string, unknown>;
  const original = { os: Platform.OS as string, navigator: g.navigator, window: g.window };
  let open: jest.Mock;
  let warn: jest.SpyInstance;

  const setWeb = (share?: unknown) => {
    (Platform as { OS: string }).OS = 'web';
    g.navigator = share === undefined ? {} : { share };
    open = jest.fn(() => ({ opener: 'self' }));
    g.window = { open, location: { origin: 'https://play.test' } };
  };
  const abort = () => Object.assign(new Error('cancelled'), { name: 'AbortError' });

  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    (Platform as { OS: string }).OS = original.os;
    g.navigator = original.navigator;
    g.window = original.window;
    warn.mockRestore();
    jest.restoreAllMocks();
  });

  it('web: shares through the Web Share API without opening a tab', async () => {
    const share = jest.fn().mockResolvedValue(undefined);
    setWeb(share);
    await expect(shareText('hi https://x/c/a')).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({ text: 'hi https://x/c/a' });
    expect(open).not.toHaveBeenCalled();
  });

  it('web: a cancelled share (AbortError) stops quietly, with no tab and no error', async () => {
    setWeb(jest.fn().mockRejectedValue(abort()));
    await expect(shareText('hi')).resolves.toBe('cancelled');
    expect(open).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('web: a genuine failure is logged and does not redirect to WhatsApp', async () => {
    setWeb(jest.fn().mockRejectedValue(new Error('NotAllowedError')));
    await expect(shareText('hi')).resolves.toBe('failed');
    expect(open).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('web without Web Share: opens a working WhatsApp link with the encoded message', async () => {
    setWeb();
    const message = 'Ek film word & more? https://play.test/c/f1?from=Ravi%20K';
    await expect(shareText(message)).resolves.toBe('fallback');
    expect(open).toHaveBeenCalledTimes(1);
    const [url, target] = open.mock.calls[0];
    expect(target).toBe('_blank');
    expect(open.mock.results[0].value.opener).toBeNull();
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://wa.me/');
    expect(parsed.searchParams.get('text')).toBe(message);
  });

  it('web without Web Share: a blocked popup (window.open returns null) is reported as failed', async () => {
    setWeb();
    open.mockReturnValue(null);
    await expect(shareText('hi')).resolves.toBe('failed');
  });

  it('web: a DOMException AbortError is treated as a cancel', async () => {
    if (typeof DOMException === 'undefined') return;
    setWeb(jest.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError')));
    await expect(shareText('hi')).resolves.toBe('cancelled');
    expect(open).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('native: opens the React Native share sheet and never a tab', async () => {
    (Platform as { OS: string }).OS = 'ios';
    g.window = { open: jest.fn() };
    const sheet = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
    await expect(shareText('hi')).resolves.toBe('shared');
    expect(sheet).toHaveBeenCalledWith({ message: 'hi' });
    expect((g.window as { open: jest.Mock }).open).not.toHaveBeenCalled();
  });

  it('native: dismissing the sheet is reported as cancelled', async () => {
    (Platform as { OS: string }).OS = 'ios';
    jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.dismissedAction } as never);
    await expect(shareText('hi')).resolves.toBe('cancelled');
  });

  it('native: a sheet error is contained and reported as failed', async () => {
    (Platform as { OS: string }).OS = 'android';
    jest.spyOn(Share, 'share').mockRejectedValue(new Error('boom'));
    await expect(shareText('hi')).resolves.toBe('failed');
  });
});
