import { Text, type TextProps, type TextStyle } from 'react-native';

/** Font family names registered in src/app/_layout.tsx. */
export const FONTS = {
  400: 'Mukta-Regular',
  600: 'Mukta-SemiBold',
  700: 'Mukta-Bold',
  800: 'Mukta-ExtraBold',
  display: 'YatraOne',
} as const;

export type Weight = 400 | 600 | 700 | 800;

interface TxtProps extends TextProps {
  size: number;
  color: string;
  weight?: Weight;
  /** Yatra One, the display face. */
  display?: boolean;
  /** CSS-style line height multiplier. */
  lh?: number;
  /** Letter spacing in em, as in the mockups. */
  em?: number;
  align?: TextStyle['textAlign'];
}

export function Txt({ size, color, weight = 400, display, lh = 1.25, em, align, style, ...rest }: TxtProps) {
  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: display ? FONTS.display : FONTS[weight],
          fontSize: size,
          lineHeight: Math.round(size * lh),
          color,
          letterSpacing: em ? em * size : undefined,
          textAlign: align,
        },
        style,
      ]}
    />
  );
}
