import * as PIXI from 'pixi.js';
import { GROUND_Y, COL_GREEN, COL_LT_GREEN } from '../utils/constants';
import { randRange } from '../utils/math';

interface Spark {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxL: number;
  color: number;
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

interface Smoke {
  x: number; y: number;
  r: number;
  vx: number; vy: number;
  life: number; maxL: number;
}

interface ScorePopup {
  node: PIXI.Text;
  startY: number;
  frame: number;
}

// Fire color gradient: 0=white, 0.3=yellow, 0.6=orange, 1=dark red
function fireColor(t: number): number {
  if (t < 0.25) {
    const f = t / 0.25;
    const r = 255, g = Math.round(255 - f * 55), b = Math.round(255 - f * 230);
    return (r << 16) | (g << 8) | b;
  }
  if (t < 0.55) {
    const f = (t - 0.25) / 0.3;
    const r = 255, g = Math.round(200 - f * 120), b = 0;
    return (r << 16) | (g << 8) | b;
  }
  const f = Math.min(1, (t - 0.55) / 0.45);
  const r = Math.round(255 - f * 120), g = Math.round(80 - f * 80), b = 0;
  return (r << 16) | (g << 8) | b;
}

export class ParticleSystem {
  readonly container: PIXI.Container;
  private readonly gfx: PIXI.Graphics;

  private sparks:      Spark[]      = [];
  private debrisArr:   Debris[]     = [];
  private explosions:  Explosion[]  = [];
  private smokeArr:    Smoke[]      = [];
  private popups:      ScorePopup[] = [];

  constructor() {
    this.container = new PIXI.Container();
    this.gfx = new PIXI.Graphics();
    this.container.addChild(this.gfx);
  }

