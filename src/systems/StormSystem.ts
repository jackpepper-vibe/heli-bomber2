import * as PIXI from 'pixi.js';
import { W, H, GROUND_Y } from '../utils/constants';
import { clamp, randRange } from '../utils/math';

export class StormSystem {
  readonly container: PIXI.Container;
  private readonly gfx: PIXI.Graphics;

  windX = 0;
  windY = 0;
  private windTimer = 0;
  private flashTimer = 0;
  private lightningTimer = 0;

  constructor() {
    this.container = new PIXI.Container();
    this.gfx = new PIXI.Graphics();
    this.container.addChild(this.gfx);
  }

  init(): void {
    this.windX = 0; this.windY = 0; this.windTimer = 0;
    this.flashTimer = 0; this.lightningTimer = 60;
  }

  update(): void {
    // Wind changes direction periodically
    if (--this.windTimer <= 0) {
      this.windX = randRange(-1.8, 1.8);
      this.windY = randRange(-0.8, 0.8);
      this.windTimer = 80 + Math.floor(Math.random() * 60);
    }
    if (this.flashTimer > 0) this.flashTimer--;
    if (--this.lightningTimer <= 0) {
      this.flashTimer = 8;
      this.lightningTimer = 120 + Math.floor(Math.random() * 180);
    }
  }

  /** Apply wind force to helicopter position */
  applyWind(heliX: number, heliY: number): { x: number; y: number } {
    return {
      x: clamp(heliX + this.windX, 45, W - 45),
      y: clamp(heliY + this.windY, 36, GROUND_Y - 30),
    };
  }

  draw(): void {
    const g = this.gfx;
    g.clear();

    // Rain streaks
    const now = Date.now();
    for (let i = 0; i < 60; i++) {
      const x = ((i * 137 + now * 0.15) % W);
      const y = ((i * 89  + now * 0.3)  % GROUND_Y);
      g.moveTo(x, y).lineTo(x + this.windX * 4 - 1, y + 14)
       .stroke({ width: 0.8, color: 0x88bbff, alpha: 0.18 });
    }

    // Lightning flash overlay
    if (this.flashTimer > 0) {
      const a = (this.flashTimer / 8) * 0.35;
      g.rect(0, 0, W, H).fill({ color: 0xaaccff, alpha: a });
    }

    // Storm vignette edges
    g.rect(0, 0, 40, H).fill({ color: 0x000820, alpha: 0.25 });
    g.rect(W - 40, 0, 40, H).fill({ color: 0x000820, alpha: 0.25 });
    g.rect(0, 0, W, 30).fill({ color: 0x000820, alpha: 0.2 });
  }
}
