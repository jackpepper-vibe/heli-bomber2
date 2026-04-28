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

    // Rotor disc glow
    g.circle(cx, cy - 22 * s, 60 * s).fill({ color: COL_GREEN, alpha: 0.07 });

    // Rotor mast
    g.moveTo(cx, cy - 12 * s).lineTo(cx, cy - 22 * s).stroke({ width: 2 * s, color: COL_GREEN });

    // Rotor hub
    g.circle(cx, cy - 22 * s, 3 * s).fill(COL_LT_GREEN);

    // Main rotor blades (two ghost layers for blur effect)
    const rotorPulse = 0.65 + 0.25 * Math.sin(rotA * 8);
    for (let ghost = 2; ghost >= 0; ghost--) {
      const alpha = ghost === 0 ? rotorPulse : 0.15 * (3 - ghost);
      const width = ghost === 0 ? 3.5 * s : 2 * s;
      // Blade 1
      g.moveTo(cx - 58 * s, cy - 22 * s).lineTo(cx + 58 * s, cy - 22 * s)
       .stroke({ width, color: COL_GREEN, alpha });
      // Blade 2 (slight angle offset)
      const offset = Math.PI * 0.12 * ghost;
      const bx = Math.cos(offset) * 58 * s, by = Math.sin(offset) * 58 * s;
      g.moveTo(cx - bx, cy - 22 * s - by).lineTo(cx + bx, cy - 22 * s + by)
       .stroke({ width, color: COL_GREEN, alpha });
    }

    // Tail boom
    g.poly([cx - 38 * s, cy - 2 * s, cx - 75 * s, cy - 1 * s, cx - 75 * s, cy + 5 * s, cx - 38 * s, cy + 7 * s])
     .fill(0x002800).stroke({ width: 1 * s, color: COL_GREEN });

    // Vertical tail fin
    g.moveTo(cx - 74 * s, cy - 20 * s).lineTo(cx - 66 * s, cy - 4 * s)
     .moveTo(cx - 74 * s, cy - 20 * s).lineTo(cx - 74 * s, cy + 8 * s)
     .stroke({ width: 2 * s, color: COL_GREEN });

    // Tail rotor hub
    g.circle(cx - 74 * s, cy - 5 * s, 2 * s).fill(COL_LT_GREEN);

    // Tail rotor blades
    for (let ghost = 2; ghost >= 0; ghost--) {
      const ga = rotA * 1.6 - ghost * 0.28;
      const alpha = ghost === 0 ? 0.85 : 0.15;
      const tx = cx - 74 * s, ty = cy - 5 * s;
      const c = Math.cos(ga), ss = Math.sin(ga);
      const r = 12 * s;
      g.moveTo(tx + c * (-r), ty + ss * (-r)).lineTo(tx + c * r, ty + ss * r)
       .stroke({ width: 1.5 * s, color: COL_GREEN, alpha });
      // Perpendicular blade
      g.moveTo(tx + c * (-10 * s) - ss * 0, ty + ss * (-10 * s) + c * 0)
       .lineTo(tx + c * (10 * s), ty + ss * (10 * s))
       .stroke({ width: 1.5 * s, color: COL_GREEN, alpha });
    }

    // Fuselage body
    g.roundRect(cx - 38 * s, cy - 12 * s, 76 * s, 24 * s, 4 * s)
     .fill(0x001a00).stroke({ width: 1.5 * s, color: COL_GREEN });

    // Panel lines
    g.moveTo(cx - 18 * s, cy - 12 * s).lineTo(cx - 18 * s, cy + 12 * s)
     .moveTo(cx + 10 * s, cy - 12 * s).lineTo(cx + 10 * s, cy + 12 * s)
     .stroke({ width: 0.8 * s, color: 0x004010 });

    // Cockpit nose
    g.poly([cx + 38 * s, cy - 12 * s, cx + 65 * s, cy, cx + 38 * s, cy + 12 * s])
     .fill(0x001000).stroke({ width: 1.5 * s, color: COL_GREEN });

    // Cockpit window
    g.rect(cx + 40 * s, cy - 8 * s, 15 * s, 11 * s).fill(COL_GREEN);
    g.rect(cx + 41 * s, cy - 7 * s, 5 * s, 2.5 * s).fill(COL_LT_GREEN);

    // Weapon hardpoints (assault + gunship)
    if (s > 0.8) {
      g.rect(cx - 12 * s, cy + 12 * s, 9 * s, 5 * s).fill(0x003000).stroke({ width: 0.8 * s, color: COL_GREEN });
      g.rect(cx + 8 * s,  cy + 12 * s, 9 * s, 5 * s).fill(0x003000).stroke({ width: 0.8 * s, color: COL_GREEN });
    }

    // Landing skids
    g.moveTo(cx - 22 * s, cy + 12 * s).lineTo(cx - 24 * s, cy + 24 * s)
     .moveTo(cx + 12 * s, cy + 12 * s).lineTo(cx + 14 * s, cy + 24 * s)
     .moveTo(cx - 30 * s, cy + 24 * s).lineTo(cx + 22 * s, cy + 24 * s)
     .stroke({ width: 1.5 * s, color: COL_GREEN });

    // Nav light blink
    if (Math.floor(now / 500) % 2 === 0) {
      g.circle(cx - 60 * s, cy + 2 * s, 2 * s).fill({ color: 0xff2200, alpha: 0.85 });
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
