import { backdropForPath, themeIdForPath, THEMES } from '../themes';

describe('themeIdForPath', () => {
  it('reads the theme from picker and run paths', () => {
    expect(themeIdForPath('/play/safar')).toBe('safar');
    expect(themeIdForPath('/play/safar/')).toBe('safar');
    expect(themeIdForPath('/play/cricket/hard')).toBe('cricket');
  });

  it('is null for home, challenge links, unknown routes and unknown themes', () => {
    expect(themeIdForPath('/')).toBeNull();
    expect(themeIdForPath('/c/abc123')).toBeNull();
    expect(themeIdForPath('/nope')).toBeNull();
    expect(themeIdForPath('/play')).toBeNull();
    expect(themeIdForPath('/play/unknown/easy')).toBeNull();
    expect(themeIdForPath('/playground/safar')).toBeNull();
    expect(themeIdForPath('/play/constructor')).toBeNull();
    expect(themeIdForPath(undefined)).toBeNull();
  });
});

describe('backdropForPath', () => {
  it('is the theme background on a theme path', () => {
    expect(backdropForPath('/play/safar/easy')).toBe(THEMES.safar.colors.bg);
  });

  it('stays Filmy everywhere else', () => {
    for (const path of ['/', '/c/abc', '/nope', '/play/unknown', '/play/filmy', undefined]) {
      expect(backdropForPath(path)).toBe(THEMES.filmy.colors.bg);
    }
  });
});
