import * as PIXI from 'pixi.js';
import { GROUND_Y, W, COL_GREEN, COL_LT_GREEN, HELI_SPD } from '../utils/constants';
import { clamp } from '../utils/math';
import type { HeliModel } from '../utils/constants';
import type { Intent } from '../core/InputSystem';

export class Helicopter {
  x = 210;
  y = 230;
  private rotorA = 0;
  readonly gfx: PIXI.Graphics;
  model: HeliModel;

  constructor(model: HeliModel) {
    this.model = model;
    this.gfx = new PIXI.Graphics();
  }

  applyIntent(intent: Intent): void {
    const spd = HELI_SPD * this.model.speedMult;
    if (intent.up)    this.y = clamp(this.y - spd, 36, GROUND_Y - 30);
    if (intent.down)  this.y = clamp(this.y + spd, 36, GROUND_Y - 30);
    if (intent.right) this.x = clamp(this.x + spd, 45, W - 45);
    if (intent.left)  this.x = clamp(this.x - spd, 45, W - 45);
  }

  clampToCave(ceilY: number, floorY: number): void {
    const hs = this.model.scale;
    this.y = clamp(this.y, ceilY + 22 * hs + 2, floorY - 24 * hs - 2);
  }

  update(): void {
    this.rotorA += 0.27;
  }

  draw(): void {
    const g = this.gfx;
    g.clear();
    this._drawModel(g, this.x, this.y, this.model.scale, this.rotorA);
  }

