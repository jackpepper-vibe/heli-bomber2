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
    this.y = clamp(this.y + this.vy * dt, 36, GROUND_Y - 22);
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
    const S = s * 2; // drawing uses doubled internal units at half scale

    // ── Downwash glow ──────────────────────────────────────────────────────────
    g.ellipse(cx, cy + 28 * S, 42 * S, 14 * S).fill({ color: 0x2255aa, alpha: 0.05 + 0.02 * beat });
    g.ellipse(cx, cy + 20 * S, 28 * S, 9  * S).fill({ color: 0x4488cc, alpha: 0.07 });

    // ── Rotor disc glow ────────────────────────────────────────────────────────
    g.circle(cx, cy - 22 * S, 72 * S).fill({ color: COL_HELI_TRIM, alpha: 0.03 });
    g.circle(cx, cy - 22 * S, 60 * S).fill({ color: COL_HELI_TRIM, alpha: 0.055 });
    g.circle(cx, cy - 22 * S, 48 * S).fill({ color: COL_HELI_GLOW, alpha: 0.045 });

    // ── Rotor mast + swashplate detail ─────────────────────────────────────────
    g.moveTo(cx, cy - 12 * S).lineTo(cx, cy - 22 * S)
     .stroke({ width: 2.5 * S, color: COL_HELI_GLOW });
    // Swashplate ring
    g.circle(cx, cy - 18 * S, 5 * S).fill(COL_HELI_SHADOW).stroke({ width: 1 * S, color: COL_HELI_TRIM });
    // Pitch link rods (3 arms at 120°)
    for (let i = 0; i < 3; i++) {
      const a = rotA * 0.5 + (i * Math.PI * 2) / 3;
      g.moveTo(cx, cy - 18 * S)
       .lineTo(cx + Math.cos(a) * 8 * S, cy - 22 * S + Math.sin(a) * 3 * S)
       .stroke({ width: 0.8 * S, color: 0x5a8ab8, alpha: 0.7 });
    }

    // ── Rotor hub ──────────────────────────────────────────────────────────────
    g.circle(cx, cy - 22 * S, 5 * S).fill(0xd0e8ff);
    g.circle(cx, cy - 22 * S, 3 * S).fill(COL_HELI_GLOW);

    // ── Main rotor blades (4 ghost layers for motion blur) ─────────────────────
    const rotorPulse = 0.7 + 0.25 * Math.sin(rotA * 8);
    for (let ghost = 3; ghost >= 0; ghost--) {
      const alpha  = ghost === 0 ? rotorPulse : 0.12 * (4 - ghost);
      const width  = ghost === 0 ? 3.5 * S : 2 * S;
      const offset = Math.PI * 0.10 * ghost;
      const bx1 = Math.cos(offset) * 62 * S, by1 = Math.sin(offset) * 62 * S;
      const bx2 = Math.cos(offset + Math.PI * 0.5) * 62 * S, by2 = Math.sin(offset + Math.PI * 0.5) * 62 * S;
      g.moveTo(cx - bx1, cy - 22 * S - by1).lineTo(cx + bx1, cy - 22 * S + by1)
       .stroke({ width, color: ghost === 0 ? COL_HELI_GLOW : COL_HELI_TRIM, alpha });
      g.moveTo(cx - bx2, cy - 22 * S - by2).lineTo(cx + bx2, cy - 22 * S + by2)
       .stroke({ width: width * 0.8, color: COL_HELI_TRIM, alpha: alpha * 0.7 });
    }

    // ── Horizontal stabiliser ──────────────────────────────────────────────────
    g.poly([cx - 58 * S, cy - 4 * S, cx - 72 * S, cy - 14 * S,
            cx - 68 * S, cy - 14 * S, cx - 54 * S, cy - 4 * S])
     .fill(0x0e1824).stroke({ width: 0.8 * S, color: COL_HELI_TRIM });

    // ── Tail boom ──────────────────────────────────────────────────────────────
    g.poly([cx - 38 * S, cy - 2 * S, cx - 76 * S, cy - 0.5 * S,
            cx - 76 * S, cy + 5 * S,  cx - 38 * S, cy + 8 * S])
     .fill(COL_HELI_SHADOW).stroke({ width: 1.2 * S, color: COL_HELI_TRIM });
    // Boom stringer lines
    g.moveTo(cx - 42 * S, cy + 1 * S).lineTo(cx - 72 * S, cy + 1.5 * S)
     .stroke({ width: 0.5 * S, color: 0x2a4a6a, alpha: 0.5 });

    // ── Vertical tail fin ──────────────────────────────────────────────────────
    g.poly([cx - 76 * S, cy + 6 * S, cx - 76 * S, cy - 24 * S,
            cx - 67 * S, cy - 24 * S, cx - 64 * S, cy + 3 * S])
     .fill(0x0e1824).stroke({ width: 1 * S, color: COL_HELI_TRIM });
    // Fin leading edge highlight
    g.moveTo(cx - 76 * S, cy - 24 * S).lineTo(cx - 67 * S, cy - 24 * S)
     .stroke({ width: 1.5 * S, color: COL_HELI_GLOW, alpha: 0.3 });

    // ── Tail rotor gearbox ─────────────────────────────────────────────────────
    g.rect(cx - 78 * S, cy - 11 * S, 5 * S, 10 * S)
     .fill(0x151f2a).stroke({ width: 0.8 * S, color: COL_HELI_TRIM });
    g.circle(cx - 76 * S, cy - 6 * S, 3 * S).fill(COL_HELI_GLOW);

    // ── Tail rotor blades ──────────────────────────────────────────────────────
    for (let ghost = 2; ghost >= 0; ghost--) {
      const ga    = rotA * 1.8 - ghost * 0.28;
      const alpha = ghost === 0 ? 0.9 : 0.18;
      const tx = cx - 76 * S, ty = cy - 6 * S;
      const c = Math.cos(ga), ss = Math.sin(ga);
      const r = 14 * S;
      g.moveTo(tx - c * r, ty - ss * r).lineTo(tx + c * r, ty + ss * r)
       .stroke({ width: 1.8 * S, color: COL_HELI_TRIM, alpha });
      g.moveTo(tx - ss * r, ty + c * r).lineTo(tx + ss * r, ty - c * r)
       .stroke({ width: 1.8 * S, color: COL_HELI_TRIM, alpha: alpha * 0.7 });
    }

    // ── Engine nacelle (top of fuselage) ──────────────────────────────────────
    g.roundRect(cx - 10 * S, cy - 16 * S, 24 * S, 5 * S, 2 * S)
     .fill(0x131e2c).stroke({ width: 0.8 * S, color: COL_HELI_TRIM });
    // Intake mesh detail
    g.rect(cx - 8 * S, cy - 15 * S, 4 * S, 3 * S).fill({ color: 0x000810, alpha: 0.8 });
    g.rect(cx - 2 * S, cy - 15 * S, 4 * S, 3 * S).fill({ color: 0x000810, alpha: 0.8 });
    g.rect(cx + 4 * S, cy - 15 * S, 4 * S, 3 * S).fill({ color: 0x000810, alpha: 0.8 });

    // ── Exhaust ports ─────────────────────────────────────────────────────────
    g.circle(cx - 14 * S, cy - 9 * S, 2.5 * S).fill(0x0a0f18);
    g.circle(cx - 14 * S, cy - 9 * S, 2 * S).fill({ color: 0xff6600, alpha: 0.3 + 0.2 * beat });
    // Exhaust heat shimmer trail
    g.ellipse(cx - 22 * S, cy - 9 * S, 8 * S, 3 * S)
     .fill({ color: 0xff8800, alpha: 0.06 + 0.04 * beat });

    // ── Fuselage body ──────────────────────────────────────────────────────────
    g.roundRect(cx - 38 * S, cy - 11 * S, 76 * S, 24 * S, 5 * S).fill(COL_HELI_SHADOW);
    g.roundRect(cx - 38 * S, cy - 12 * S, 76 * S, 24 * S, 5 * S)
     .fill(COL_HELI_BODY).stroke({ width: 1.5 * S, color: COL_HELI_TRIM });
    // Armour plate top edge
    g.moveTo(cx - 36 * S, cy - 12 * S).lineTo(cx + 36 * S, cy - 12 * S)
     .stroke({ width: 2 * S, color: 0x2a3e52, alpha: 0.6 });
    // Highlight stripe
    g.roundRect(cx - 36 * S, cy - 10 * S, 72 * S, 5 * S, 2 * S)
     .fill({ color: COL_HELI_GLOW, alpha: 0.06 });

    // ── Panel lines + rivets ──────────────────────────────────────────────────
    g.moveTo(cx - 18 * S, cy - 12 * S).lineTo(cx - 18 * S, cy + 12 * S)
     .moveTo(cx + 10 * S, cy - 12 * S).lineTo(cx + 10 * S, cy + 12 * S)
     .moveTo(cx - 5 * S,  cy - 2 * S).lineTo(cx + 8 * S, cy - 2 * S)
     .stroke({ width: 0.8 * S, color: 0x2a4a6a, alpha: 0.55 });
    // Rivet dots
    for (let rx = -32; rx < 34; rx += 12) {
      g.circle(cx + rx * S, cy - 11 * S, 0.9 * S).fill({ color: 0x3a5a7a, alpha: 0.5 });
    }

    // ── Cockpit nose ───────────────────────────────────────────────────────────
    g.poly([cx + 38 * S, cy - 13 * S, cx + 68 * S, cy + 1 * S, cx + 38 * S, cy + 13 * S])
     .fill(0x111d28).stroke({ width: 1.5 * S, color: COL_HELI_TRIM });
    // Nose armour stripe
    g.poly([cx + 38 * S, cy - 13 * S, cx + 56 * S, cy - 5 * S, cx + 38 * S, cy + 2 * S])
     .fill({ color: 0x1c2e42, alpha: 0.4 });

    // ── FLIR / sensor turret under nose ───────────────────────────────────────
    g.circle(cx + 58 * S, cy + 8 * S, 4.5 * S)
     .fill(0x080e18).stroke({ width: 1 * S, color: 0x3a5a7a });
    g.circle(cx + 59 * S, cy + 7 * S, 2 * S).fill({ color: 0x44aaff, alpha: 0.85 });
    g.circle(cx + 59 * S, cy + 7 * S, 3.5 * S).fill({ color: 0x2266cc, alpha: 0.15 });

    // ── Cockpit window (glowing) ───────────────────────────────────────────────
    // Main glass pane
    g.poly([cx + 40 * S, cy - 9 * S, cx + 56 * S, cy - 7 * S,
            cx + 56 * S, cy + 5 * S, cx + 40 * S, cy + 5 * S])
     .fill({ color: 0x4488bb, alpha: 0.80 });
    // Frame
    g.poly([cx + 39 * S, cy - 10 * S, cx + 57 * S, cy - 8 * S,
            cx + 57 * S, cy + 6 * S, cx + 39 * S, cy + 6 * S])
     .stroke({ width: 1.2 * S, color: COL_HELI_TRIM });
    // Centre bar
    g.moveTo(cx + 48 * S, cy - 9 * S).lineTo(cx + 49 * S, cy + 5 * S)
     .stroke({ width: 0.8 * S, color: 0x1a3a5a });
    // Glow bloom
    g.rect(cx + 39 * S, cy - 9 * S, 18 * S, 15 * S).fill({ color: COL_HELI_GLOW, alpha: 0.10 });
    // Reflections
    g.rect(cx + 41 * S, cy - 8 * S, 5 * S, 2 * S).fill({ color: 0xe8f4ff, alpha: 0.65 });
    g.rect(cx + 42 * S, cy - 5 * S, 2 * S, 1.5 * S).fill({ color: 0xe8f4ff, alpha: 0.35 });

    // ── Wing pylons with weapon pods ──────────────────────────────────────────
    // Pylon struts
    g.moveTo(cx - 8 * S, cy + 12 * S).lineTo(cx - 18 * S, cy + 20 * S)
     .moveTo(cx + 12 * S, cy + 12 * S).lineTo(cx + 22 * S, cy + 20 * S)
     .stroke({ width: 1.2 * S, color: 0x1e2e3e });
    // Rocket pods
    g.roundRect(cx - 26 * S, cy + 18 * S, 16 * S, 5 * S, 1.5 * S)
     .fill(0x0e1820).stroke({ width: 0.8 * S, color: 0x3a5a7a });
    g.roundRect(cx + 14 * S, cy + 18 * S, 16 * S, 5 * S, 1.5 * S)
     .fill(0x0e1820).stroke({ width: 0.8 * S, color: 0x3a5a7a });
    // Rocket tubes visible on pods
    for (let i = 0; i < 3; i++) {
      g.circle(cx + (-24 + i * 4) * S, cy + 20.5 * S, 1 * S).fill(0x001018);
      g.circle(cx + (16 + i * 4) * S,  cy + 20.5 * S, 1 * S).fill(0x001018);
    }

    // ── Landing skids ──────────────────────────────────────────────────────────
    g.moveTo(cx - 22 * S, cy + 12 * S).lineTo(cx - 24 * S, cy + 26 * S)
     .moveTo(cx + 12 * S, cy + 12 * S).lineTo(cx + 14 * S, cy + 26 * S)
     .stroke({ width: 1.8 * S, color: COL_HELI_TRIM });
    // Skid cross-tube
    g.moveTo(cx - 30 * S, cy + 26 * S).lineTo(cx + 22 * S, cy + 26 * S)
     .stroke({ width: 1.8 * S, color: COL_HELI_TRIM });
    // Skid toe caps
    g.roundRect(cx - 32 * S, cy + 24.5 * S, 6 * S, 3 * S, 1 * S).fill(0x1a2a3a);
    g.roundRect(cx + 22 * S, cy + 24.5 * S, 6 * S, 3 * S, 1 * S).fill(0x1a2a3a);

    // ── Navigation lights ──────────────────────────────────────────────────────
    const nf = Math.floor(now / 500) % 2 === 0;
    if (nf) {
      g.circle(cx - 62 * S, cy + 1 * S, 2.5 * S).fill({ color: 0xff2200, alpha: 0.95 });
      g.circle(cx - 62 * S, cy + 1 * S, 5   * S).fill({ color: 0xff2200, alpha: 0.18 });
    }
    if (Math.floor(now / 500 + 0.5) % 2 === 0) {
      g.circle(cx + 40 * S, cy - 12 * S, 2 * S).fill({ color: 0x44ccff, alpha: 0.9 });
      g.circle(cx + 40 * S, cy - 12 * S, 4 * S).fill({ color: 0x44ccff, alpha: 0.15 });
    }
    // Anti-collision beacon (top of rotor mast)
    if (Math.floor(now / 150) % 8 === 0) {
      g.circle(cx, cy - 32 * S, 3 * S).fill({ color: 0xffffff, alpha: 0.9 });
      g.circle(cx, cy - 32 * S, 6 * S).fill({ color: 0xffffff, alpha: 0.15 });
    }
    // IR suppressor exhaust glow (always)
    g.circle(cx - 14 * S, cy - 9 * S, 4 * S).fill({ color: 0xff4400, alpha: 0.04 + 0.02 * beat });
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
