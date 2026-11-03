import { tokenize, type Tile } from './answer';

export interface TileLayoutOptions {
  maxWidth: number;
  /** Largest tile width (brief: 38px). */
  maxSize?: number;
  /** Smallest tile width before we give up shrinking (brief: about 26px). */
  minSize?: number;
  /** Most lines allowed before tiles shrink further. */
  maxLines?: number;
  /** Optional height budget for all lines together. */
  maxHeight?: number;
  /** Tile height divided by width (design: 48/38). */
  aspect?: number;
  /** Gap between lines in px. */
  lineGap?: number;
}

export interface TileLayout {
  size: number;
  height: number;
  gap: number;
  wordGap: number;
  fontSize: number;
  lines: Tile[][][];
  /** False if even the smallest size could not satisfy the limits. */
  fits: boolean;
}

/** Tile metrics for a given tile width, scaled from the 38px design. */
export function metricsFor(size: number, aspect = 48 / 38) {
  return {
    size,
    height: Math.round(size * aspect),
    gap: Math.max(3, Math.round((size * 6) / 38)),
    wordGap: Math.max(10, Math.round((size * 20) / 38)),
    fontSize: Math.round((size * 26) / 38),
  };
}

function wrap(words: Tile[][], maxWidth: number, size: number, gap: number, wordGap: number) {
  const width = (w: Tile[]) => w.length * size + (w.length - 1) * gap;
  const lines: Tile[][][] = [];
  let line: Tile[][] = [];
  let lineWidth = 0;
  for (const w of words) {
    const ww = width(w);
    if (ww > maxWidth) return null;
    const extra = line.length ? wordGap + ww : ww;
    if (line.length && lineWidth + extra > maxWidth) {
      lines.push(line);
      line = [w];
      lineWidth = ww;
    } else {
      line.push(w);
      lineWidth += extra;
    }
  }
  if (line.length) lines.push(line);
  return lines;
}

/**
 * Lays answer tiles out in lines, wrapping only at word breaks. Starts at the
 * largest size and shrinks until every word fits on one line and the limits
 * on lines and height are met.
 */
export function layoutTiles(answer: string, opts: TileLayoutOptions): TileLayout {
  const { maxWidth, maxSize = 38, minSize = 26, maxLines = 3, maxHeight, aspect = 48 / 38, lineGap = 8 } = opts;
  const words = tokenize(answer);
  let fallback: TileLayout | null = null;
  for (let size = maxSize; size >= minSize; size -= 1) {
    const m = metricsFor(size, aspect);
    const lines = wrap(words, maxWidth, size, m.gap, m.wordGap);
    if (!lines) continue;
    const totalHeight = lines.length * m.height + (lines.length - 1) * lineGap;
    const layout: TileLayout = { ...m, lines, fits: true };
    if (!fallback) fallback = { ...layout, fits: false };
    if (lines.length <= maxLines && (maxHeight === undefined || totalHeight <= maxHeight)) return layout;
    fallback = { ...layout, fits: false };
  }
  if (fallback) return fallback;
  // Even the smallest tiles cannot fit a word: put each word on its own line.
  const m = metricsFor(minSize, aspect);
  return { ...m, lines: words.map((w) => [w]), fits: false };
}

/** Height of a layout including line gaps. */
export function layoutHeight(layout: TileLayout, lineGap = 8): number {
  return layout.lines.length * layout.height + Math.max(0, layout.lines.length - 1) * lineGap;
}
