import * as PIXI from 'pixi.js';
import { GROUND_Y, W, MINE_R, MINE_HIT } from '../utils/constants';
import { dist, blinkMs } from '../utils/math';
import type { BombData } from './Bomb';

export interface MineData {
  x: number;
  y: number;
  phase: number;
  hp: number;
  active: boolean;
}

export function seedMines(): MineData[] {
  const mines: MineData[] = [];
  for (let i = 0; i < 14; i++) {
    mines.push({
      x: 200 + i * 90 + Math.random() * 60,
      y: GROUND_Y - 20 - Math.random() * (GROUND_Y * 0.45),
      phase: Math.random() * Math.PI * 2,
      hp: 1,
      active: true,
    });
  }
  return mines;
}

export function updateMines(
  mines: MineData[], spd: number,
): { mines: MineData[]; spawnNew: boolean } {
  for (const m of mines) {
    m.x -= spd;
    m.phase += 0.02;
  }
  const filtered = mines.filter(m => m.x + MINE_R > -20 && m.active);
  const last = filtered[filtered.length - 1];
  const spawnNew = !last || last.x < W + 60;
  return { mines: filtered, spawnNew };
}

export function checkBombHitMine(bomb: BombData, mine: MineData): boolean {
  if (!mine.active) return false;
  return dist(bomb.x, bomb.y, mine.x, mine.y) < MINE_R + 6;
}

export function checkHeliHitMine(mine: MineData, hx: number, hy: number, hitMult: number): boolean {
  if (!mine.active) return false;
  return dist(mine.x, mine.y, hx, hy) < MINE_HIT * hitMult;
}

export class MineRenderer {
  readonly container: PIXI.Container;
  private readonly gfx: PIXI.Graphics;

  constructor() {
    this.container = new PIXI.Container();
    this.gfx = new PIXI.Graphics();
    this.container.addChild(this.gfx);
  }

  draw(mines: MineData[]): void {
    const g = this.gfx;
    g.clear();

    for (const m of mines) {
      if (!m.active) continue;
      const bob = Math.sin(m.phase) * 2;
      const cx = m.x, cy = m.y + bob;
      const r = MINE_R;

      // Body
      g.circle(cx, cy, r).fill(0x002800).stroke({ width: 1.5, color: 0x00cc44 });

      // Spikes (8 directions)
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const sx = cx + Math.cos(a) * r, sy = cy + Math.sin(a) * r;
        const ex = cx + Math.cos(a) * (r + 6), ey = cy + Math.sin(a) * (r + 6);
        g.moveTo(sx, sy).lineTo(ex, ey).stroke({ width: 1.5, color: 0x00ff88 });
        g.circle(ex, ey, 2).fill(0x00ff88);
      }

      // Blinking center
      if (blinkMs(400)) {
        g.circle(cx, cy, 4).fill({ color: 0x00ffaa, alpha: 0.9 });
      } else {
        g.circle(cx, cy, 4).fill({ color: 0x004a10, alpha: 0.5 });
      }

      // Mooring cable
      g.moveTo(cx, cy + r).lineTo(cx + Math.sin(m.phase) * 4, GROUND_Y)
       .stroke({ width: 0.8, color: 0x005a18 });
    }
  }
}
