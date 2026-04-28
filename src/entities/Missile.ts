import * as PIXI from 'pixi.js';
import {
  GROUND_Y, W, H,
  MSL_SPD, MSL_HIT_DIST, LAUNCHER_POSITIONS,
  FWD_MSL_SPD, COL_GREEN, COL_LT_GREEN,
  STORM_MSL_SPD,
} from '../utils/constants';
import { dist } from '../utils/math';

// ── Ground launcher missile (Level 3) ────────────────────────────────────────

export interface MissileData {
  x: number; y: number;
  vx: number; vy: number;
  angle: number;
}

export interface Launcher {
  x: number;
  cooldown: number;
  interval: number;
}

export function makeLaunchers(): Launcher[] {
  return LAUNCHER_POSITIONS.map(x => ({
    x,
    cooldown: 90 + Math.floor(Math.random() * 120),
    interval: 155 + Math.floor(Math.random() * 60),
  }));
}

export function resetLaunchers(launchers: Launcher[]): void {
  for (const l of launchers) {
    l.cooldown = 90 + Math.floor(Math.random() * 120);
    l.interval = 155 + Math.floor(Math.random() * 60);
  }
}

export function fireMissile(launcher: Launcher, heliX: number, heliY: number): MissileData {
  const sx = launcher.x, sy = GROUND_Y - 22;
  const dx = heliX - sx, dy = heliY - sy;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  return {
    x: sx, y: sy,
    vx: (dx / d) * MSL_SPD,
    vy: (dy / d) * MSL_SPD,
    angle: Math.atan2(dy, dx),
  };
}

export function updateMissiles(
  missiles: MissileData[], launchers: Launcher[],
  heliX: number, heliY: number, hitMult: number,
  onHit: (m: MissileData) => 'kill' | 'absorb',
  onFire: () => void,
): MissileData[] {
  for (const l of launchers) {
    if (--l.cooldown <= 0) {
      missiles.push(fireMissile(l, heliX, heliY));
      l.cooldown = l.interval;
      onFire();
    }
  }

  return missiles.filter(m => {
    m.x += m.vx; m.y += m.vy;
    if (m.x < -30 || m.x > W + 30 || m.y < -30 || m.y > GROUND_Y + 10) return false;
    if (dist(m.x, m.y, heliX, heliY) < MSL_HIT_DIST * hitMult) {
      return onHit(m) !== 'kill';
    }
    return true;
  });
}

// ── Forward missile (player-fired, Levels 4+6) ────────────────────────────────

export interface FwdMissileData {
  x: number; y: number;
  vx: number; vy: number;
}

export function fireFwdMissile(heliX: number, heliY: number): FwdMissileData {
  return { x: heliX + 65, y: heliY, vx: FWD_MSL_SPD, vy: 0 };
}

export function updateFwdMissiles(
  missiles: FwdMissileData[],
  onTarget: (m: FwdMissileData) => boolean,
): FwdMissileData[] {
  return missiles.filter(m => {
    m.x += m.vx; m.y += m.vy;
    if (m.x > W + 20 || m.y < -20 || m.y > H + 20) return false;
    return !onTarget(m);
  });
}

// ── Storm missiles (Level 7) ──────────────────────────────────────────────────

export function fireStormMissile(heliX: number, heliY: number): MissileData {
  // Fires from a random edge
  const side = Math.floor(Math.random() * 3);
  let sx: number, sy: number;
  if (side === 0) { sx = W + 20; sy = 60 + Math.random() * (GROUND_Y - 120); }
  else if (side === 1) { sx = -20; sy = 60 + Math.random() * (GROUND_Y - 120); }
  else { sx = Math.random() * W; sy = -20; }
  const dx = heliX - sx, dy = heliY - sy;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  return {
    x: sx, y: sy,
    vx: (dx / d) * STORM_MSL_SPD,
    vy: (dy / d) * STORM_MSL_SPD,
    angle: Math.atan2(dy, dx),
  };
}

