import { layoutHeight, layoutTiles } from '../tileLayout';

const words = (l: ReturnType<typeof layoutTiles>) => l.lines.map((line) => line.map((w) => w.map((t) => t.ch).join('')).join(' '));

describe('tile layout', () => {
  it('uses 38px tiles and wraps at word breaks like the mockups', () => {
    const l = layoutTiles('KUCH KUCH HOTA HAI', { maxWidth: 366 });
    expect(l.size).toBe(38);
    expect(words(l)).toEqual(['KUCH KUCH', 'HOTA HAI']);
    expect(words(layoutTiles('HAWA MAHAL', { maxWidth: 366 }))).toEqual(['HAWA', 'MAHAL']);
    expect(words(layoutTiles('PANI PURI', { maxWidth: 366 }))).toEqual(['PANI PURI']);
  });

  it('shrinks tiles when a single word will not fit on one line', () => {
    const l = layoutTiles('CHATURTHIXX', { maxWidth: 366 });
    expect(l.size).toBeLessThan(38);
    expect(l.size).toBeGreaterThanOrEqual(26);
    expect(l.lines).toHaveLength(1);
    expect(l.fits).toBe(true);
  });

  it('shrinks to keep within the line limit', () => {
    const l = layoutTiles('DILWALE DULHANIA LE JAYENGE', { maxWidth: 366, maxLines: 3 });
    expect(l.lines.length).toBeLessThanOrEqual(3);
    expect(l.size).toBeLessThan(38);
  });

  it('respects a height budget', () => {
    const l = layoutTiles('ZINDAGI NA MILEGI DOBARA', { maxWidth: 366, maxHeight: 130 });
    expect(layoutHeight(l)).toBeLessThanOrEqual(130);
  });

  it('flags layouts that cannot fit', () => {
    expect(layoutTiles('ABCDEFGHIJKLMNOP', { maxWidth: 366 }).fits).toBe(false);
  });
});
