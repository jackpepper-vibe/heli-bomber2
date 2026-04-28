import * as PIXI from 'pixi.js';
import { GROUND_Y, COL_GREEN, COL_LT_GREEN } from '../utils/constants';
import { randRange } from '../utils/math';

interface Spark {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxL: number;
}

interface Debris {
  x: number; y: number;
  vx: number; vy: number;
  w: number; h: number;
  angle: number; avel: number;
  alpha: number;
  color: number;
}

interface Explosion {
  x: number; y: number;
  frame: number; maxFrame: number;
  size: number;
}

interface ScorePopup {
  x: number; y: number;
  text: string; color: number;
  alpha: number; vy: number;
}

export class ParticleSystem {
  readonly container: PIXI.Container;
  private readonly gfx: PIXI.Graphics;

  private sparks: Spark[] = [];
  private debrisArr: Debris[] = [];
  private explosions: Explosion[] = [];
  private popups: ScorePopup[] = [];

  constructor() {
    this.container = new PIXI.Container();
    this.gfx = new PIXI.Graphics();
    this.container.addChild(this.gfx);
  }

  spawnSparks(x: number, y: number, count = 24): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 2 + Math.random() * 5.5;
      this.sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 24, maxL: 24 });
    }
  }

  spawnExplosion(x: number, y: number, size = 1): void {
    this.explosions.push({ x, y, frame: 0, maxFrame: 28, size });
    this.spawnSparks(x, y);
    if (size > 1.0) this.spawnSparks(x, y);
    const nDebris = Math.round(3 + size * 4);
    for (let i = 0; i < nDebris; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd   = 2 + Math.random() * 5 * size;
      const r = Math.random();
      const color = r > 0.4 ? COL_GREEN : r > 0.5 ? COL_LT_GREEN : 0x004010;
      this.debrisArr.push({
        x, y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - 2,
        w: 4 + Math.random() * 10 * size | 0,
        h: 3 + Math.random() * 7  * size | 0,
        angle: Math.random() * Math.PI * 2,
        avel: (Math.random() - 0.5) * 0.2,
        alpha: 1,
        color,
      });
    }
  }

  addScorePopup(x: number, y: number, text: string, color = COL_GREEN): void {
    this.popups.push({ x, y, text, color, alpha: 1.0, vy: -1.4 });
  }

  update(): void {
    // Sparks
    this.sparks = this.sparks.filter(s => {
      s.x += s.vx; s.y += s.vy; s.vy += 0.18;
      return --s.life > 0;
    });

    // Debris
    this.debrisArr = this.debrisArr.filter(d => {
      d.x += d.vx; d.y += d.vy; d.vy += 0.28;
      d.angle += d.avel; d.vx *= 0.97;
      if (d.y > GROUND_Y) { d.y = GROUND_Y; d.vy *= -0.25; d.vx *= 0.7; }
      d.alpha -= 0.022;
      return d.alpha > 0;
    });

    // Explosions
    this.explosions = this.explosions.filter(e => ++e.frame < e.maxFrame);

    // Popups
    this.popups = this.popups.filter(p => { p.y += p.vy; p.alpha -= 0.018; return p.alpha > 0; });
  }

  draw(): void {
    const g = this.gfx;
    g.clear();

    // Sparks
    for (const s of this.sparks) {
      const a = s.life / s.maxL;
      g.moveTo(s.x, s.y).lineTo(s.x + s.vx * 3, s.y + s.vy * 3).stroke({ width: 1.5, color: COL_GREEN, alpha: a });
    }

    // Debris
    for (const d of this.debrisArr) {
      g.context.save();
      g.context.transform(
        Math.cos(d.angle), Math.sin(d.angle),
        -Math.sin(d.angle), Math.cos(d.angle),
        d.x, d.y
      );
      g.rect(-d.w / 2, -d.h / 2, d.w, d.h).fill({ color: d.color, alpha: d.alpha });
      g.context.restore();
    }

    // Explosions (drawn last so they appear on top)
    for (const e of this.explosions) {
      const t = e.frame / e.maxFrame;
      const s = e.size;
      const coreR = Math.max(0.1, 22 * s * (1 - t));
      const ringR = Math.max(0.1, 50 * s * t);

      // Core glow (approximated with two concentric fills)
      g.circle(e.x, e.y, coreR).fill({ color: 0xaaffcc, alpha: (1 - t) * 0.9 });
      g.circle(e.x, e.y, coreR * 0.5).fill({ color: 0xffffff, alpha: (1 - t) * 0.8 });

      // Expanding ring
      g.circle(e.x, e.y, ringR).stroke({ width: 2.5, color: COL_GREEN, alpha: (1 - t) * 0.55 });
      if (t > 0.15) {
        const ring2R = Math.max(0.1, 35 * s * (t - 0.15));
        g.circle(e.x, e.y, ring2R).stroke({ width: 1.5, color: COL_GREEN, alpha: (1 - t) * 0.3 });
      }
    }
  }

  drawPopups(): void {
    // Popups rendered via DOM-like approach would need a PIXI.Text —
    // we use a separate Text pool instead, managed here.
    // For performance, these are small so draw them in the same gfx.
    for (const p of this.popups) {
      const text = new PIXI.Text({
        text: p.text,
        style: {
          fontFamily: 'Courier New',
          fontSize: p.text.includes('COMBO') ? 14 : 11,
          fontWeight: 'bold',
          fill: p.color,
        },
      });
      text.alpha = p.alpha;
      text.anchor.set(0.5, 0.5);
      text.x = p.x;
      text.y = p.y;
      this.container.addChild(text);
      // Remove immediately — we re-add each frame (simple, acceptable for small counts)
      setTimeout(() => text.destroy(), 16);
    }
  }

  clear(): void {
    this.sparks = [];
    this.debrisArr = [];
    this.explosions = [];
    this.popups = [];
    this.gfx.clear();
  }

  get hasExplosions(): boolean { return this.explosions.length > 0; }

  /** Shake magnitude trigger — returns max blast radius for camera shake */
  getMaxExplosionSize(): number {
    let max = 0;
    for (const e of this.explosions) if (e.size > max) max = e.size;
    return max;
  }

  // Expose for combo popup drawing from GameScene
  spawnComboPopup(x: number, y: number, count: number, pts: number, is2x: boolean): void {
    const mult = count <= 1 ? 1 : count <= 3 ? 2 : count <= 6 ? 3 : 4;
    const label = mult > 1
      ? `COMBO x${mult}${is2x ? ' [2X]' : ''}! +${pts}`
      : is2x ? `[2X] +${pts}` : `+${pts}`;
    const color = mult > 1 ? 0xffff44 : is2x ? 0xffaa00 : COL_LT_GREEN;
    this.addScorePopup(x, y - 10, label, color);
  }

  // Water splash particles (Level 9)
  spawnSplash(x: number): void {
    for (let i = 0; i < 6; i++) {
      this.sparks.push({
        x: x + randRange(-5, 5),
        y: GROUND_Y - 2,
        vx: randRange(-1.5, 1.5),
        vy: randRange(-3.5, -1.5),
        life: 18, maxL: 18,
      });
    }
  }
}
