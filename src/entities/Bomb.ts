import * as PIXI from 'pixi.js';
import { BOMB_SPD, GROUND_Y } from '../utils/constants';

export class BombData {
  x = 0;
  y = 0;

  reset(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }
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
      const x = bm.x, y = bm.y;
      const s = 0.5;
      // Nose cone — orange
      g.poly([x - 4 * s, y - 4 * s, x, y - 11 * s, x + 4 * s, y - 4 * s]).fill(0xff8800);
      // Body — dark grey with orange tint
      g.ellipse(x, y + 4 * s, 4 * s, 8 * s).fill(0xcc5500);
      // Tail fins
      g.poly([x - 4 * s, y + 11 * s, x - 9 * s, y + 18 * s, x + 9 * s, y + 18 * s, x + 4 * s, y + 11 * s])
       .fill(0xaa4400);
      // Glint
      g.rect(x - 1 * s, y - 9 * s, 1.5 * s, 3 * s).fill({ color: 0xffd080, alpha: 0.7 });
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
  const b = new BombData();
  b.reset(x, y);
  return b;
}
