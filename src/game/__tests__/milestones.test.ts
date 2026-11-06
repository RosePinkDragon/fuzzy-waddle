import { CLUB_LADDER, TEST_CLUB_LADDER } from '../config';
import { Ladder, clubLong, clubShort, progressLabel } from '../milestones';

describe('milestone ladder', () => {
  const ladder = new Ladder(CLUB_LADDER);

  it('matches the configured clubs', () => {
    expect([0, 1, 2, 3, 4].map((i) => ladder.clubAt(i))).toEqual([
      { index: 0, crore: 50, hits: 10 },
      { index: 1, crore: 100, hits: 20 },
      { index: 2, crore: 200, hits: 35 },
      { index: 3, crore: 500, hits: 55 },
      { index: 4, crore: 1000, hits: 80 },
    ]);
  });

  it('keeps going after 1000 Cr with growing gaps', () => {
    const next = [5, 6, 7, 8].map((i) => ladder.clubAt(i));
    expect(next.map((c) => c.crore)).toEqual([1500, 2000, 3000, 4000]);
    expect(next.map((c) => c.hits)).toEqual([110, 145, 185, 230]);
    // Strictly increasing for a long way.
    for (let i = 1; i < 40; i += 1) {
      expect(ladder.clubAt(i).hits).toBeGreaterThan(ladder.clubAt(i - 1).hits);
      expect(ladder.clubAt(i).crore).toBeGreaterThan(ladder.clubAt(i - 1).crore);
    }
  });

  it('knows the club reached and the next one', () => {
    expect(ladder.reached(0)).toBeNull();
    expect(ladder.reached(9)).toBeNull();
    expect(ladder.reached(10)?.crore).toBe(50);
    expect(ladder.reached(34)?.crore).toBe(100);
    expect(ladder.next(18).crore).toBe(100);
    expect(ladder.next(20).crore).toBe(200);
  });

  it('marks the word that reaches a club as a boss round', () => {
    expect(ladder.isBossWord(9)).toBe(true);
    expect(ladder.isBossWord(10)).toBe(false);
    expect(ladder.isBossWord(19)).toBe(true);
    expect(ladder.isBossWord(79)).toBe(true);
    expect(ladder.isBossWord(109)).toBe(true);
    expect(ladder.isBossWord(18)).toBe(false);
  });

  it('reports progress the way the design shows it', () => {
    // Main mockup: 18 hits, 8 of 10 segments, 2 more to 100 Cr Club.
    expect(ladder.progress(18)).toMatchObject({ segments: 10, filled: 8, remaining: 2 });
    // Safar mockup: 24 hits, 4 of 15 segments, 11 more to 200 Cr Club.
    expect(ladder.progress(24)).toMatchObject({ segments: 15, filled: 4, remaining: 11 });
    // Right after a club the bar is empty.
    expect(ladder.progress(20)).toMatchObject({ segments: 15, filled: 0, remaining: 15 });
  });

  it('draws big gaps proportionally so the bar stays readable', () => {
    const p = ladder.progress(55 + 12); // 12 of 25 towards 1000 Cr
    expect(p.segments).toBe(20);
    expect(p.filled).toBe(9);
    expect(p.remaining).toBe(13);
  });

  it('formats club names', () => {
    expect(clubShort(ladder.clubAt(1))).toBe('100 Cr Club');
    expect(clubLong(ladder.clubAt(1))).toBe('100 Crore Club');
  });
});

describe('progress label', () => {
  const play = (isBoss: boolean) => ({ isBoss });

  // The production ladder and the test ladder (EXPO_PUBLIC_TEST_LADDER=1).
  const cases = [
    { name: 'production', ladder: new Ladder(CLUB_LADDER), bossHits: 9, club: 50, normalHits: 3, remaining: 7 },
    { name: 'test', ladder: new Ladder(TEST_CLUB_LADDER), bossHits: 1, club: 50, normalHits: 0, remaining: 2 },
  ];

  describe.each(cases)('$name ladder', ({ ladder: l, bossHits, club, normalHits, remaining }) => {
    it('a normal word counts down to the next club', () => {
      expect(progressLabel({ hits: normalHits, status: 'playing', current: play(false) }, l)).toEqual({
        kind: 'countdown',
        remaining,
        club: expect.objectContaining({ crore: club }),
      });
    });

    it('the boss word names the club it enters, from the ladder', () => {
      expect(l.isBossWord(bossHits)).toBe(true);
      expect(progressLabel({ hits: bossHits, status: 'playing', current: play(true) }, l)).toEqual({
        kind: 'boss',
        club: expect.objectContaining({ crore: club }),
      });
    });

    it('the word solved just before the boss is not the boss', () => {
      // hits already includes it, so one hit remains, but the word in play was a normal one.
      expect(progressLabel({ hits: bossHits, status: 'solved', current: play(false) }, l)).toMatchObject({
        kind: 'countdown',
        remaining: 1,
      });
    });

    it('a cleared boss counts down to the club after the one just entered', () => {
      const entered = l.clubAt(0);
      const label = progressLabel({ hits: entered.hits, status: 'milestone', current: play(true) }, l);
      expect(label).toMatchObject({ kind: 'countdown', club: { index: 1 } });
    });

    it('a boss lost on the last life is run over, not a boss label', () => {
      expect(progressLabel({ hits: bossHits, status: 'over', current: play(true) }, l)).toMatchObject({
        kind: 'countdown',
        remaining: 1,
        club: { crore: club },
      });
    });
  });

  it('follows a custom ladder rather than fixed hit counts', () => {
    const custom = new Ladder([{ crore: 10, hits: 5 }, { crore: 20, hits: 9 }]);
    expect(progressLabel({ hits: 4, status: 'playing', current: play(true) }, custom)).toMatchObject({
      kind: 'boss',
      club: { crore: 10 },
    });
    expect(progressLabel({ hits: 8, status: 'playing', current: play(true) }, custom)).toMatchObject({
      kind: 'boss',
      club: { crore: 20 },
    });
  });
});
