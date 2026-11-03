import { createContext, useContext } from 'react';

import { THEMES } from '@/themes/themes';
import type { Theme } from '@/themes/types';

const ThemeContext = createContext<Theme>(THEMES.filmy);

export const ThemeProvider = ThemeContext.Provider;

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
