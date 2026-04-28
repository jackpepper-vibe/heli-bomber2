import * as PIXI from 'pixi.js';
import { GROUND_Y, W, COL_GREEN, SHIP_DEFS, SEA_MSL_SPD } from '../utils/constants';
import { dist, blinkMs } from '../utils/math';
import type { ShipDef } from '../utils/constants';
import type { BombData } from './Bomb';

export type ShipType = 'destroyer' | 'cruiser' | 'cargo' | 'carrier';
const SHIP_TYPES: ShipType[] = ['destroyer', 'cruiser', 'cargo', 'carrier'];

export interface ShipData {
  x: number;
  y: number;
  w: number; h: number;
  type: ShipType;
  def: ShipDef;
  hp: number;
  maxHp: number;
  bob: number;
}

export interface SeaMissileData {
  x: number; y: number;
  vx: number; vy: number;
  angle: number;
  trail: Array<{ x: number; y: number }>;
}

export function mkShip(startX: number): ShipData {
  const type = SHIP_TYPES[Math.floor(Math.random() * SHIP_TYPES.length)];
  const def = SHIP_DEFS[type];
  return {
    x: startX, y: GROUND_Y - def.h + 4,
    w: def.w, h: def.h,
    type, def,
    hp: def.hp, maxHp: def.hp,
    bob: Math.random() * Math.PI * 2,
  };
}

export function seedShips(): ShipData[] {
  const ships: ShipData[] = [];
  let x = 260;
  for (let i = 0; i < 10; i++) {
    const s = mkShip(x);
    ships.push(s);
    x += s.w + 120 + (Math.random() * 120 | 0);
  }
  return ships;
}

export function updateShips(ships: ShipData[], spd: number): ShipData[] {
  for (const s of ships) {
    s.x -= spd;
    s.bob += 0.05;
  }
  const filtered = ships.filter(s => s.x + s.w > -20);
  const last = filtered[filtered.length - 1];
  if (!last || last.x + last.w < W + 200) {
    const nx = (last ? last.x + last.w : W + 80) + 140 + (Math.random() * 120 | 0);
    filtered.push(mkShip(nx));
  }
  return filtered;
}

export function fireSeaMissile(ship: ShipData, heliX: number, heliY: number): SeaMissileData {
  const sx = ship.x + ship.w * 0.5;
  const sy = ship.y - 4;
  const dx = heliX - sx, dy = heliY - sy;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  return {
    x: sx, y: sy,
    vx: (dx / d) * SEA_MSL_SPD,
    vy: (dy / d) * SEA_MSL_SPD,
    angle: Math.atan2(dy, dx),
    trail: [],
  };
}

export function updateSeaMissiles(
  missiles: SeaMissileData[], _ships: ShipData[],
  heliX: number, heliY: number, hitMult: number,
  onHit: (m: SeaMissileData) => 'kill' | 'absorb',
  onTimer: () => SeaMissileData | null,
): SeaMissileData[] {
  const newMissile = onTimer();
  if (newMissile) missiles.push(newMissile);

  return missiles.filter(m => {
    m.trail.push({ x: m.x, y: m.y });
    if (m.trail.length > 14) m.trail.shift();
    m.x += m.vx; m.y += m.vy;
    if (m.x < -30 || m.x > W + 30 || m.y < -40) return false;
    if (dist(m.x, m.y, heliX, heliY) < 22 * hitMult) {
      return onHit(m) !== 'kill';
    }
    return true;
  });
}

export function checkBombHitShip(bomb: BombData, ship: ShipData): boolean {
  const topY = ship.y + Math.sin(ship.bob) * 1.2;
  return bomb.x >= ship.x && bomb.x <= ship.x + ship.w &&
         bomb.y >= topY && bomb.y <= topY + ship.h + 4;
}

export class ShipRenderer {
  readonly container: PIXI.Container;
  private readonly gfx: PIXI.Graphics;

  constructor() {
    this.container = new PIXI.Container();
    this.gfx = new PIXI.Graphics();
    this.container.addChild(this.gfx);
  }

  draw(ships: ShipData[], missiles: SeaMissileData[]): void {
    const g = this.gfx;
    g.clear();
    for (const s of ships) this._drawShip(g, s);
    for (const m of missiles) this._drawMissile(g, m);
  }

