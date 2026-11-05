import {
  CLUB_LADDER,
  LADDER_EXTENSION,
  MAX_PROGRESS_SEGMENTS,
  TEST_CLUB_LADDER,
} from './config';
import type { Club } from './types';

export type Rung = { crore: number; hits: number };

/** How the ladder continues after its last rung (see LADDER_EXTENSION). */
export interface LadderExtension {
  readonly gapGrowth: number;
  readonly croreSteps: readonly number[];
  readonly croreEvery: number;
}

/** The rungs the live app plays: the test ladder only when the build-time switch is on. */
export function activeLadder(): readonly Rung[] {
  return process.env.EXPO_PUBLIC_TEST_LADDER === '1' ? TEST_CLUB_LADDER : CLUB_LADDER;
}

/**
 * The milestone ladder. Configured rungs come first; after the last one the
 * ladder carries on with growing gaps (see LADDER_EXTENSION).
 */
export class Ladder {
  private readonly rungs: Rung[];
  private readonly ext: LadderExtension;

  constructor(base: readonly Rung[] = activeLadder(), ext: LadderExtension = LADDER_EXTENSION) {
    if (base.length < 2) throw new Error('Ladder needs at least two rungs');
    this.rungs = base.map((r) => ({ ...r }));
    this.ext = { ...ext, croreSteps: [...ext.croreSteps] };
  }

  /** The club at a 0-based ladder position, extending the ladder as needed. */
  clubAt(index: number): Club {
    while (this.rungs.length <= index) this.extend();
    const r = this.rungs[index];
    return { index, crore: r.crore, hits: r.hits };
  }

  /** Highest club reached with this many hits, or null before the first. */
  reached(hits: number): Club | null {
    let found: Club | null = null;
    for (let i = 0; ; i += 1) {
      const c = this.clubAt(i);
      if (c.hits > hits) return found;
      found = c;
    }
  }

  /** The next club still to reach. */
  next(hits: number): Club {
    for (let i = 0; ; i += 1) {
      const c = this.clubAt(i);
      if (c.hits > hits) return c;
    }
  }

  /** True when the word played at `hits` hits would enter a club, i.e. it is a boss round. */
  isBossWord(hits: number): boolean {
    return this.next(hits).hits === hits + 1;
  }

  /** Progress from the previous club (or 0) towards the next one. */
  progress(hits: number): Progress {
    const to = this.next(hits);
    const fromHits = to.index === 0 ? 0 : this.clubAt(to.index - 1).hits;
    const total = to.hits - fromHits;
    const done = hits - fromHits;
    const segments = Math.min(total, MAX_PROGRESS_SEGMENTS);
    const filled = total <= MAX_PROGRESS_SEGMENTS ? done : Math.floor((done / total) * segments);
    return { to, fromHits, total, done, remaining: to.hits - hits, segments, filled };
  }

  private extend() {
    const n = this.rungs.length;
    const last = this.rungs[n - 1];
    const prev = this.rungs[n - 2];
    const gap = last.hits - prev.hits + this.ext.gapGrowth;
    const nextStep = this.ext.croreSteps.find((c) => c > last.crore);
    const crore = nextStep ?? last.crore + this.ext.croreEvery;
    this.rungs.push({ crore, hits: last.hits + gap });
  }
}

export interface Progress {
  to: Club;
  fromHits: number;
  total: number;
  done: number;
  remaining: number;
  segments: number;
  filled: number;
}

export const ladder = new Ladder();

/** "100 Cr Club" — for badges and the progress row. */
export function clubShort(club: Club): string {
  return `${club.crore} Cr Club`;
}

/** "100 Crore Club" — for headings and sentences. */
export function clubLong(club: Club): string {
  return `${club.crore} Crore Club`;
}