  private _drawModel(g: PIXI.Graphics, cx: number, cy: number, s: number, rotA: number): void {
    const now = Date.now();
    const beat = Math.sin(now * 0.003);

    // ── Downwash / engine heat glow ────────────────────────────────────────
    g.ellipse(cx, cy + 28 * s, 42 * s, 14 * s).fill({ color: 0x00ff88, alpha: 0.04 + 0.02 * beat });
    g.ellipse(cx, cy + 20 * s, 28 * s, 9  * s).fill({ color: 0x80ffb0, alpha: 0.06 });

    // ── Rotor disc – outer glow ────────────────────────────────────────────
    g.circle(cx, cy - 22 * s, 70 * s).fill({ color: COL_GREEN, alpha: 0.04 });
    g.circle(cx, cy - 22 * s, 58 * s).fill({ color: COL_GREEN, alpha: 0.06 });
    g.circle(cx, cy - 22 * s, 46 * s).fill({ color: 0x80ffb0, alpha: 0.05 });

    // ── Rotor mast ─────────────────────────────────────────────────────────
    g.moveTo(cx, cy - 12 * s).lineTo(cx, cy - 22 * s)
     .stroke({ width: 2.5 * s, color: COL_LT_GREEN });

    // ── Rotor hub ──────────────────────────────────────────────────────────
    g.circle(cx, cy - 22 * s, 4 * s).fill(0xddfff0);
    g.circle(cx, cy - 22 * s, 2.5 * s).fill(COL_LT_GREEN);

    // ── Main rotor blades (4 ghost layers for motion blur) ─────────────────
    const rotorPulse = 0.7 + 0.25 * Math.sin(rotA * 8);
    for (let ghost = 3; ghost >= 0; ghost--) {
      const alpha = ghost === 0 ? rotorPulse : 0.12 * (4 - ghost);
      const width = ghost === 0 ? 3.5 * s : 2 * s;
      const offset = Math.PI * 0.10 * ghost;
      const bx1 = Math.cos(offset) * 60 * s, by1 = Math.sin(offset) * 60 * s;
      const bx2 = Math.cos(offset + Math.PI * 0.5) * 60 * s, by2 = Math.sin(offset + Math.PI * 0.5) * 60 * s;
      // Blade pair A
      g.moveTo(cx - bx1, cy - 22 * s - by1).lineTo(cx + bx1, cy - 22 * s + by1)
       .stroke({ width, color: ghost === 0 ? COL_LT_GREEN : COL_GREEN, alpha });
      // Blade pair B (perpendicular)
      g.moveTo(cx - bx2, cy - 22 * s - by2).lineTo(cx + bx2, cy - 22 * s + by2)
       .stroke({ width: width * 0.8, color: COL_GREEN, alpha: alpha * 0.7 });
    }

    // ── Tail boom ──────────────────────────────────────────────────────────
    g.poly([cx - 38 * s, cy - 2 * s, cx - 76 * s, cy - 0.5 * s,
            cx - 76 * s, cy + 5 * s, cx - 38 * s, cy + 8 * s])
     .fill(0x001e00).stroke({ width: 1.2 * s, color: COL_GREEN });

    // ── Vertical tail fin ──────────────────────────────────────────────────
    g.poly([cx - 76 * s, cy + 6 * s, cx - 76 * s, cy - 22 * s,
            cx - 68 * s, cy - 22 * s, cx - 65 * s, cy + 3 * s])
     .fill(0x001800).stroke({ width: 1 * s, color: COL_GREEN });

    // ── Tail rotor hub ─────────────────────────────────────────────────────
    g.circle(cx - 76 * s, cy - 6 * s, 2.5 * s).fill(COL_LT_GREEN);

    // ── Tail rotor blades ──────────────────────────────────────────────────
    for (let ghost = 2; ghost >= 0; ghost--) {
      const ga    = rotA * 1.8 - ghost * 0.28;
      const alpha = ghost === 0 ? 0.9 : 0.18;
      const tx = cx - 76 * s, ty = cy - 6 * s;
      const c = Math.cos(ga), ss = Math.sin(ga);
      const r = 13 * s;
      g.moveTo(tx - c * r, ty - ss * r).lineTo(tx + c * r, ty + ss * r)
       .stroke({ width: 1.6 * s, color: COL_GREEN, alpha });
      g.moveTo(tx - ss * r, ty + c * r).lineTo(tx + ss * r, ty - c * r)
       .stroke({ width: 1.6 * s, color: COL_GREEN, alpha: alpha * 0.7 });
    }

    // ── Fuselage body ──────────────────────────────────────────────────────
    // Shadow / depth layer
    g.roundRect(cx - 38 * s, cy - 11 * s, 76 * s, 24 * s, 5 * s).fill(0x000a00);
    // Main body
    g.roundRect(cx - 38 * s, cy - 12 * s, 76 * s, 24 * s, 5 * s)
     .fill(0x001e00).stroke({ width: 1.5 * s, color: COL_GREEN });
    // Body highlight stripe
    g.roundRect(cx - 36 * s, cy - 10 * s, 72 * s, 6 * s, 3 * s)
     .fill({ color: 0x00ff88, alpha: 0.08 });

    // ── Panel lines ────────────────────────────────────────────────────────
    g.moveTo(cx - 18 * s, cy - 12 * s).lineTo(cx - 18 * s, cy + 12 * s)
     .moveTo(cx + 10 * s, cy - 12 * s).lineTo(cx + 10 * s, cy + 12 * s)
     .stroke({ width: 0.8 * s, color: 0x006020, alpha: 0.6 });

    // ── Cockpit nose ───────────────────────────────────────────────────────
    g.poly([cx + 38 * s, cy - 12 * s, cx + 66 * s, cy + 1 * s, cx + 38 * s, cy + 12 * s])
     .fill(0x001400).stroke({ width: 1.5 * s, color: COL_GREEN });

    // ── Cockpit window (glowing) ───────────────────────────────────────────
    g.rect(cx + 40 * s, cy - 8 * s, 16 * s, 12 * s).fill({ color: COL_GREEN, alpha: 0.9 });
    // Window glow halo
    g.rect(cx + 39 * s, cy - 9 * s, 18 * s, 14 * s).fill({ color: COL_GREEN, alpha: 0.12 });
    // Reflection
    g.rect(cx + 41 * s, cy - 7 * s, 5 * s, 2.5 * s).fill({ color: 0xddfff0, alpha: 0.7 });
    g.rect(cx + 42 * s, cy - 5 * s, 2 * s, 1.5 * s).fill({ color: 0xddfff0, alpha: 0.4 });

    // ── Weapon hardpoints ──────────────────────────────────────────────────
    if (s > 0.8) {
      g.rect(cx - 12 * s, cy + 12 * s, 10 * s, 6 * s)
       .fill(0x002800).stroke({ width: 0.8 * s, color: 0x00aa40 });
      g.rect(cx + 8 * s,  cy + 12 * s, 10 * s, 6 * s)
       .fill(0x002800).stroke({ width: 0.8 * s, color: 0x00aa40 });
      // Gun barrels
      g.moveTo(cx - 12 * s, cy + 15 * s).lineTo(cx - 20 * s, cy + 15 * s)
       .moveTo(cx + 18 * s, cy + 15 * s).lineTo(cx + 26 * s, cy + 15 * s)
       .stroke({ width: 1 * s, color: 0x00cc50 });
    }

    // ── Landing skids ──────────────────────────────────────────────────────
    g.moveTo(cx - 22 * s, cy + 12 * s).lineTo(cx - 24 * s, cy + 25 * s)
     .moveTo(cx + 12 * s, cy + 12 * s).lineTo(cx + 14 * s, cy + 25 * s)
     .moveTo(cx - 30 * s, cy + 25 * s).lineTo(cx + 22 * s, cy + 25 * s)
     .stroke({ width: 1.5 * s, color: COL_GREEN });

    // ── Navigation lights ──────────────────────────────────────────────────
    const nf = Math.floor(now / 500) % 2 === 0;
    // Port (red)
    if (nf) {
      g.circle(cx - 62 * s, cy + 1 * s, 2.5 * s).fill({ color: 0xff2200, alpha: 0.95 });
      g.circle(cx - 62 * s, cy + 1 * s, 5   * s).fill({ color: 0xff2200, alpha: 0.18 });
    }
    // Starboard (green) — offset blink
    if (Math.floor(now / 500 + 0.5) % 2 === 0) {
      g.circle(cx + 38 * s, cy - 10 * s, 2 * s).fill({ color: 0x00ff88, alpha: 0.9 });
      g.circle(cx + 38 * s, cy - 10 * s, 4 * s).fill({ color: 0x00ff88, alpha: 0.15 });
    }
    // White strobe (fast)
    if (Math.floor(now / 150) % 8 === 0) {
      g.circle(cx, cy - 30 * s, 2.5 * s).fill({ color: 0xffffff, alpha: 0.9 });
    }
  }

  /** Draw onto an external canvas (used for heli-select preview) */
  static drawPreview(
    canvas: HTMLCanvasElement,
    model: HeliModel,
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#00ff41';
    ctx.fillStyle = '#001a00';
    // Simplified preview — just fuselage outline
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const s = model.scale * 0.7;
    ctx.beginPath();
    ctx.roundRect(cx - 38 * s, cy - 12 * s, 76 * s, 24 * s, 4 * s);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 38 * s, cy - 12 * s);
    ctx.lineTo(cx + 65 * s, cy);
    ctx.lineTo(cx + 38 * s, cy + 12 * s);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#00ff41';
    ctx.fillRect(cx + 40 * s, cy - 8 * s, 15 * s, 11 * s);
    // Rotor
    ctx.moveTo(cx - 58 * s, cy - 22 * s);
    ctx.lineTo(cx + 58 * s, cy - 22 * s);
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