  private _drawShip(g: PIXI.Graphics, s: ShipData): void {
    const bobY = Math.sin(s.bob) * 1.2;
    const x = s.x, y = s.y + bobY;

    // Hull trapezoid
    g.poly([x + 8, y + s.h, x + s.w - 8, y + s.h, x + s.w, y + s.h * 0.55, x, y + s.h * 0.55])
     .fill(0x0a1a1a).stroke({ width: 1.5, color: COL_GREEN });

    // Deck
    g.rect(x, y + s.h * 0.45, s.w, 4).fill(0x001a00);

    switch (s.type) {
      case 'destroyer':
        g.rect(x + s.w * 0.55, y + 8, 22, 16).fill(0x001a00).stroke({ width: 1, color: COL_GREEN });
        g.moveTo(x + s.w * 0.55 + 11, y + 8).lineTo(x + s.w * 0.55 + 11, y - 12)
         .stroke({ width: 1, color: COL_GREEN });
        g.rect(x + s.w * 0.22, y + 10, 16, 10).fill(0x002200).stroke({ width: 1, color: COL_GREEN });
        g.moveTo(x + s.w * 0.22 + 8, y + 15).lineTo(x + s.w * 0.22 + 8, y + 2)
         .stroke({ width: 1, color: COL_GREEN });
        break;
      case 'cruiser':
        g.rect(x + s.w * 0.48, y + 4, 30, 20).fill(0x001a00).stroke({ width: 1, color: COL_GREEN });
        g.moveTo(x + s.w * 0.48 + 8, y + 4).lineTo(x + s.w * 0.48 + 8, y - 16)
         .moveTo(x + s.w * 0.48 + 22, y + 4).lineTo(x + s.w * 0.48 + 22, y - 10)
         .stroke({ width: 1, color: COL_GREEN });
        for (let i = 0; i < 3; i++) {
          g.rect(x + s.w * 0.18 + i * 8, y + 8, 6, 14).fill(0x002200).stroke({ width: 1, color: COL_GREEN });
        }
        break;
      case 'cargo': {
        const cols = [0x003a10, 0x001a00, 0x002200];
        for (let i = 0; i < 6; i++) {
          g.rect(x + 14 + i * 22, y + 6, 20, 16).fill(cols[i % cols.length]).stroke({ width: 1, color: COL_GREEN });
        }
        g.rect(x + s.w - 26, y - 2, 18, 22).fill(0x001a00).stroke({ width: 1, color: COL_GREEN });
        break;
      }
      case 'carrier':
        g.rect(x + 6, y - 2, s.w - 12, 8).fill(0x001a00).stroke({ width: 1, color: COL_GREEN });
        g.rect(x + s.w * 0.70, y - 14, 18, 14).fill(0x002200).stroke({ width: 1, color: COL_GREEN });
        for (let i = 0; i < 4; i++) {
          g.moveTo(x + 20 + i * 40, y).lineTo(x + 28 + i * 40, y).stroke({ width: 1, color: 0x005a18 });
        }
        break;
    }

    // HP damage overlay
    if (s.hp < s.maxHp) {
      g.rect(x + s.w * 0.3, y + 4, s.w * 0.4, 8).fill({ color: 0xff5000, alpha: 0.35 });
    }

    // Launcher blinking light
    if (s.def.launcher && blinkMs(350)) {
      g.circle(x + s.w * 0.5, y - 4, 2.5).fill(0xff3300);
    }
  }

  private _drawMissile(g: PIXI.Graphics, m: SeaMissileData): void {
    // Trail
    for (let i = 0; i < m.trail.length; i++) {
      const t = m.trail[i];
      const a = (i / m.trail.length) * 0.6;
      const r = 2.2 * (i / m.trail.length + 0.3);
      g.circle(t.x, t.y, r).fill({ color: 0xffffff, alpha: a });
    }

    // Body
    const c = Math.cos(m.angle), s = Math.sin(m.angle);
    const tip = (dx: number, dy: number) => [m.x + c * dx - s * dy, m.y + s * dx + c * dy] as const;
    const [nx, ny] = tip(8, 0);
    const [bx1, by1] = tip(-4, -3);
    const [bx2, by2] = tip(-4, 3);
    g.poly([nx, ny, bx1, by1, bx2, by2]).fill(0xffdd44);
    g.rect(m.x - 8, m.y - 2, 4, 4).fill(0xff4400);
  }
}
