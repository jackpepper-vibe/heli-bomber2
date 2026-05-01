import * as PIXI from 'pixi.js';
import {
  GROUND_Y, W,
  HELI_ACCEL, HELI_FRICTION, HELI_MAX_SPD,
  COL_HELI_BODY, COL_HELI_TRIM, COL_HELI_GLOW, COL_HELI_SHADOW,
} from '../utils/constants';
import { clamp } from '../utils/math';
import type { HeliModel } from '../utils/constants';
import type { Intent } from '../core/InputSystem';

export class Helicopter {
  x = 210;
  y = 230;
  vx = 0;
  vy = 0;
  private rotorA = 0;
  readonly gfx: PIXI.Graphics;
  model: HeliModel;

  constructor(model: HeliModel) {
    this.model = model;
    this.gfx = new PIXI.Graphics();
  }

  applyIntent(intent: Intent, dt = 1): void {
    const accel = HELI_ACCEL * this.model.speedMult * dt;
    if (intent.up)    this.vy -= accel;
    if (intent.down)  this.vy += accel;
    if (intent.right) this.vx += accel;
    if (intent.left)  this.vx -= accel;
  }

  clampToCave(ceilY: number, floorY: number): void {
    const hs = this.model.scale;
    this.y = clamp(this.y, ceilY + 22 * hs + 2, floorY - 24 * hs - 2);
    if (this.y <= ceilY + 22 * hs + 2 || this.y >= floorY - 24 * hs - 2) this.vy = 0;
  }

  update(dt = 1): void {
    const friction = Math.pow(HELI_FRICTION, dt);
    this.vx *= friction;
    this.vy *= friction;
    const maxSpd = HELI_MAX_SPD * this.model.speedMult;
    this.vx = clamp(this.vx, -maxSpd, maxSpd);
    this.vy = clamp(this.vy, -maxSpd, maxSpd);
    this.x = clamp(this.x + this.vx * dt, 45, W - 45);
    this.y = clamp(this.y + this.vy * dt, 36, GROUND_Y - 30);
    this.rotorA += 0.27 * dt;
  }

  draw(): void {
    const g = this.gfx;
    g.clear();
    this._drawModel(g, this.x, this.y, this.model.scale, this.rotorA);
  }

