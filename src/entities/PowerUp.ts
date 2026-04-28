import * as PIXI from 'pixi.js';
import { COL_GREEN, POWER_TYPES, POWER_SPAWN_CHANCE } from '../utils/constants';
import type { PowerType } from '../utils/constants';

export interface PowerUpData {
  x: number;
  y: number;
  type: PowerType;
  vy: number;
  phase: number;
}

export interface ActivePowers {
  shield: number;   // frames remaining
  score2x: number;  // frames remaining
}

export function maybeSpawnPowerUp(x: number, y: number): PowerUpData | null {
  if (Math.random() > POWER_SPAWN_CHANCE) return null;
  const type = POWER_TYPES[Math.floor(Math.random() * POWER_TYPES.length)];
  return { x, y, type, vy: -4.5, phase: Math.random() * Math.PI * 2 };
}

export function updatePowerUps(pus: PowerUpData[], spd: number): PowerUpData[] {
  return pus.filter(p => {
    p.x -= spd * 0.5;
    p.y += p.vy;
    // Decelerate upward rise to a stop — no downward gravity so items float and wait
    if (p.vy < 0) p.vy = Math.min(0, p.vy + 0.09);
    if (p.y < 44) p.y = 44; // clamp to top of playfield
    p.phase += 0.04;
    return p.x > -30; // only removed when scrolled off the left edge
  });
}

export function checkPowerUpCollect(
  pus: PowerUpData[], hx: number, hy: number, radius = 28,
): { remaining: PowerUpData[]; collected: PowerUpData[] } {
  const remaining: PowerUpData[] = [];
  const collected: PowerUpData[] = [];
  const r2 = radius * radius;
  for (const p of pus) {
    const dx = p.x - hx, dy = p.y - hy;
    if (dx * dx + dy * dy < r2) collected.push(p);
    else remaining.push(p);
  }
  return { remaining, collected };
}

export function applyPowerUp(powers: ActivePowers, type: PowerType): number {
  switch (type) {
    case 'SHIELD': powers.shield  = Math.min(powers.shield  + 60 * 8,  60 * 16); return 0;
    case '2X':     powers.score2x = Math.min(powers.score2x + 60 * 12, 60 * 24); return 0;
    case 'BOMBS':  return 25; // return extra bombs count
    default:       return 0;
  }
}

export class PowerUpRenderer {
  readonly container: PIXI.Container;
  private readonly gfx: PIXI.Graphics;

  constructor() {
    this.container = new PIXI.Container();
    this.gfx = new PIXI.Graphics();
    this.container.addChild(this.gfx);
  }

  draw(pus: PowerUpData[], _powers: ActivePowers): void {
    const g = this.gfx;
    g.clear();

    for (const p of pus) {
      const bob = Math.sin(p.phase) * 3;
      const cx = p.x, cy = p.y + bob;
      const pulse = 0.7 + 0.3 * Math.sin(p.phase * 2);

      g.rect(cx - 12, cy - 10, 24, 20).fill({ color: 0x001a00, alpha: 0.9 })
       .stroke({ width: 1.5, color: COL_GREEN, alpha: pulse });

      // Type label drawn via separate text mechanism; here draw icon shapes
      if (p.type === 'SHIELD') {
        // Shield hexagon
        const r = 7;
        const pts: number[] = [];
        for (let i = 0; i < 6; i++) {
          pts.push(cx + Math.cos(i * Math.PI / 3 - Math.PI / 6) * r,
                   cy + Math.sin(i * Math.PI / 3 - Math.PI / 6) * r);
        }
        g.poly(pts).stroke({ width: 1.5, color: 0x66ddff, alpha: pulse });
      } else if (p.type === '2X') {
        // Two concentric circles
        g.circle(cx, cy, 7).stroke({ width: 1.5, color: 0xffff44, alpha: pulse });
        g.circle(cx, cy, 4).fill({ color: 0xffff44, alpha: pulse * 0.5 });
      } else {
        // BOMBS — downward triangle
        g.poly([cx, cy + 6, cx - 5, cy - 4, cx + 5, cy - 4]).fill({ color: COL_GREEN, alpha: pulse });
      }
    }

    // HUD power icons (upper-right) handled by HUD.ts
    // Shield aura is drawn by GameScene
  }

  drawActivePowerIcons(powers: ActivePowers, baseX: number, baseY: number): void {
    const g = this.gfx;
    let ox = baseX;

    if (powers.shield > 0) {
      const a = Math.min(1, powers.shield / (60 * 2));
      g.circle(ox, baseY, 8).fill({ color: 0x66ddff, alpha: a * 0.4 })
       .stroke({ width: 1.5, color: 0x66ddff, alpha: a });
      ox -= 28;
    }
    if (powers.score2x > 0) {
      const a = Math.min(1, powers.score2x / (60 * 2));
      g.circle(ox, baseY, 8).fill({ color: 0xffff44, alpha: a * 0.4 })
       .stroke({ width: 1.5, color: 0xffff44, alpha: a });
    }
  }
}
