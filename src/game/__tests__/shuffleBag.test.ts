import { seededRng } from '../rng';
import { bossScore, drawBoss, drawNext, emptyBag, refill, type BagState } from '../shuffleBag';
import { word } from './helpers';

const ids = Array.from({ length: 12 }, (_, i) => `w-${i}`);

describe('shuffle bag', () => {
  it('does not repeat a word until the pool is used up', () => {
    const rng = seededRng(1);
    let bag: BagState = emptyBag();
    const seen: string[] = [];
    for (let i = 0; i < ids.length; i += 1) {
      const r = drawNext(bag, ids, rng);
      seen.push(r.id);
      bag = r.bag;
    }
    expect(new Set(seen).size).toBe(ids.length);
    expect(bag.remaining).toHaveLength(0);
  });

  it('refills when empty and never starts the new cycle with the last word', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const rng = seededRng(seed);
      const bag: BagState = { remaining: [], last: 'w-3' };
      expect(drawNext(bag, ids, rng).id).not.toBe('w-3');
    }
  });

  it('survives a save/load round trip (plain JSON)', () => {
    const rng = seededRng(7);
    const first = drawNext(emptyBag(), ids, rng);
    const restored = JSON.parse(JSON.stringify(first.bag)) as BagState;
    const second = drawNext(restored, ids, rng);
    expect(second.id).not.toBe(first.id);
    expect(second.bag.remaining).toHaveLength(ids.length - 2);
  });

  it('drops words that were removed from the word bank', () => {
    const bag: BagState = { remaining: ['gone-1', 'w-1', 'gone-2'] };
    const r = drawNext(bag, ids, seededRng(3));
    expect(r.id).toBe('w-1');
    expect(r.bag.remaining).toEqual([]);
  });

  it('shuffles differently with different seeds', () => {
    expect(refill(ids, seededRng(1))).not.toEqual(refill(ids, seededRng(2)));
  });

  it('throws on an empty pool', () => {
    expect(() => drawNext(emptyBag(), [], seededRng(1))).toThrow();
  });
});

describe('boss draw', () => {
  const pool = [
    word('PK', 'easy', 'a'),
    word('DON', 'easy', 'b'),
    word('KUCH KUCH HOTA HAI', 'easy', 'c'),
    word('ANDHADHUN', 'hard', 'd'),
    word('SATYA', 'hard', 'e'),
    word('QUEEN', 'medium', 'f'),
  ];

  it('prefers harder, longer words', () => {
    expect(bossScore(pool[3])).toBeGreaterThan(bossScore(pool[2]));
    expect(bossScore(pool[2])).toBeGreaterThan(bossScore(pool[0]));
  });

  it('picks from the top candidates still in the bag and removes it', () => {
    const top = new Set(['d', 'e', 'f']);
    for (let seed = 0; seed < 30; seed += 1) {
      const bag: BagState = { remaining: pool.map((w) => w.id) };
      const r = drawBoss(bag, pool, seededRng(seed), 3);
      expect(top.has(r.id)).toBe(true);
      expect(r.bag.remaining).not.toContain(r.id);
      expect(r.bag.remaining).toHaveLength(pool.length - 1);
    }
  });

  it('only considers words left in the bag', () => {
    const bag: BagState = { remaining: ['a', 'b', 'c'] };
    expect(drawBoss(bag, pool, seededRng(1), 1).id).toBe('c');
  });
});
