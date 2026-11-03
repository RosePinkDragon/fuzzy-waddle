/**
 * Masala Mix slot reel: before each word it spins through the categories and
 * lands on the one the word comes from. Geometry and colours come from
 * design/source/MasalaMix.dc.html (the machine sits inside translate(0 14)).
 */
import { useEffect, useRef, useState } from 'react';
import { G, Path, Rect } from 'react-native-svg';

import type { CategoryId } from '@/game/types';

import { CategoryGlyph } from '../glyphs';

const ORDER: CategoryId[] = ['filmy', 'khana', 'safar', 'cricket', 'tyohar'];
const at = (i: number) => ORDER[((i % ORDER.length) + ORDER.length) % ORDER.length];

export const REEL_TICKS = 13;

/** Delay before each tick: fast at first, slowing down as it lands. */
export const tickDelay = (i: number) => 45 + 1.2 * i * i;

interface SlotReelProps {
  target: CategoryId | null;
  /** Changes for every new word; a change starts a new spin. Null shows the target at rest. */
  spinKey: string | null;
  /** Window colour once landed (the category's background). */
  landedBg: string;
  onLanded?: () => void;
  /** Skip the animation (tests, reduced motion). */
  instant?: boolean;
}

export function SlotReel({ target, spinKey, landedBg, onLanded, instant }: SlotReelProps) {
  const [progress, setProgress] = useState<{ key: string | null; step: number }>({ key: null, step: 0 });
  const landed = useRef(onLanded);
  useEffect(() => {
    landed.current = onLanded;
  });

  const animate = !instant && !!target && !!spinKey;
  const step = animate ? (progress.key === spinKey ? progress.step : 0) : REEL_TICKS;
  const end = target ? ORDER.indexOf(target) : 0;
  const pos = end - REEL_TICKS + step;
  const spinning = animate && step < REEL_TICKS;

  useEffect(() => {
    if (!target || !spinKey) return;
    if (instant) {
      landed.current?.();
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    let t = 0;
    for (let i = 1; i <= REEL_TICKS; i += 1) {
      t += tickDelay(i);
      const last = i === REEL_TICKS;
      timers.push(
        setTimeout(() => {
          setProgress({ key: spinKey, step: i });
          if (last) landed.current?.();
        }, t),
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [spinKey, target, instant]);

  return (
    <G transform="translate(0 14)">
      <Rect x="196" y="54" width="156" height="100" rx="12" fill="#1E1A17" stroke="#F2B705" strokeWidth="2" />
      <CategoryGlyph id={at(pos + 1)} dim x={274} y={70} scale={0.75} />
      <Rect x="204" y="86" width="140" height="34" rx="8" fill={spinning || !target ? '#0F0D0B' : landedBg} />
      <CategoryGlyph id={at(pos)} x={274} y={103} scale={0.85} opacity={target ? 1 : 0.4} />
      <CategoryGlyph id={at(pos - 1)} dim x={274} y={137} scale={0.75} />
      <Path d="M196 96 l8 7 l-8 7 Z" fill="#F2B705" />
      <Path d="M352 96 l-8 7 l8 7 Z" fill="#F2B705" />
    </G>
  );
}