  private _drawModel(g: PIXI.Graphics, cx: number, cy: number, s: number, rotA: number): void {
    const now  = Date.now();
    const beat = Math.sin(now * 0.003);

    // ── Downwash glow ──────────────────────────────────────────────────────────
    g.ellipse(cx, cy + 28 * s, 42 * s, 14 * s).fill({ color: 0x2255aa, alpha: 0.05 + 0.02 * beat });
    g.ellipse(cx, cy + 20 * s, 28 * s, 9  * s).fill({ color: 0x4488cc, alpha: 0.07 });

    // ── Rotor disc glow ────────────────────────────────────────────────────────
    g.circle(cx, cy - 22 * s, 70 * s).fill({ color: COL_HELI_TRIM, alpha: 0.04 });
    g.circle(cx, cy - 22 * s, 58 * s).fill({ color: COL_HELI_TRIM, alpha: 0.06 });
    g.circle(cx, cy - 22 * s, 46 * s).fill({ color: COL_HELI_GLOW, alpha: 0.05 });

    // ── Rotor mast ─────────────────────────────────────────────────────────────
    g.moveTo(cx, cy - 12 * s).lineTo(cx, cy - 22 * s)
     .stroke({ width: 2.5 * s, color: COL_HELI_GLOW });

    // ── Rotor hub ──────────────────────────────────────────────────────────────
    g.circle(cx, cy - 22 * s, 4 * s).fill(0xc8e8ff);
    g.circle(cx, cy - 22 * s, 2.5 * s).fill(COL_HELI_GLOW);

    // ── Main rotor blades (4 ghost layers for motion blur) ─────────────────────
    const rotorPulse = 0.7 + 0.25 * Math.sin(rotA * 8);
    for (let ghost = 3; ghost >= 0; ghost--) {
      const alpha  = ghost === 0 ? rotorPulse : 0.12 * (4 - ghost);
      const width  = ghost === 0 ? 3.5 * s : 2 * s;
      const offset = Math.PI * 0.10 * ghost;
      const bx1 = Math.cos(offset) * 60 * s, by1 = Math.sin(offset) * 60 * s;
      const bx2 = Math.cos(offset + Math.PI * 0.5) * 60 * s, by2 = Math.sin(offset + Math.PI * 0.5) * 60 * s;
      g.moveTo(cx - bx1, cy - 22 * s - by1).lineTo(cx + bx1, cy - 22 * s + by1)
       .stroke({ width, color: ghost === 0 ? COL_HELI_GLOW : COL_HELI_TRIM, alpha });
      g.moveTo(cx - bx2, cy - 22 * s - by2).lineTo(cx + bx2, cy - 22 * s + by2)
       .stroke({ width: width * 0.8, color: COL_HELI_TRIM, alpha: alpha * 0.7 });
    }

    // ── Tail boom ──────────────────────────────────────────────────────────────
    g.poly([cx - 38 * s, cy - 2 * s, cx - 76 * s, cy - 0.5 * s,
            cx - 76 * s, cy + 5 * s,  cx - 38 * s, cy + 8 * s])
     .fill(COL_HELI_SHADOW).stroke({ width: 1.2 * s, color: COL_HELI_TRIM });

    // ── Vertical tail fin ──────────────────────────────────────────────────────
    g.poly([cx - 76 * s, cy + 6 * s, cx - 76 * s, cy - 22 * s,
            cx - 68 * s, cy - 22 * s, cx - 65 * s, cy + 3 * s])
     .fill(0x0e1824).stroke({ width: 1 * s, color: COL_HELI_TRIM });

    // ── Tail rotor hub ─────────────────────────────────────────────────────────
    g.circle(cx - 76 * s, cy - 6 * s, 2.5 * s).fill(COL_HELI_GLOW);

    // ── Tail rotor blades ──────────────────────────────────────────────────────
    for (let ghost = 2; ghost >= 0; ghost--) {
      const ga    = rotA * 1.8 - ghost * 0.28;
      const alpha = ghost === 0 ? 0.9 : 0.18;
      const tx = cx - 76 * s, ty = cy - 6 * s;
      const c = Math.cos(ga), ss = Math.sin(ga);
      const r = 13 * s;
      g.moveTo(tx - c * r, ty - ss * r).lineTo(tx + c * r, ty + ss * r)
       .stroke({ width: 1.6 * s, color: COL_HELI_TRIM, alpha });
      g.moveTo(tx - ss * r, ty + c * r).lineTo(tx + ss * r, ty - c * r)
       .stroke({ width: 1.6 * s, color: COL_HELI_TRIM, alpha: alpha * 0.7 });
    }

    // ── Fuselage body ──────────────────────────────────────────────────────────
    g.roundRect(cx - 38 * s, cy - 11 * s, 76 * s, 24 * s, 5 * s).fill(COL_HELI_SHADOW);
    g.roundRect(cx - 38 * s, cy - 12 * s, 76 * s, 24 * s, 5 * s)
     .fill(COL_HELI_BODY).stroke({ width: 1.5 * s, color: COL_HELI_TRIM });
    // Highlight stripe
    g.roundRect(cx - 36 * s, cy - 10 * s, 72 * s, 6 * s, 3 * s)
     .fill({ color: COL_HELI_GLOW, alpha: 0.07 });

    // ── Panel lines ────────────────────────────────────────────────────────────
    g.moveTo(cx - 18 * s, cy - 12 * s).lineTo(cx - 18 * s, cy + 12 * s)
     .moveTo(cx + 10 * s, cy - 12 * s).lineTo(cx + 10 * s, cy + 12 * s)
     .stroke({ width: 0.8 * s, color: 0x2a4a6a, alpha: 0.6 });

    // ── Cockpit nose ───────────────────────────────────────────────────────────
    g.poly([cx + 38 * s, cy - 12 * s, cx + 66 * s, cy + 1 * s, cx + 38 * s, cy + 12 * s])
     .fill(0x111d28).stroke({ width: 1.5 * s, color: COL_HELI_TRIM });

    // ── Cockpit window (glowing) ───────────────────────────────────────────────
    g.rect(cx + 40 * s, cy - 8 * s, 16 * s, 12 * s).fill({ color: 0x88ccff, alpha: 0.88 });
    g.rect(cx + 39 * s, cy - 9 * s, 18 * s, 14 * s).fill({ color: COL_HELI_GLOW, alpha: 0.14 });
    // Reflection
    g.rect(cx + 41 * s, cy - 7 * s, 5 * s, 2.5 * s).fill({ color: 0xe8f4ff, alpha: 0.7 });
    g.rect(cx + 42 * s, cy - 5 * s, 2 * s, 1.5 * s).fill({ color: 0xe8f4ff, alpha: 0.4 });

    // ── Weapon hardpoints ──────────────────────────────────────────────────────
    if (s > 0.8) {
      g.rect(cx - 12 * s, cy + 12 * s, 10 * s, 6 * s)
       .fill(0x151f2a).stroke({ width: 0.8 * s, color: 0x3a6a9e });
      g.rect(cx + 8 * s,  cy + 12 * s, 10 * s, 6 * s)
       .fill(0x151f2a).stroke({ width: 0.8 * s, color: 0x3a6a9e });
      g.moveTo(cx - 12 * s, cy + 15 * s).lineTo(cx - 20 * s, cy + 15 * s)
       .moveTo(cx + 18 * s, cy + 15 * s).lineTo(cx + 26 * s, cy + 15 * s)
       .stroke({ width: 1 * s, color: 0x4a8ab8 });
    }

    // ── Landing skids ──────────────────────────────────────────────────────────
    g.moveTo(cx - 22 * s, cy + 12 * s).lineTo(cx - 24 * s, cy + 25 * s)
     .moveTo(cx + 12 * s, cy + 12 * s).lineTo(cx + 14 * s, cy + 25 * s)
     .moveTo(cx - 30 * s, cy + 25 * s).lineTo(cx + 22 * s, cy + 25 * s)
     .stroke({ width: 1.5 * s, color: COL_HELI_TRIM });

    // ── Navigation lights ──────────────────────────────────────────────────────
    const nf = Math.floor(now / 500) % 2 === 0;
    if (nf) {
      g.circle(cx - 62 * s, cy + 1 * s, 2.5 * s).fill({ color: 0xff2200, alpha: 0.95 });
      g.circle(cx - 62 * s, cy + 1 * s, 5   * s).fill({ color: 0xff2200, alpha: 0.18 });
    }
    if (Math.floor(now / 500 + 0.5) % 2 === 0) {
      g.circle(cx + 38 * s, cy - 10 * s, 2 * s).fill({ color: 0x44ccff, alpha: 0.9 });
      g.circle(cx + 38 * s, cy - 10 * s, 4 * s).fill({ color: 0x44ccff, alpha: 0.15 });
    }
    if (Math.floor(now / 150) % 8 === 0) {
      g.circle(cx, cy - 30 * s, 2.5 * s).fill({ color: 0xffffff, alpha: 0.9 });
    }
  }

