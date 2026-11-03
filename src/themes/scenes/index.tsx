/**
 * Scene components per theme. Static art is ported from the mockups (see
 * ./ported); the live parts (Tyohar's diyas, Masala Mix's reel) are layered on.
 */
import type { SceneProps, ThemeScenes } from '../types';

import { DiyaRow } from './DiyaRow';
import * as P from './ported';
import { SlotReel } from './SlotReel';

const labels = (game: string, win: string, lose: string) => ({ game, win, lose });

export const filmyScenes: ThemeScenes = {
  Game: P.MainScene,
  Win: P.WinScene,
  Lose: P.LoseScene,
  labels: labels(P.MainSceneLabel, P.WinSceneLabel, P.LoseSceneLabel),
};

export const khanaScenes: ThemeScenes = {
  Game: P.KhanaScene,
  Win: P.KhanaWinScene,
  Lose: P.KhanaLoseScene,
  labels: labels(P.KhanaSceneLabel, P.KhanaWinSceneLabel, P.KhanaLoseSceneLabel),
};

export const safarScenes: ThemeScenes = {
  Game: P.SafarScene,
  Win: P.SafarWinScene,
  Lose: P.SafarLoseScene,
  labels: labels(P.SafarSceneLabel, P.SafarWinSceneLabel, P.SafarLoseSceneLabel),
};

export const cricketScenes: ThemeScenes = {
  Game: P.CricketScene,
  Win: P.CricketWinScene,
  Lose: P.CricketLoseScene,
  labels: labels(P.CricketSceneLabel, P.CricketWinSceneLabel, P.CricketLoseSceneLabel),
};

function TyoharGame({ marks }: SceneProps) {
  return (
    <>
      <P.TyoharScene />
      <DiyaRow marks={marks} />
    </>
  );
}

export const tyoharScenes: ThemeScenes = {
  Game: TyoharGame,
  Win: P.TyoharWinScene,
  Lose: P.TyoharLoseScene,
  labels: labels('Nine diyas around a rangoli under a marigold garland, one for each life', P.TyoharWinSceneLabel, P.TyoharLoseSceneLabel),
};

/** Window colour per category once the reel lands (each category's background). */
const REEL_BG = { filmy: '#2A0710', khana: '#2B1606', safar: '#0F1E3D', cricket: '#0B2A1A', tyohar: '#2A0E3A' } as const;

function MasalaGame({ category, spinKey, onReelLanded, instantReel }: SceneProps) {
  return (
    <>
      <P.MasalaMixScene />
      <SlotReel
        target={category ?? null}
        spinKey={spinKey ?? null}
        landedBg={category ? REEL_BG[category] : '#0F0D0B'}
        onLanded={onReelLanded}
        instant={instantReel}
      />
    </>
  );
}

export const masalaScenes: ThemeScenes = {
  Game: MasalaGame,
  Win: P.MasalaMixWinScene,
  Lose: P.MasalaMixLoseScene,
  labels: labels('A masala dabba next to a slot reel that picks the category', P.MasalaMixWinSceneLabel, P.MasalaMixLoseSceneLabel),
};
