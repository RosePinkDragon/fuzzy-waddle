import AsyncStorage from '@react-native-async-storage/async-storage';

import { keys, load, save } from '../storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

beforeEach(async () => {
  jest.restoreAllMocks();
  await AsyncStorage.clear();
});

describe('storage wrapper', () => {
  it('round-trips a value under the versioned prefix', async () => {
    await save('thing', { a: 1 });
    expect(await AsyncStorage.getItem('hangman:v1:thing')).toBe('{"a":1}');
    expect(await load('thing', null)).toEqual({ a: 1 });
  });

  it('returns the fallback for a missing key', async () => {
    expect(await load('missing', 'fallback')).toBe('fallback');
  });

  it('returns the fallback for corrupt JSON', async () => {
    await AsyncStorage.setItem('hangman:v1:bad', '{not json');
    expect(await load('bad', 42)).toBe(42);
  });

  it('returns the fallback when reading fails', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('boom'));
    expect(await load('x', 'fb')).toBe('fb');
  });

  it('does not throw when writing fails', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('full'));
    await expect(save('x', 1)).resolves.toBeUndefined();
  });

  it('keeps the key format stable (it is a persistence contract)', () => {
    expect(keys.bag('filmy', 'easy')).toBe('bag:filmy:easy');
    expect(keys.best('masala', 'hard')).toBe('best:masala:hard');
    expect(keys.playerName).toBe('playerName');
  });
});