  /** Draw onto an external canvas (used for heli-select preview) */
  static drawPreview(canvas: HTMLCanvasElement, model: HeliModel): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const CW = canvas.width, CH = canvas.height;
    ctx.clearRect(0, 0, CW, CH);

    const baseS = (CW * 0.78) / 141;
    const maxS  = Math.min((CW - 12) / 2 / 76, (CW - 12) / 2 / 65);
    const s     = Math.min(model.scale * baseS, maxS);
    const cx    = CW / 2 + 5 * s;
    const cy    = CH * 0.54;

    // Tail boom
    ctx.fillStyle   = '#0e1824';
    ctx.strokeStyle = '#3d6e9e';
    ctx.lineWidth   = Math.max(1, 1.2 * s);
    ctx.beginPath();
    ctx.moveTo(cx - 38 * s, cy - 2 * s);
    ctx.lineTo(cx - 76 * s, cy);
    ctx.lineTo(cx - 76 * s, cy + 5 * s);
    ctx.lineTo(cx - 38 * s, cy + 8 * s);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Vertical tail fin
    ctx.beginPath();
    ctx.moveTo(cx - 76 * s, cy + 5 * s);
    ctx.lineTo(cx - 76 * s, cy - 14 * s);
    ctx.lineTo(cx - 70 * s, cy - 14 * s);
    ctx.lineTo(cx - 67 * s, cy + 3 * s);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Tail rotor
    ctx.lineWidth = Math.max(1, 1.2 * s);
    ctx.beginPath();
    ctx.moveTo(cx - 76 * s, cy - 12 * s);
    ctx.lineTo(cx - 76 * s, cy + 1 * s);
    ctx.stroke();

