import * as PIXI from 'pixi.js';
import { W, H, GROUND_Y, ENEMY_HELI_DEFS } from '../utils/constants';
import { dist } from '../utils/math';
import type { EnemyHeliDef } from '../utils/constants';

export interface EnemyHeliData {
  x: number; y: number;
  vx: number; vy: number;
  hp: number; maxHp: number;
  type: string;
  def: EnemyHeliDef;
  rotorA: number;
  fireTimer: number;
  points: number;
  phase: number;
}

export interface EnemyMissileData {
  x: number; y: number;
  vx: number; vy: number;
  angle: number;
}

const TYPES = ['scout', 'assault', 'gunship'];

export function seedEnemyHelis(): EnemyHeliData[] {
  const helis: EnemyHeliData[] = [];
  const count = 5 + Math.floor(Math.random() * 4);
  for (let i = 0; i < count; i++) {
    const type = TYPES[Math.floor(Math.random() * TYPES.length)];
    const def = ENEMY_HELI_DEFS[type];
    helis.push({
      x: W + 80 + i * 220 + Math.random() * 100,
      y: 60 + Math.random() * (GROUND_Y - 160),
      vx: -(def.spd + Math.random() * 0.8),
      vy: (Math.random() - 0.5) * 0.6,
      hp: def.hp, maxHp: def.hp,
      type, def,
      rotorA: Math.random() * Math.PI * 2,
      fireTimer: def.fireRate + Math.floor(Math.random() * 40),
      points: def.points,
      phase: Math.random() * Math.PI * 2,
    });
  }
  return helis;
}

export function updateEnemyHelis(
  helis: EnemyHeliData[],
  missiles: EnemyMissileData[],
  heliX: number, heliY: number,
  onFire: () => void,
): EnemyHeliData[] {
  return helis.filter(e => {
    e.rotorA += 0.22;
    e.phase += 0.018;
    e.x += e.vx;
    e.y += Math.sin(e.phase) * 0.6 + e.vy;

    // Bounce vertically within play area
    if (e.y < 40 || e.y > GROUND_Y - 60) e.vy *= -1;
    e.y = Math.max(40, Math.min(e.y, GROUND_Y - 60));

    // Cull when off-left
    if (e.x + 80 * e.def.scale < -20) return false;

    // Respawn off-right when depleted
    if (e.x < -80 * e.def.scale) {
      e.x = W + 80 + Math.random() * 200;
      e.y = 60 + Math.random() * (GROUND_Y - 160);
    }

    // Fire missile at player
    if (--e.fireTimer <= 0) {
      e.fireTimer = e.def.fireRate + Math.floor(Math.random() * 40);
      const dx = heliX - e.x, dy = heliY - e.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const spd = 5.5;
      missiles.push({
        x: e.x, y: e.y,
        vx: (dx / d) * spd, vy: (dy / d) * spd,
        angle: Math.atan2(dy, dx),
      });
      onFire();
    }

    return true;
  });
}

export function updateEnemyMissiles(
  missiles: EnemyMissileData[], heliX: number, heliY: number, hitMult: number,
  onHit: (m: EnemyMissileData) => 'kill' | 'absorb',
): EnemyMissileData[] {
  return missiles.filter(m => {
    m.x += m.vx; m.y += m.vy;
    if (m.x < -30 || m.x > W + 30 || m.y < -30 || m.y > H + 10) return false;
    if (dist(m.x, m.y, heliX, heliY) < 22 * hitMult) {
      return onHit(m) !== 'kill';
    }
    return true;
  });
}

export function checkFwdMissileHit(
  e: EnemyHeliData, mx: number, my: number,
): boolean {
  return dist(mx, my, e.x, e.y) < 28 * e.def.scale;
}

export class EnemyHeliRenderer {
  readonly container: PIXI.Container;
  private readonly gfx: PIXI.Graphics;

  constructor() {
    this.container = new PIXI.Container();
    this.gfx = new PIXI.Graphics();
    this.container.addChild(this.gfx);
  }

  draw(helis: EnemyHeliData[], missiles: EnemyMissileData[]): void {
    const g = this.gfx;
    g.clear();
    for (const e of helis) this._drawHeli(g, e);
    for (const m of missiles) this._drawMissile(g, m);
  }