  spawnSparks(x: number, y: number, count = 24, warm = false): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 2 + Math.random() * 6;
      const color = warm
        ? [0xffdd00, 0xff8800, 0xff4400][Math.floor(Math.random() * 3)]
        : COL_GREEN;
      this.sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.5,
        life: 22 + Math.random() * 14 | 0, maxL: 36, color });
    }
  }

  spawnExplosion(x: number, y: number, size = 1): void {
    this.explosions.push({ x, y, frame: 0, maxFrame: 32, size });

    // Fire sparks (warm)
    this.spawnSparks(x, y, Math.round(18 + size * 16), true);
    if (size > 1.2) this.spawnSparks(x, y, 20, true);

    // Smoke puffs
    const nSmoke = Math.round(3 + size * 5);
    for (let i = 0; i < nSmoke; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 0.6 + Math.random() * 1.4 * size;
      this.smokeArr.push({
        x: x + randRange(-8, 8), y: y + randRange(-4, 4),
        r: 5 + Math.random() * 10 * size,
        vx: Math.cos(a) * s * 0.4, vy: Math.sin(a) * s - 1.8,
        life: 0, maxL: 40 + Math.random() * 30 | 0,
      });
    }

    // Debris — mix of green (structural) and fire-hot
    const nDebris = Math.round(4 + size * 5);
    for (let i = 0; i < nDebris; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd   = 2.5 + Math.random() * 6 * size;
      const hot = Math.random() > 0.45;
      const color = hot
        ? [0xff8800, 0xffcc00, 0xff4400][Math.floor(Math.random() * 3)]
        : [COL_GREEN, COL_LT_GREEN, 0x004010][Math.floor(Math.random() * 3)];
      this.debrisArr.push({
        x, y,
        vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd - 2.5,
        w: 4 + Math.random() * 10 * size | 0,
        h: 3 + Math.random() * 7  * size | 0,
        angle: Math.random() * Math.PI * 2,
        avel: (Math.random() - 0.5) * 0.25,
        alpha: 1,
        color,
      });
    }
  }

  addScorePopup(x: number, y: number, message: string, color = COL_GREEN): void {
    const isCombo = message.includes('COMBO') || message.includes('x');
    const node = new PIXI.Text({
      text: message,
      style: {
        fontFamily: 'Courier New',
        fontSize: isCombo ? 16 : 13,
        fontWeight: 'bold',
        fill: color,
        stroke: { color: 0x000000, width: 3 },
      },
    });
    node.anchor.set(0.5, 1);
    node.x = x;
    const startY = (Number.isFinite(y) ? y : 240) - 24;
    node.y = startY;
    node.alpha = 1.0;
    this.container.addChild(node);
    this.popups.push({ node, startY, frame: 0 });
  }

  update(): void {
    // Sparks
    this.sparks = this.sparks.filter(s => {
      s.x += s.vx; s.y += s.vy; s.vy += 0.22; s.vx *= 0.97;
      return --s.life > 0;
    });

    // Debris
    this.debrisArr = this.debrisArr.filter(d => {
      d.x += d.vx; d.y += d.vy; d.vy += 0.30;
      d.angle += d.avel; d.vx *= 0.97;
      if (d.y > GROUND_Y) { d.y = GROUND_Y; d.vy *= -0.22; d.vx *= 0.65; }
      d.alpha -= 0.020;
      return d.alpha > 0;
    });

    // Explosions
    this.explosions = this.explosions.filter(e => ++e.frame < e.maxFrame);

    // Smoke — rises and expands
    this.smokeArr = this.smokeArr.filter(sm => {
      sm.x += sm.vx; sm.y += sm.vy;
      sm.vy *= 0.96;       // decelerate upward
      sm.r  += 0.35;       // expand
      sm.vx *= 0.99;
      return ++sm.life < sm.maxL;
    });

    // Popups — position computed deterministically from startY so direction is unambiguous
    this.popups = this.popups.filter(p => {
      p.frame++;
      p.node.y = p.startY - p.frame * 2.4;    // always moves UP
      p.node.alpha = Math.max(0, 1 - p.frame / 52);
      if (p.node.alpha <= 0) { p.node.destroy(); return false; }
      return true;
    });
  }

  draw(): void {
    const g = this.gfx;
    g.clear();

    // Smoke (behind everything)
    for (const sm of this.smokeArr) {
      const t = sm.life / sm.maxL;
      const alpha = (t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85) * 0.18;
      g.circle(sm.x, sm.y, sm.r).fill({ color: 0x1a2200, alpha });
    }

    // Sparks with trailing line
    for (const s of this.sparks) {
      const a = s.life / s.maxL;
      const trailLen = 4;
      g.moveTo(s.x, s.y)
       .lineTo(s.x - s.vx * trailLen, s.y - s.vy * trailLen)
       .stroke({ width: 1.5, color: s.color, alpha: a * 0.9 });
      g.circle(s.x, s.y, 1).fill({ color: s.color, alpha: a });
    }

    // Debris
    for (const d of this.debrisArr) {
      g.context.save();
      g.context.transform(
        Math.cos(d.angle), Math.sin(d.angle),
        -Math.sin(d.angle), Math.cos(d.angle),
        d.x, d.y,
      );
      g.rect(-d.w / 2, -d.h / 2, d.w, d.h).fill({ color: d.color, alpha: d.alpha });
      g.context.restore();
    }

    // Explosions — layered fire rings
    for (const e of this.explosions) {
      const t  = e.frame / e.maxFrame;
      const s  = e.size;

      // Shockwave
      const shockR = Math.max(0.1, 70 * s * t);
      g.circle(e.x, e.y, shockR)
       .stroke({ width: Math.max(0.5, 3 - t * 3), color: 0xff6600, alpha: Math.max(0, (1 - t) * 0.4) });

      // Outer fire ring
      if (t > 0.05) {
        const ring1R = Math.max(0.1, 52 * s * (t - 0.05));
        g.circle(e.x, e.y, ring1R)
         .stroke({ width: 2.5, color: fireColor(t * 0.9), alpha: (1 - t) * 0.45 });
      }
      if (t > 0.12) {
        const ring2R = Math.max(0.1, 36 * s * (t - 0.12));
        g.circle(e.x, e.y, ring2R)
         .stroke({ width: 1.8, color: fireColor(t), alpha: (1 - t) * 0.3 });
      }

      // Hot core (white-yellow-orange)
      const coreR  = Math.max(0.1, 28 * s * (1 - t));
      const coreC  = fireColor(t * 0.5);
      g.circle(e.x, e.y, coreR).fill({ color: coreC, alpha: (1 - t) * 0.85 });

      // White hot center
      if (t < 0.35) {
        const whiteR = Math.max(0.1, 14 * s * (1 - t / 0.35));
        g.circle(e.x, e.y, whiteR).fill({ color: 0xffffff, alpha: (1 - t / 0.35) * 0.85 });
      }

      // Ground flash (flat ellipse) for big explosions
      if (s > 1.0 && t < 0.3) {
        const fw = 40 * s * (1 - t / 0.3);
        const fh = 8 * s * (1 - t / 0.3);
        g.ellipse(e.x, GROUND_Y, fw, fh).fill({ color: 0xff8800, alpha: (1 - t / 0.3) * 0.3 });
      }
    }
  }

  clear(): void {
    this.sparks = []; this.debrisArr = []; this.explosions = []; this.smokeArr = [];
    for (const p of this.popups) p.node.destroy();
    this.popups = [];
    this.gfx.clear();
  }

  get hasExplosions(): boolean { return this.explosions.length > 0; }

  getMaxExplosionSize(): number {
    let max = 0;
    for (const e of this.explosions) if (e.size > max) max = e.size;
    return max;
  }

  spawnComboPopup(x: number, y: number, count: number, pts: number, is2x: boolean): void {
    const mult = count <= 1 ? 1 : count <= 3 ? 2 : count <= 6 ? 3 : 4;
    const label = mult > 1
      ? `COMBO x${mult}${is2x ? ' [2X]' : ''}! +${pts}`
      : is2x ? `[2X] +${pts}` : `+${pts}`;
    const color = mult > 1 ? 0xffff44 : is2x ? 0xffaa00 : COL_LT_GREEN;
    this.addScorePopup(x, y, label, color);
  }

  spawnSplash(x: number): void {
    for (let i = 0; i < 8; i++) {
      this.sparks.push({
        x: x + randRange(-6, 6), y: GROUND_Y - 2,
        vx: randRange(-2, 2), vy: randRange(-4, -1.5),
        life: 20, maxL: 20, color: 0x5bb8e8,
      });
    }
  }
}