export function updateStormMissiles(
  missiles: MissileData[], heliX: number, heliY: number, hitMult: number,
  onHit: (m: MissileData) => 'kill' | 'absorb',
): MissileData[] {
  return missiles.filter(m => {
    m.x += m.vx; m.y += m.vy;
    if (m.x < -40 || m.x > W + 40 || m.y < -40 || m.y > H + 20) return false;
    if (dist(m.x, m.y, heliX, heliY) < MSL_HIT_DIST * hitMult) {
      return onHit(m) !== 'kill';
    }
    return true;
  });
}

// ── Renderer ─────────────────────────────────────────────────────────────────

export class MissileRenderer {
  readonly container: PIXI.Container;
  private readonly gfx: PIXI.Graphics;

  constructor() {
    this.container = new PIXI.Container();
    this.gfx = new PIXI.Graphics();
    this.container.addChild(this.gfx);
  }

  draw(missiles: MissileData[], launchers: Launcher[], fwdMissiles: FwdMissileData[], level: number): void {
    const g = this.gfx;
    g.clear();

    if (level === 3) this._drawLaunchers(g, launchers);

    for (const m of missiles) this._drawMissile(g, m);
    for (const m of fwdMissiles) this._drawFwdMissile(g, m);
  }

  private _drawLaunchers(g: PIXI.Graphics, launchers: Launcher[]): void {
    for (const l of launchers) {
      const bx = l.x, by = GROUND_Y;
      // Base platform
      g.rect(bx - 24, by - 10, 48, 10).fill(0x005a18).stroke({ width: 1, color: COL_GREEN });
      // Turret
      g.rect(bx - 12, by - 24, 24, 16).fill(0x005a18).stroke({ width: 1, color: COL_GREEN });
      // Barrel (just pointing up-ish, angle is handled in real rendering by atan2 of heli pos)
      g.moveTo(bx, by - 20).lineTo(bx + 20, by - 30).stroke({ width: 4, color: COL_GREEN });
      // Blinking ready light
      if (Math.floor(Date.now() / 400) % 2 === 0) {
        g.circle(bx + 10, by - 16, 3).fill(COL_GREEN);
      }
      // Wheels
      for (const wx of [bx - 18, bx, bx + 18]) {
        g.circle(wx, by - 1, 5).stroke({ width: 1, color: COL_GREEN });
      }
    }
  }

  private _drawMissile(g: PIXI.Graphics, m: MissileData): void {
    // Green exhaust trail
    g.moveTo(m.x, m.y)
     .lineTo(m.x - Math.cos(m.angle) * 16, m.y - Math.sin(m.angle) * 16)
     .stroke({ width: 3, color: 0x005a18, alpha: 0.45 });

    // Body rotated by angle
    const c = Math.cos(m.angle), s = Math.sin(m.angle);
    const tip = (dx: number, dy: number) => [m.x + c * dx - s * dy, m.y + s * dx + c * dy] as const;
    const [nx, ny] = tip(-12, 0);
    const [bx1, by1] = tip(4, -3);
    const [bx2, by2] = tip(4, 3);
    g.poly([nx, ny, bx1, by1, bx2, by2]).fill(COL_GREEN);
    g.circle(...tip(-11, 0), 1.5).fill(COL_LT_GREEN);
    // Fins
    const [f1x, f1y] = tip(4, -3), [f2x, f2y] = tip(10, -8), [f3x, f3y] = tip(7, -3);
    const [f4x, f4y] = tip(4, 3),  [f5x, f5y] = tip(10, 8),  [f6x, f6y] = tip(7, 3);
    g.poly([f1x, f1y, f2x, f2y, f3x, f3y]).fill(0x005a18).stroke({ width: 0.5, color: COL_GREEN });
    g.poly([f4x, f4y, f5x, f5y, f6x, f6y]).fill(0x005a18).stroke({ width: 0.5, color: COL_GREEN });
  }

  private _drawFwdMissile(g: PIXI.Graphics, m: FwdMissileData): void {
    // Simple horizontal rocket
    g.poly([m.x + 10, m.y, m.x - 4, m.y - 3, m.x - 4, m.y + 3]).fill(0xffff44);
    g.rect(m.x - 10, m.y - 2, 6, 4).fill(0xff6600);
    // Exhaust
    g.moveTo(m.x - 10, m.y).lineTo(m.x - 22, m.y).stroke({ width: 2, color: 0xff6600, alpha: 0.6 });
  }
}