  private _drawHeli(g: PIXI.Graphics, e: EnemyHeliData): void {
    const cx = e.x, cy = e.y, s = e.def.scale, rotA = e.rotorA;

    // Enemy faces LEFT — tail is on the right (cx + 76*s), nose on the left (cx - 65*s)

    // ── Downwash glow ──────────────────────────────────────────────────────
    g.ellipse(cx, cy + 28 * s, 42 * s, 14 * s).fill({ color: 0xff2200, alpha: 0.04 });

    // ── Rotor disc glow ────────────────────────────────────────────────────
    g.circle(cx, cy - 22 * s, 62 * s).fill({ color: 0xff3300, alpha: 0.04 });
    g.circle(cx, cy - 22 * s, 50 * s).fill({ color: 0xff3300, alpha: 0.05 });

    // ── Rotor mast ─────────────────────────────────────────────────────────
    g.moveTo(cx, cy - 12 * s).lineTo(cx, cy - 22 * s)
     .stroke({ width: 2.5 * s, color: 0xff5500 });

    // ── Rotor hub ──────────────────────────────────────────────────────────
    g.circle(cx, cy - 22 * s, 4 * s).fill(0xff2200);
    g.circle(cx, cy - 22 * s, 2.5 * s).fill(0xff6600);

    // ── Main rotor blades (3 ghost layers for motion blur) ─────────────────
    const rotorPulse = 0.7 + 0.25 * Math.sin(rotA * 8);
    for (let ghost = 2; ghost >= 0; ghost--) {
      const alpha = ghost === 0 ? rotorPulse : 0.15 * (3 - ghost);
      const width = ghost === 0 ? 3.5 * s : 2 * s;
      const offset = Math.PI * 0.12 * ghost;
      const bx = Math.cos(rotA + offset) * 58 * s;
      const by = Math.sin(rotA + offset) * 58 * s;
      g.moveTo(cx - bx, cy - 22 * s - by).lineTo(cx + bx, cy - 22 * s + by)
       .stroke({ width, color: ghost === 0 ? 0xff5500 : 0xff3300, alpha });
      g.moveTo(cx - by, cy - 22 * s + bx).lineTo(cx + by, cy - 22 * s - bx)
       .stroke({ width: width * 0.8, color: 0xff3300, alpha: alpha * 0.65 });
    }

    // ── Tail boom (right side — mirrored from player) ──────────────────────
    g.poly([cx + 38 * s, cy - 2 * s, cx + 76 * s, cy - 0.5 * s,
            cx + 76 * s, cy + 5 * s,  cx + 38 * s, cy + 8 * s])
     .fill(0x1a0000).stroke({ width: 1.2 * s, color: 0xff3300 });

    // ── Vertical tail fin ──────────────────────────────────────────────────
    g.poly([cx + 76 * s, cy + 6 * s, cx + 76 * s, cy - 22 * s,
            cx + 68 * s, cy - 22 * s, cx + 65 * s, cy + 3 * s])
     .fill(0x150000).stroke({ width: 1 * s, color: 0xff3300 });

    // ── Tail rotor hub ─────────────────────────────────────────────────────
    g.circle(cx + 76 * s, cy - 6 * s, 2.5 * s).fill(0xff4400);

    // ── Tail rotor blades ──────────────────────────────────────────────────
    for (let ghost = 1; ghost >= 0; ghost--) {
      const ga = rotA * 1.8 - ghost * 0.3;
      const alpha = ghost === 0 ? 0.9 : 0.22;
      const tx = cx + 76 * s, ty = cy - 6 * s;
      const c = Math.cos(ga), ss = Math.sin(ga);
      const r = 13 * s;
      g.moveTo(tx - c * r, ty - ss * r).lineTo(tx + c * r, ty + ss * r)
       .stroke({ width: 1.6 * s, color: 0xff3300, alpha });
      g.moveTo(tx - ss * r, ty + c * r).lineTo(tx + ss * r, ty - c * r)
       .stroke({ width: 1.6 * s, color: 0xff3300, alpha: alpha * 0.7 });
    }

    // ── Fuselage (depth + main) ────────────────────────────────────────────
    g.roundRect(cx - 38 * s, cy - 11 * s, 76 * s, 24 * s, 5 * s).fill(0x0a0000);
    g.roundRect(cx - 38 * s, cy - 12 * s, 76 * s, 24 * s, 5 * s)
     .fill(0x1a0000).stroke({ width: 1.5 * s, color: 0xff3300 });

    // ── Panel lines ────────────────────────────────────────────────────────
    g.moveTo(cx + 18 * s, cy - 12 * s).lineTo(cx + 18 * s, cy + 12 * s)
     .moveTo(cx - 10 * s, cy - 12 * s).lineTo(cx - 10 * s, cy + 12 * s)
     .stroke({ width: 0.8 * s, color: 0x660000, alpha: 0.6 });

    // ── Cockpit nose (facing left) ─────────────────────────────────────────
    g.poly([cx - 38 * s, cy - 12 * s, cx - 66 * s, cy + 1 * s, cx - 38 * s, cy + 12 * s])
     .fill(0x100000).stroke({ width: 1.5 * s, color: 0xff3300 });

    // ── Cockpit window (red glow) ──────────────────────────────────────────
    g.rect(cx - 53 * s, cy - 8 * s, 14 * s, 12 * s).fill({ color: 0xff3300, alpha: 0.9 });
    g.rect(cx - 53 * s, cy - 8 * s, 16 * s, 14 * s).fill({ color: 0xff2200, alpha: 0.12 });
    g.rect(cx - 52 * s, cy - 7 * s, 5 * s, 2.5 * s).fill({ color: 0xff8800, alpha: 0.5 });

    // ── Landing skids ──────────────────────────────────────────────────────
    g.moveTo(cx - 22 * s, cy + 12 * s).lineTo(cx - 24 * s, cy + 25 * s)
     .moveTo(cx + 12 * s, cy + 12 * s).lineTo(cx + 14 * s, cy + 25 * s)
     .moveTo(cx - 30 * s, cy + 25 * s).lineTo(cx + 22 * s, cy + 25 * s)
     .stroke({ width: 1.5 * s, color: 0xff3300 });

    // ── HP damage tint ─────────────────────────────────────────────────────
    if (e.hp < e.maxHp) {
      const dmg = 1 - e.hp / e.maxHp;
      g.circle(cx, cy, 20 * s).fill({ color: 0xff4400, alpha: dmg * 0.35 });
    }
  }

  private _drawMissile(g: PIXI.Graphics, m: EnemyMissileData): void {
    g.moveTo(m.x, m.y)
     .lineTo(m.x - Math.cos(m.angle) * 10, m.y - Math.sin(m.angle) * 10)
     .stroke({ width: 2, color: 0xff6600, alpha: 0.5 });
    g.circle(m.x, m.y, 3).fill(0xffdd44);
  }
}
