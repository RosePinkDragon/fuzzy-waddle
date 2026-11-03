/**
 * Small category pictures for the Masala Mix slot reel and the home screen.
 * Drawn around (0, 0) in a box about 32x24, in the style of the reel in
 * design/source/MasalaMix.dc.html (the train there is the Safar glyph).
 */
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import type { ThemeId } from '@/game/types';

const DIM = '#6E6258';
const DIM_LINE = '#1E1A17';

interface GlyphProps {
  id: ThemeId;
  dim?: boolean;
  x?: number;
  y?: number;
  scale?: number;
  opacity?: number;
}

export function CategoryGlyph({ id, dim = false, x = 0, y = 0, scale = 1, opacity = 1 }: GlyphProps) {
  const c = (color: string) => (dim ? DIM : color);
  const line = (color: string) => (dim ? DIM_LINE : color);
  let body: React.ReactNode;
  switch (id) {
    case 'safar':
      body = (
        <>
          <Rect x={-16} y={-8} width={32} height={16} rx={3} fill={c('#2E5AAC')} />
          <Rect x={-12} y={-4} width={6} height={5} rx={1} fill={line('#F4F1E8')} />
          <Rect x={-3} y={-4} width={6} height={5} rx={1} fill={line('#F4F1E8')} />
          <Rect x={6} y={-4} width={6} height={5} rx={1} fill={line('#F4F1E8')} />
          <Circle cx={-9} cy={11} r={2.5} fill={c('#F5A524')} />
          <Circle cx={9} cy={11} r={2.5} fill={c('#F5A524')} />
        </>
      );
      break;
    case 'khana':
      body = (
        <>
          <Path d="M-5 -6 q-2 -3 0 -6 M0 -6 q-2 -3 0 -6 M5 -6 q-2 -3 0 -6" stroke={line('#FFF4DC')} strokeWidth={1.6} strokeLinecap="round" fill="none" opacity={dim ? 0 : 0.8} />
          <Path d="M-12 -2 H12 Q12 10 0 10 Q-12 10 -12 -2 Z" fill={c('#F2B705')} />
          <Path d="M-13 -2 H13" stroke={c('#E2402F')} strokeWidth={2.5} strokeLinecap="round" />
        </>
      );
      break;
    case 'cricket':
      body = (
        <>
          <Circle cx={0} cy={0} r={9} fill={c('#E0343F')} />
          <Path d="M-6 -6 Q-1 0 -6 6 M6 -6 Q1 0 6 6" stroke={line('#FFF4DC')} strokeWidth={1.5} fill="none" />
        </>
      );
      break;
    case 'filmy':
      body = (
        <>
          <Rect x={-13} y={-3} width={26} height={14} rx={2} fill={c('#F2B33D')} />
          <Path d="M-13 -4 L-14 -9 L11 -14 L12 -9 Z" fill={c('#FFF4DC')} />
          <Path d="M-8 -5.5 L-5 -11 M-1 -7 L2 -12.5 M6 -8.5 L9 -13.5" stroke={line('#2A0710')} strokeWidth={2} />
          <Path d="M-13 3 H13" stroke={line('#2A0710')} strokeWidth={1.5} />
        </>
      );
      break;
    case 'tyohar':
      body = (
        <>
          <Circle cx={0} cy={-5} r={9} fill={c('#FFC93C')} opacity={dim ? 0 : 0.18} />
          <Path d="M0 -13 Q6 -4 0 0 Q-6 -4 0 -13 Z" fill={c('#FFC93C')} />
          <Path d="M0 -8 Q2.5 -3 0 -1 Q-2.5 -3 0 -8 Z" fill={c('#FF6B1C')} />
          <Path d="M-13 1 Q0 14 13 1 Z" fill={c('#C8641E')} />
          <Path d="M-13 1 H13" stroke={c('#E08A3A')} strokeWidth={2} />
        </>
      );
      break;
    case 'masala':
      body = (
        <>
          <Circle cx={0} cy={0} r={13} fill={c('#B8B8B0')} stroke={c('#DADAD3')} strokeWidth={1.5} />
          <Circle cx={0} cy={0} r={3.6} fill={c('#F4F1E8')} />
          <Circle cx={7} cy={0} r={3.6} fill={c('#F2B705')} />
          <Circle cx={-7} cy={0} r={3.6} fill={c('#3A2A1E')} />
          <Circle cx={3.5} cy={6.1} r={3.6} fill={c('#E2402F')} />
          <Circle cx={-3.5} cy={6.1} r={3.6} fill={c('#8A5A2B')} />
          <Circle cx={3.5} cy={-6.1} r={3.6} fill={c('#6B3A1E')} />
          <Circle cx={-3.5} cy={-6.1} r={3.6} fill={c('#7FBF5E')} />
        </>
      );
      break;
  }
  return (
    <G transform={`translate(${x} ${y}) scale(${scale})`} opacity={opacity}>
      {body}
    </G>
  );
}

/** A glyph as a standalone image, e.g. for the home screen cards. */
export function GlyphImage({ id, size = 44 }: { id: ThemeId; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="-18 -18 36 36">
      <CategoryGlyph id={id} />
    </Svg>
  );
}
