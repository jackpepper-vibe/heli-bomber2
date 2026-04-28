import * as PIXI from 'pixi.js';
import { BOMB_SPD, GROUND_Y, COL_GREEN } from '../utils/constants';

export interface BombData {
  x: number;
  y: number;
}

export class BombRenderer {
  readonly container: PIXI.Container;
  private readonly gfx: PIXI.Graphics;

  constructor() {
    this.container = new PIXI.Container();
    this.gfx = new PIXI.Graphics();
    this.container.addChild(this.gfx);
  }

  draw(bombs: BombData[]): void {
    const g = this.gfx;
    g.clear();
    for (const bm of bombs) {
      // Scale 0.5 applied via transforms — approximate here
      const x = bm.x, y = bm.y;
      const s = 0.5;
      // Nose cone
      g.poly([x - 4 * s, y - 4 * s, x, y - 11 * s, x + 4 * s, y - 4 * s]).fill(COL_GREEN);
      // Body
      g.ellipse(x, y + 4 * s, 4 * s, 8 * s).fill(COL_GREEN);
      // Tail fins
      g.poly([x - 4 * s, y + 11 * s, x - 9 * s, y + 18 * s, x + 9 * s, y + 18 * s, x + 4 * s, y + 11 * s])
       .fill(COL_GREEN);
    }
  }
}

export function updateBombs(bombs: BombData[]): BombData[] {
  return bombs.filter(bm => {
    bm.y += BOMB_SPD;
    return bm.y <= GROUND_Y + 10;
  });
}

export function spawnBomb(x: number, y: number): BombData {
  return { x, y };
}
