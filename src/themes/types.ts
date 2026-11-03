import type { ComponentType } from 'react';

import type { ThemeCopy } from '@/copy/strings';
import type { LifeMark } from '@/game/difficulty';
import type { CategoryId, ThemeId } from '@/game/types';

import type { IconName } from './icons';

export interface Pair {
  bg: string;
  text: string;
}

export interface Border {
  width: number;
  color: string;
  style?: 'solid' | 'dotted' | 'dashed';
}

/** How one mark on the lives sign looks in a given state. */
export interface MarkStyle {
  fill?: string;
  border?: string;
  borderWidth?: number;
  dashed?: boolean;
  rotate?: number;
}

export type LivesStyle =
  | {
      kind: 'letters';
      /** Words whose letters are the nine marks, e.g. ['BOLLYWOOD'] or ['DESI', 'MASTI']. */
      groups: string[];
      fontSize: number;
      live: string;
      used: string;
      strike: string;
      locked: string;
    }
  | {
      kind: 'marks';
      width: number;
      height: number;
      radius: number;
      gap: number;
      live: MarkStyle;
      used: MarkStyle;
      locked: MarkStyle;
    };

export interface SceneProps {
  marks: LifeMark[];
  /** Masala Mix: the category the current word came from (drives the slot reel). */
  category?: CategoryId | null;
  /** Masala Mix: changes per word to start a reel spin. */
  spinKey?: string | null;
  onReelLanded?: () => void;
  instantReel?: boolean;
}

export interface ThemeScenes {
  /** Drawn at 366x200. */
  Game: ComponentType<SceneProps>;
  /** Drawn at 366x200. */
  Win: ComponentType<object>;
  /** Drawn at 366x220. */
  Lose: ComponentType<object>;
  labels: { game: string; win: string; lose: string };
}

export interface Theme {
  id: ThemeId;
  copy: ThemeCopy;
  /** Draws each word from a random category (Masala Mix): adds the slot reel and category chip. */
  mixed?: boolean;
  colors: {
    bg: string;
    panel: string;
    border: string;
    accent: string;
    text: string;
    /** Secondary text (sublines, stat captions). */
    muted: string;
    /** Text on accent backgrounds. */
    onAccent: string;
    chip: Pair;
    /** Count badges on power-ups. */
    badge: Pair;
    /** Main button on win and flop screens. */
    primary: Pair;
    keyRight: Pair;
    keyWrong: Pair;
    winStamp: string;
    card: { bg: string; text: string; label: string; dash: string; foot: string };
  };
  scene: {
    game: { bg: string; border?: Border };
    win: { bg: string; border?: Border };
    lose: { bg: string; border?: Border };
  };
  stamp: { winSize: number; winRotate: number; loseSize: number };
  lives: LivesStyle;
  powerUpIcons: [IconName, IconName, IconName, IconName];
  scenes: ThemeScenes;
  /** For Masala Mix's category chip: how a category is shown inside another theme. */
  categoryChip: { bg: string; text: string; border: string };
}
