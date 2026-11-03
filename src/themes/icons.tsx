/**
 * Line icons on a 24x24 grid, copied from the mockups in design/source.
 * Each icon is data so a theme can name its power-up icons in config.
 */
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

export type IconPart =
  | { t: 'path'; d: string; dash?: string }
  | { t: 'rect'; x: number; y: number; w: number; h: number; rx?: number }
  | { t: 'circle'; cx: number; cy: number; r: number }
  | { t: 'ellipse'; cx: number; cy: number; rx: number; ry: number };

export type IconSpec = IconPart[];

const p = (d: string, dash?: string): IconPart => ({ t: 'path', d, dash });

export const ICONS = {
  // UI
  back: [p('M15 18l-6-6 6-6')],
  ticket: [p('M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z'), p('M14 7v10', '2 2.5')],
  share: [p('M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7'), p('M16 6l-4-4-4 4'), p('M12 2v13')],
  lock: [{ t: 'rect', x: 4, y: 11, w: 16, h: 10, rx: 2 }, p('M8 11V7a4 4 0 0 1 8 0v4')],

  // Filmy
  clapper: [
    p('M4 11h16v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z'),
    p('M4 11l-.6-3.2a1 1 0 0 1 .8-1.2l13.8-2.5a1 1 0 0 1 1.2.8L19.6 8'),
    p('M8.6 6.3l2 3.6M13.1 5.5l2 3.6'),
  ],
  trailer: [{ t: 'rect', x: 3, y: 5, w: 18, h: 14, rx: 2 }, p('M10 9l5 3-5 3z')],
  rewind: [p('M9 14L4 9l5-5'), p('M4 9h10.5a5.5 5.5 0 0 1 0 11H11')],
  scissors: [
    { t: 'circle', cx: 6, cy: 6, r: 3 },
    { t: 'circle', cx: 6, cy: 18, r: 3 },
    p('M20 4L8.12 15.88'),
    p('M14.47 14.48L20 20'),
    p('M8.12 8.12L12 12'),
  ],

  // Khana
  spoon: [{ t: 'ellipse', cx: 12, cy: 7, rx: 3.5, ry: 4.5 }, p('M12 11.5V21')],
  maaChat: [
    p('M4 5h16v11H10l-5 4v-4H4z'),
    p('M12 13.5s-3-1.7-3-3.5a1.5 1.5 0 0 1 3-.6 1.5 1.5 0 0 1 3 .6c0 1.8-3 3.5-3 3.5z'),
  ],
  potato: [p('M5 10c1-4 6-6 10-4.5s5.5 4.5 4.5 8-4.5 5.5-8.5 4.5S4 14 5 10z'), p('M10 9.5h.01M14.5 11h.01M11.5 14.5h.01')],
  strainer: [p('M3 9h14a7 7 0 0 1-14 0z'), p('M17 9l4-3'), p('M7 12h.01M10 13.5h.01M13 12h.01')],

  // Safar
  window: [{ t: 'rect', x: 4, y: 4, w: 16, h: 16, rx: 4 }, { t: 'circle', cx: 15, cy: 9, r: 2 }, p('M4 16l5-4 4 3 3-2 4 3')],
  signpost: [p('M12 3v18'), p('M5 6h11l3 3-3 3H5z')],
  chain: [
    p('M10 14a4 4 0 0 1 0-5.66l2-2a4 4 0 0 1 5.66 5.66l-1 1'),
    p('M14 10a4 4 0 0 1 0 5.66l-2 2a4 4 0 0 1-5.66-5.66l1-1'),
  ],
  ticketCheck: [p('M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v8a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2z'), p('M9 12l2 2 4-4')],

  // Cricket
  bat: [p('M14.5 4.5l5 5-9 9a2 2 0 0 1-2.8 0l-2.2-2.2a2 2 0 0 1 0-2.8z'), p('M5.5 18.5L3 21'), { t: 'circle', cx: 18.5, cy: 18.5, r: 2 }],
  mic: [{ t: 'rect', x: 9, y: 3, w: 6, h: 11, rx: 3 }, p('M5 11a7 7 0 0 0 14 0'), p('M12 18v3')],
  replay: [{ t: 'rect', x: 3, y: 4, w: 18, h: 13, rx: 2 }, p('M8 21h8'), p('M11 8l-3 2.5 3 2.5'), p('M15 8l-3 2.5 3 2.5')],
  stumps: [p('M7 8v13M12 8v13M17 8v13'), p('M6 4l5 1.5M13 5.5l5-1.5')],

  // Tyohar
  sparkler: [p('M4 20l9-9'), { t: 'circle', cx: 15, cy: 9, r: 1.5 }, p('M15 4v2M20 9h-2M18.5 5.5l-1.4 1.4M18.5 12.5l-1.4-1.4M11.5 5.5l1.4 1.4')],
  dadiChat: [p('M4 5h16v11H10l-5 4v-4H4z'), p('M8 10.5h.01M12 10.5h.01M16 10.5h.01')],
  diya: [p('M3 14h18a9 5 0 0 1-18 0z'), p('M12 3c2 2.5 2 4.5 0 6.5-2-2-2-4 0-6.5z')],
  broom: [p('M15 3l-4 8'), p('M7 11h8l2 10H5z'), p('M9 15v6M13 15v6')],

  // Masala Mix
  bulb: [p('M9 18h6M10 21h4'), p('M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z')],
  book: [p('M5 4h13v16H7a2 2 0 0 1-2-2z'), p('M5 18a2 2 0 0 1 2-2h11'), p('M9 8h6')],
  uturn: [p('M7 20V9a5 5 0 0 1 10 0v9'), p('M14 15l3 3 3-3')],
  exit: [p('M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4'), p('M10 16l-4-4 4-4'), p('M6 12h10')],
} satisfies Record<string, IconSpec>;

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 22, color, strokeWidth = 2 }: IconProps) {
  const spec: IconSpec = ICONS[name];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {spec.map((part, i) => {
        const common = {
          stroke: color,
          strokeWidth,
          strokeLinecap: 'round' as const,
          strokeLinejoin: 'round' as const,
          fill: 'none',
        };
        switch (part.t) {
          case 'path':
            return <Path key={i} {...common} d={part.d} strokeDasharray={part.dash} />;
          case 'rect':
            return <Rect key={i} {...common} x={part.x} y={part.y} width={part.w} height={part.h} rx={part.rx} />;
          case 'circle':
            return <Circle key={i} {...common} cx={part.cx} cy={part.cy} r={part.r} />;
          case 'ellipse':
            return <Ellipse key={i} {...common} cx={part.cx} cy={part.cy} rx={part.rx} ry={part.ry} />;
        }
      })}
    </Svg>
  );
}