    // Fuselage
    const r  = 4 * s;
    const fx = cx - 38 * s, fy = cy - 12 * s, fw = 76 * s, fh = 24 * s;
    ctx.fillStyle   = '#1c2b3a';
    ctx.strokeStyle = '#3d6e9e';
    ctx.lineWidth   = Math.max(1, 1.5 * s);
    ctx.beginPath();
    ctx.moveTo(fx + r, fy);
    ctx.lineTo(fx + fw - r, fy);
    ctx.arcTo(fx + fw, fy, fx + fw, fy + r, r);
    ctx.lineTo(fx + fw, fy + fh - r);
    ctx.arcTo(fx + fw, fy + fh, fx + fw - r, fy + fh, r);
    ctx.lineTo(fx + r, fy + fh);
    ctx.arcTo(fx, fy + fh, fx, fy + fh - r, r);
    ctx.lineTo(fx, fy + r);
    ctx.arcTo(fx, fy, fx + r, fy, r);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Cockpit nose
    ctx.fillStyle = '#111d28';
    ctx.beginPath();
    ctx.moveTo(cx + 38 * s, cy - 12 * s);
    ctx.lineTo(cx + 65 * s, cy);
    ctx.lineTo(cx + 38 * s, cy + 12 * s);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Window
    ctx.fillStyle = '#88ccff';
    ctx.fillRect(cx + 40 * s, cy - 8 * s, 14 * s, 11 * s);

    // Rotor mast
    ctx.strokeStyle = '#7aaed8';
    ctx.lineWidth   = Math.max(1, 2 * s);
    ctx.beginPath();
    ctx.moveTo(cx, cy - 12 * s);
    ctx.lineTo(cx, cy - 22 * s);
    ctx.stroke();

    // Main rotor
    ctx.strokeStyle = '#5a9acc';
    ctx.lineWidth   = Math.max(1.5, 2.5 * s);
    ctx.beginPath();
    ctx.moveTo(cx - 56 * s, cy - 22 * s);
    ctx.lineTo(cx + 56 * s, cy - 22 * s);
    ctx.stroke();
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(cx - 40 * s, cy - 22 * s - 15 * s);
    ctx.lineTo(cx + 40 * s, cy - 22 * s + 15 * s);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Landing skids
    ctx.strokeStyle = '#3d6e9e';
    ctx.lineWidth = Math.max(1, 1.5 * s);
    ctx.beginPath();
    ctx.moveTo(cx - 22 * s, cy + 12 * s);
    ctx.lineTo(cx - 24 * s, cy + 24 * s);
    ctx.moveTo(cx + 12 * s, cy + 12 * s);
    ctx.lineTo(cx + 14 * s, cy + 24 * s);
    ctx.moveTo(cx - 30 * s, cy + 24 * s);
    ctx.lineTo(cx + 22 * s, cy + 24 * s);
    ctx.stroke();
  }
}
