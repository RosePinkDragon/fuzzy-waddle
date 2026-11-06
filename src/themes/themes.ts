/**
 * The six themes as config. Adding a category means adding an entry here (plus
 * copy in src/copy/strings.ts, scenes and a word bank), not new screens.
 * Colours are the exact values from design/source/*.dc.html.
 */
import { themeCopy } from '@/copy/strings';
import type { ThemeId } from '@/game/types';

import { cricketScenes, filmyScenes, khanaScenes, masalaScenes, safarScenes, tyoharScenes } from './scenes';
import type { Theme } from './types';

const STAMP = { winSize: 28, winRotate: -6, loseSize: 28 };

export const THEMES: Record<ThemeId, Theme> = {
  filmy: {
    id: 'filmy',
    copy: themeCopy.filmy,
    colors: {
      bg: '#2A0710',
      panel: '#3A0B15',
      border: '#7A2633',
      accent: '#F2B33D',
      text: '#FFF4DC',
      muted: '#F7D9A0',
      onAccent: '#2A0710',
      chip: { bg: '#F7D9A0', text: '#5A1420' },
      badge: { bg: '#F28C28', text: '#2A0710' },
      primary: { bg: '#F28C28', text: '#2A0710' },
      keyRight: { bg: '#F2B33D', text: '#2A0710' },
      keyWrong: { bg: '#3A1018', text: '#B98C92' },
      winStamp: '#F28C28',
      card: { bg: '#FFF4DC', text: '#2A0710', label: '#8A1C2B', dash: '#D9B98A', foot: '#6B2A33' },
    },
    scene: {
      game: { bg: '#1A0409', border: { width: 3, color: '#F2B33D', style: 'dotted' } },
      win: { bg: '#2A0710', border: { width: 1, color: '#5A1420' } },
      lose: { bg: '#1A0409' },
    },
    stamp: { winSize: 34, winRotate: -7, loseSize: 34 },
    lives: {
      kind: 'letters',
      groups: ['BOLLYWOOD'],
      fontSize: 17,
      live: '#F28C28',
      used: '#B07F86',
      strike: '#E0343F',
      locked: '#5A1F2B',
    },
    powerUpIcons: ['clapper', 'trailer', 'rewind', 'scissors'],
    scenes: filmyScenes,
    categoryChip: { bg: '#2A0710', text: '#F2B33D', border: '#F2B33D' },
  },
  khana: {
    id: 'khana',
    copy: themeCopy.khana,
    colors: {
      bg: '#2B1606',
      panel: '#3D200B',
      border: '#6B3A16',
      accent: '#F2B705',
      text: '#FFF4DC',
      muted: '#F6DFA8',
      onAccent: '#2B1606',
      chip: { bg: '#F9E2A6', text: '#5A2A08' },
      badge: { bg: '#F2B705', text: '#2B1606' },
      primary: { bg: '#F2B705', text: '#2B1606' },
      keyRight: { bg: '#F2B705', text: '#2B1606' },
      keyWrong: { bg: '#3A1E0A', text: '#C49A6C' },
      winStamp: '#F2B705',
      card: { bg: '#FFF4DC', text: '#2B1606', label: '#9A2A14', dash: '#D9B98A', foot: '#6B3A16' },
    },
    scene: {
      game: { bg: '#2E1A0C' },
      win: { bg: '#2E1A0C', border: { width: 1, color: '#6B3A16' } },
      lose: { bg: '#2E1A0C' },
    },
    stamp: STAMP,
    lives: {
      kind: 'marks',
      width: 10,
      height: 10,
      radius: 5,
      gap: 4,
      live: { border: '#FFF4DC', borderWidth: 2 },
      used: { fill: '#E2402F' },
      locked: { border: '#4E2C10', borderWidth: 2 },
    },
    powerUpIcons: ['spoon', 'maaChat', 'potato', 'strainer'],
    scenes: khanaScenes,
    categoryChip: { bg: '#2B1606', text: '#F2B705', border: '#F2B705' },
  },
  safar: {
    id: 'safar',
    copy: themeCopy.safar,
    colors: {
      bg: '#0F1E3D',
      panel: '#1A2C55',
      border: '#2F4A80',
      accent: '#F5A524',
      text: '#F4F1E8',
      muted: '#CFE0FF',
      onAccent: '#0F1E3D',
      chip: { bg: '#FCE3B0', text: '#5A3300' },
      badge: { bg: '#F5A524', text: '#0F1E3D' },
      primary: { bg: '#F5A524', text: '#0F1E3D' },
      keyRight: { bg: '#F5A524', text: '#0F1E3D' },
      keyWrong: { bg: '#16264A', text: '#8FA3C7' },
      winStamp: '#F5A524',
      card: { bg: '#F4F1E8', text: '#0F1E3D', label: '#8A4B00', dash: '#C9B98A', foot: '#2F4A80' },
    },
    scene: {
      game: { bg: '#18305E' },
      win: { bg: '#18305E', border: { width: 1, color: '#2F4A80' } },
      lose: { bg: '#18305E' },
    },
    stamp: STAMP,
    lives: {
      kind: 'marks',
      width: 12,
      height: 8,
      radius: 2,
      gap: 3,
      live: { fill: '#3FA7D6' },
      used: { border: '#8FA3C7', borderWidth: 1.5, dashed: true },
      locked: { fill: '#2F4A80' },
    },
    powerUpIcons: ['window', 'signpost', 'chain', 'ticketCheck'],
    scenes: safarScenes,
    categoryChip: { bg: '#0F1E3D', text: '#F5A524', border: '#F5A524' },
  },
  cricket: {
    id: 'cricket',
    copy: themeCopy.cricket,
    colors: {
      bg: '#0B2A1A',
      panel: '#12402A',
      border: '#1F6B45',
      accent: '#E9F07A',
      text: '#F4F1E8',
      muted: '#CDEBD5',
      onAccent: '#0B2A1A',
      chip: { bg: '#DDEFC9', text: '#1E4A28' },
      badge: { bg: '#E9F07A', text: '#0B2A1A' },
      primary: { bg: '#E9F07A', text: '#0B2A1A' },
      keyRight: { bg: '#1F7A45', text: '#F4F1E8' },
      keyWrong: { bg: '#0F3622', text: '#86B597' },
      winStamp: '#E9F07A',
      card: { bg: '#F4F1E8', text: '#0B2A1A', label: '#1F5A2E', dash: '#B9D3A8', foot: '#1F6B45' },
    },
    scene: {
      game: { bg: '#0A1F2E' },
      win: { bg: '#0A1F2E', border: { width: 1, color: '#1F6B45' } },
      lose: { bg: '#0A1F2E' },
    },
    stamp: { winSize: 32, winRotate: -6, loseSize: 34 },
    lives: {
      kind: 'marks',
      width: 4,
      height: 12,
      radius: 2,
      gap: 5,
      live: { fill: '#F4F1E8' },
      used: { fill: '#E0343F', rotate: 28 },
      locked: { fill: '#1F5A3A' },
    },
    powerUpIcons: ['bat', 'mic', 'replay', 'stumps'],
    scenes: cricketScenes,
    categoryChip: { bg: '#0B2A1A', text: '#E9F07A', border: '#E9F07A' },
  },
  tyohar: {
    id: 'tyohar',
    copy: themeCopy.tyohar,
    colors: {
      bg: '#2A0E3A',
      panel: '#3B1652',
      border: '#6A2C8C',
      accent: '#FF9F1C',
      text: '#FFF4E6',
      muted: '#F3D6FF',
      onAccent: '#2A0E3A',
      chip: { bg: '#FFE1C2', text: '#6A2A00' },
      badge: { bg: '#FF9F1C', text: '#2A0E3A' },
      primary: { bg: '#FF9F1C', text: '#2A0E3A' },
      keyRight: { bg: '#FF9F1C', text: '#2A0E3A' },
      keyWrong: { bg: '#33124A', text: '#B892CF' },
      winStamp: '#FF9F1C',
      card: { bg: '#FFF4E6', text: '#2A0E3A', label: '#8A2560', dash: '#E0C2D8', foot: '#6A2C8C' },
    },
    scene: {
      game: { bg: '#2A0E3A', border: { width: 1, color: '#4A1D63' } },
      win: { bg: '#2A0E3A', border: { width: 1, color: '#4A1D63' } },
      lose: { bg: '#1A0826' },
    },
    stamp: { winSize: 30, winRotate: -6, loseSize: 28 },
    lives: {
      kind: 'marks',
      width: 10,
      height: 10,
      radius: 5,
      gap: 4,
      live: { fill: '#FFC93C' },
      used: { border: '#B892CF', borderWidth: 2 },
      locked: { fill: '#4A1D63' },
    },
    powerUpIcons: ['sparkler', 'dadiChat', 'diya', 'broom'],
    scenes: tyoharScenes,
    categoryChip: { bg: '#2A0E3A', text: '#FF9F1C', border: '#FF9F1C' },
  },
  masala: {
    id: 'masala',
    copy: themeCopy.masala,
    mixed: true,
    colors: {
      bg: '#1E1A17',
      panel: '#2C2621',
      border: '#4A3F35',
      accent: '#F2B705',
      text: '#FFF4DC',
      muted: '#EAD9C0',
      onAccent: '#1E1A17',
      chip: { bg: '#F3E3C4', text: '#5A3A10' },
      badge: { bg: '#F2B705', text: '#1E1A17' },
      primary: { bg: '#F2B705', text: '#1E1A17' },
      keyRight: { bg: '#F2B705', text: '#1E1A17' },
      keyWrong: { bg: '#2A231E', text: '#A89482' },
      winStamp: '#F2B705',
      card: { bg: '#FFF4DC', text: '#1E1A17', label: '#8A3A10', dash: '#D9C4A0', foot: '#5A4A3A' },
    },
    scene: {
      game: { bg: '#2C2621' },
      win: { bg: '#2C2621', border: { width: 1, color: '#4A3F35' } },
      lose: { bg: '#2C2621' },
    },
    stamp: STAMP,
    lives: {
      kind: 'letters',
      groups: ['DESI', 'MASTI'],
      fontSize: 15,
      live: '#F2B705',
      used: '#A89482',
      strike: '#E2402F',
      locked: '#4A3F35',
    },
    powerUpIcons: ['bulb', 'book', 'uturn', 'exit'],
    scenes: masalaScenes,
    categoryChip: { bg: '#1E1A17', text: '#F2B705', border: '#F2B705' },
  },
};

export const THEME_ORDER: ThemeId[] = ['filmy', 'khana', 'safar', 'cricket', 'tyohar', 'masala'];

export function themeFor(id: ThemeId): Theme {
  return THEMES[id];
}

export function isThemeId(id: string | undefined): id is ThemeId {
  return !!id && Object.hasOwn(THEMES, id);
}

/**
 * The theme a `/play/<theme>` path belongs to, or null for any other path (home, challenge links,
 * unknown routes) and for an unknown theme id. The root layout paints its backdrop from this.
 */
export function themeIdForPath(pathname: string | undefined): ThemeId | null {
  const id = /^\/play\/([^/?#]+)/.exec(pathname ?? '')?.[1];
  return isThemeId(id) ? id : null;
}

/** Background for frames the root layout paints itself (fonts loading, screens between routes). Filmy unless the path is a known theme's play route. */
export function backdropForPath(pathname: string | undefined): string {
  return THEMES[themeIdForPath(pathname) ?? 'filmy'].colors.bg;
}
