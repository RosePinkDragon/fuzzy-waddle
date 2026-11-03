/**
 * The nine diyas in the Tyohar game scene. They follow the lives sign: lit
 * for lives left, smoking for lives lost, and faint for pre-locked marks.
 * Positions and colours come from design/source/Tyohar.dc.html.
 */
import { Circle, G, Path } from 'react-native-svg';

import type { LifeMark } from '@/game/difficulty';

const SPOTS: [number, number][] = [
  [31, 126],
  [69, 121],
  [107, 117],
  [145, 115],
  [183, 114],
  [221, 115],
  [259, 117],
  [297, 121],
  [335, 126],
];

function Lit() {
  return (
    <>
      <Circle cx="0" cy="-12" r="14" fill="#FFC93C" opacity="0.18" />
      <Path d="M0 -24 Q7 -12 0 -6 Q-7 -12 0 -24 Z" fill="#FFC93C" />
      <Path d="M0 -18 Q3 -11 0 -8 Q-3 -11 0 -18 Z" fill="#FF6B1C" />
      <Path d="M-13 -4 Q0 10 13 -4 Z" fill="#C8641E" />
      <Path d="M-13 -4 H13" stroke="#E08A3A" strokeWidth="2" />
    </>
  );
}

function Out({ smoke }: { smoke: boolean }) {
  return (
    <>
      {smoke && <Path d="M0 -6 q-4 -6 0 -10 q4 -4 0 -10" fill="none" stroke="#B892CF" strokeWidth="2" opacity="0.7" />}
      <Path d="M-13 -4 Q0 10 13 -4 Z" fill="#8A4A1E" />
      <Path d="M-13 -4 H13" stroke="#A0602E" strokeWidth="2" />
    </>
  );
}

export function DiyaRow({ marks }: { marks: LifeMark[] }) {
  return (
    <>
      {SPOTS.map(([x, y], i) => {
        const mark = marks[i] ?? 'live';
        return (
          <G key={i} transform={`translate(${x} ${y})`} opacity={mark === 'locked' ? 0.35 : 1}>
            {mark === 'live' ? <Lit /> : <Out smoke={mark === 'used'} />}
          </G>
        );
      })}
    </>
  );
}
