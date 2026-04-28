// Canvas dimensions
export const W = 920;
export const H = 520;
export const GROUND_Y = 478;

// Palette
export const COL_GREEN      = 0x00ff41;
export const COL_DK_GREEN   = 0x001f00;
export const COL_MID_GREEN  = 0x004a00;
export const COL_LT_GREEN   = 0xaaffbb;
export const COL_BLACK      = 0x000000;

// Physics
export const HELI_SPD   = 3.5;
export const BOMB_SPD   = 3.5;
export const SCROLL_BASE = 1.4;  // px/frame at level 1
export const LEVEL_DIST  = 5500; // scroll-pixels per level
export const TOTAL_LEVELS = 9;

// Scoring
export const COMBO_WINDOW = 90; // frames

// Bombs available per level (index = level number; 0 = no bomb limit displayed)
export const BOMBS_PER_LEVEL: ReadonlyArray<number> = [0, 96, 96, 80, 0, 0, 0, 80, 72, 90];

// Power-ups
export const POWER_SPAWN_CHANCE = 0.5;
export const POWER_TYPES = ['BOMBS', 'SHIELD', '2X'] as const;
export type PowerType = typeof POWER_TYPES[number];

// Helicopter model definitions
export interface HeliModel {
  id: number;
  name: string;
  desc: string;
  scale: number;
  speedMult: number;
  hitMult: number;
}

export const HELI_MODELS: readonly HeliModel[] = [
  { id: 0, name: 'SCOUT',   desc: 'Fast · Light',         scale: 0.72, speedMult: 1.35, hitMult: 0.72 },
  { id: 1, name: 'ASSAULT', desc: 'Balanced',              scale: 1.00, speedMult: 1.00, hitMult: 1.00 },
  { id: 2, name: 'GUNSHIP', desc: 'Heavy · Dual-drop',     scale: 1.42, speedMult: 0.70, hitMult: 1.42 },
];

// Building score values
export const BUILDING_SCORES = {
  fuel:    400,
  radar:   350,
  bunker:  600,
  building: 150, // multiplied by layer count
} as const;

// Level hints shown on transition screen
export const LEVEL_HINTS: Record<number, string> = {
  1: 'BOMB THE BUILDINGS',
  2: 'AVOID THE BARRIERS — -200 PTS PER HIT',
  3: 'INCOMING MISSILES — DODGE OR LOSE 200 PTS',
  4: 'SHOOT THE BALLOONS — SPACE TO FIRE',
  5: 'NAVIGATE THE CAVE — SHOOT TO CLEAR A PATH',
  6: 'ENEMY HELIS INCOMING — SHOOT THEM DOWN FOR +300',
  7: 'STORM INCOMING — TURBULENCE + MISSILES',
  8: 'MINEFIELD — BOMB THE MINES FOR +400, AVOID THEM',
  9: 'NAVAL STRIKE — SINK THE FLEET, DODGE THEIR MISSILES',
};

// Enemy helicopter definitions
export interface EnemyHeliDef {
  type: 'scout' | 'assault' | 'gunship';
  hp: number;
  points: number;
  scale: number;
  spd: number;
  fireRate: number; // frames between shots
}

export const ENEMY_HELI_DEFS: Record<string, EnemyHeliDef> = {
  scout:   { type: 'scout',   hp: 1, points: 400, scale: 0.72, spd: 2.8, fireRate: 90  },
  assault: { type: 'assault', hp: 2, points: 300, scale: 1.00, spd: 2.0, fireRate: 110 },
  gunship: { type: 'gunship', hp: 3, points: 500, scale: 1.42, spd: 1.4, fireRate: 130 },
};

// Ship definitions (Level 9)
export interface ShipDef {
  w: number;
  h: number;
  hp: number;
  launcher: boolean;
  label: string;
  points: number;
}

export const SHIP_DEFS: Record<string, ShipDef> = {
  destroyer: { w: 120, h: 26, hp: 2, launcher: true,  label: 'DESTROYER', points: 300 },
  cruiser:   { w: 150, h: 30, hp: 3, launcher: true,  label: 'CRUISER',   points: 450 },
  cargo:     { w: 170, h: 32, hp: 2, launcher: false, label: 'CARGO',     points: 200 },
  carrier:   { w: 220, h: 24, hp: 4, launcher: true,  label: 'CARRIER',   points: 700 },
};

// Obstacle constants (Level 2)
export const OBS_W    = 18;
export const OBS_GAP  = 110;
export const OBS_SPD  = 3.2;

// Ground missile constants (Level 3)
export const MSL_SPD      = 4.2;
export const MSL_HIT_DIST = 20;
export const LAUNCHER_POSITIONS = [120, 310, 520, 700, 860];

// Forward missile (player, Levels 4+6)
export const FWD_MSL_SPD = 9.0;

// Balloon constants (Level 4)
export const BALLOON_COUNT = 6;
export const BIRD_COUNT    = 4;

// Cave constants (Level 5)
export const CAVE_SCROLL_SPD = 2.8;

// Storm constants (Level 7)
export const STORM_MSL_SPD = 5.8;

// Mine constants (Level 8)
export const MINE_R   = 14;
export const MINE_HIT = 18;

// Sea missile constants (Level 9)
export const SEA_MSL_SPD = 7.2;
