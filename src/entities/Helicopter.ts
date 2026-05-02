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
    const S    = s * 2; // drawing uses doubled internal units at half scale

    // ── Downwash glow ──────────────────────────────────────────────────────────
    g.ellipse(cx, cy + 28 * S, 42 * S, 14 * S).fill({ color: 0x2255aa, alpha: 0.05 + 0.02 * beat });
    g.ellipse(cx, cy + 20 * S, 28 * S, 9  * S).fill({ color: 0x4488cc, alpha: 0.07 });

    // ── Rotor disc — continuous motion-blur disc ───────────────────────────────
    // Outer soft halos
    g.circle(cx, cy - 22 * S, 75 * S).fill({ color: COL_HELI_TRIM, alpha: 0.022 });
    g.circle(cx, cy - 22 * S, 66 * S).fill({ color: COL_HELI_TRIM, alpha: 0.042 });
    // Blur disc fill — base translucent plane of motion
    g.circle(cx, cy - 22 * S, 63 * S).fill({ color: 0x8ab8d8, alpha: 0.14 });
    // Tip-trace ring
    g.circle(cx, cy - 22 * S, 63 * S).stroke({ width: 1.4 * S, color: 0xaad4f0, alpha: 0.28 });

    // 14-ghost traces for motion blur backdrop
    const GHOSTS = 14;
    for (let i = GHOSTS - 1; i >= 0; i--) {
      const a   = rotA - i * (Math.PI / GHOSTS);
      const alp = 0.055 * Math.pow(1 - i / GHOSTS, 1.4) + 0.006;
      const bx  = Math.cos(a) * 62 * S;
      const by  = Math.sin(a) * 62 * S;
      g.moveTo(cx - bx, cy - 22 * S - by).lineTo(cx + bx, cy - 22 * S + by)
       .stroke({ width: 2.4 * S, color: COL_HELI_TRIM, alpha: alp });
    }
    // Current blade position — bright solid blades (2 antipodal)
    {
      const bx = Math.cos(rotA) * 62 * S;
      const by = Math.sin(rotA) * 62 * S;
      // Blade glow halo
      g.moveTo(cx - bx, cy - 22 * S - by).lineTo(cx + bx, cy - 22 * S + by)
       .stroke({ width: 4.5 * S, color: COL_HELI_GLOW, alpha: 0.18 });
      // Blade main surface
      g.moveTo(cx - bx, cy - 22 * S - by).lineTo(cx + bx, cy - 22 * S + by)
       .stroke({ width: 2.8 * S, color: 0xc8e0f8, alpha: 0.82 });
      // Blade leading-edge highlight
      g.moveTo(cx - bx, cy - 22 * S - by).lineTo(cx + bx, cy - 22 * S + by)
       .stroke({ width: 1.0 * S, color: 0xffffff, alpha: 0.30 });
    }

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

    // ── Horizontal stabiliser ──────────────────────────────────────────────────
    g.poly([cx - 58 * S, cy - 4 * S, cx - 72 * S, cy - 14 * S,
            cx - 68 * S, cy - 14 * S, cx - 54 * S, cy - 4 * S])
     .fill(0x0e1824).stroke({ width: 0.8 * S, color: COL_HELI_TRIM });

    // ── Tail boom ──────────────────────────────────────────────────────────────
    // Shadow underside polygon
    g.poly([cx - 38 * S, cy + 5 * S, cx - 76 * S, cy + 3.5 * S,
            cx - 76 * S, cy + 8 * S, cx - 38 * S, cy + 11 * S])
     .fill({ color: 0x040810, alpha: 0.55 });
    // Main boom body
    g.poly([cx - 38 * S, cy - 2 * S, cx - 76 * S, cy - 0.5 * S,
            cx - 76 * S, cy + 5 * S,  cx - 38 * S, cy + 8 * S])
     .fill(COL_HELI_SHADOW).stroke({ width: 1.2 * S, color: COL_HELI_TRIM });
    // Top-face highlight line
    g.moveTo(cx - 40 * S, cy - 1.5 * S).lineTo(cx - 74 * S, cy + 0.5 * S)
     .stroke({ width: 0.8 * S, color: 0x3a6080, alpha: 0.45 });
    // Stringer lines
    g.moveTo(cx - 42 * S, cy + 2.2 * S).lineTo(cx - 72 * S, cy + 2.2 * S)
     .stroke({ width: 0.5 * S, color: 0x2a4a6a, alpha: 0.50 });
    g.moveTo(cx - 42 * S, cy + 5 * S).lineTo(cx - 72 * S, cy + 5 * S)
     .stroke({ width: 0.5 * S, color: 0x2a4a6a, alpha: 0.38 });
    // Tail-cone junction panel line
    g.moveTo(cx - 38 * S, cy - 2.5 * S).lineTo(cx - 38 * S, cy + 9 * S)
     .stroke({ width: 0.8 * S, color: 0x2a4a6a, alpha: 0.55 });
    // 8 rivet pairs across boom (top and bottom seams)
    for (let i = 0; i < 8; i++) {
      const rx = cx + (-73 + i * 5) * S;
      g.circle(rx, cy - 0.5 * S, 0.75 * S).fill({ color: 0x3a5a80, alpha: 0.48 });
      g.circle(rx, cy + 5.5 * S,  0.75 * S).fill({ color: 0x2a4a6a, alpha: 0.40 });
    }

    // ── Vertical tail fin ──────────────────────────────────────────────────────
    // Shadow poly on trailing face
    g.poly([cx - 64 * S, cy + 3 * S, cx - 67 * S, cy - 24 * S,
            cx - 65 * S, cy - 24 * S, cx - 62 * S, cy + 3 * S])
     .fill({ color: 0x040810, alpha: 0.50 });
    // Main fin body
    g.poly([cx - 76 * S, cy + 6 * S, cx - 76 * S, cy - 24 * S,
            cx - 67 * S, cy - 24 * S, cx - 64 * S, cy + 3 * S])
     .fill(0x0e1824).stroke({ width: 1 * S, color: COL_HELI_TRIM });
    // Fin leading edge highlight
    g.moveTo(cx - 76 * S, cy - 24 * S).lineTo(cx - 67 * S, cy - 24 * S)
     .stroke({ width: 1.5 * S, color: COL_HELI_GLOW, alpha: 0.3 });
    // Two panel seam lines across fin
    g.moveTo(cx - 76 * S, cy - 10 * S).lineTo(cx - 65 * S, cy - 8 * S)
     .stroke({ width: 0.6 * S, color: 0x2a4a6a, alpha: 0.50 });
    g.moveTo(cx - 76 * S, cy - 18 * S).lineTo(cx - 68 * S, cy - 20 * S)
     .stroke({ width: 0.6 * S, color: 0x2a4a6a, alpha: 0.50 });
    // 4 rivets along leading edge
    for (let i = 0; i < 4; i++) {
      const ry = cy + (-20 + i * 7) * S;
      g.circle(cx - 75 * S, ry, 0.75 * S).fill({ color: 0x3a5a80, alpha: 0.48 });
    }

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

    // ── Fuselage body — metallic layering ─────────────────────────────────────
    // Shadow underside
    g.roundRect(cx - 38 * S, cy + 1 * S, 76 * S, 12 * S, 4 * S)
     .fill({ color: 0x040710, alpha: 0.55 });
    // Main body — shadow base
    g.roundRect(cx - 38 * S, cy - 11 * S, 76 * S, 24 * S, 5 * S).fill(COL_HELI_SHADOW);
    // Main body — colour + trim stroke
    g.roundRect(cx - 38 * S, cy - 12 * S, 76 * S, 24 * S, 5 * S)
     .fill(COL_HELI_BODY).stroke({ width: 1.5 * S, color: COL_HELI_TRIM });
    // Top highlight band
    g.roundRect(cx - 37 * S, cy - 11 * S, 74 * S, 7.5 * S, 3 * S)
     .fill({ color: 0x3060a8, alpha: 0.13 });
    // Metallic sheen line
    g.moveTo(cx - 35 * S, cy - 9 * S).lineTo(cx + 33 * S, cy - 7 * S)
     .stroke({ width: 1.6 * S, color: 0x70aacc, alpha: 0.10 });
    // Armour plate top edge
    g.moveTo(cx - 36 * S, cy - 11.5 * S).lineTo(cx + 36 * S, cy - 11.5 * S)
     .stroke({ width: 2.2 * S, color: 0x2a3e54, alpha: 0.65 });

    // ── Panel lines ────────────────────────────────────────────────────────────
    // Vertical bulkheads
    g.moveTo(cx - 18 * S, cy - 12 * S).lineTo(cx - 18 * S, cy + 12 * S)
     .stroke({ width: 0.8 * S, color: 0x2a4a6a, alpha: 0.55 });
    g.moveTo(cx + 10 * S, cy - 12 * S).lineTo(cx + 10 * S, cy + 12 * S)
     .stroke({ width: 0.8 * S, color: 0x2a4a6a, alpha: 0.55 });
    // Horizontal stringer full fuselage width
    g.moveTo(cx - 38 * S, cy - 1.5 * S).lineTo(cx + 38 * S, cy - 1.5 * S)
     .stroke({ width: 0.7 * S, color: 0x2a4a6a, alpha: 0.45 });
    // Access hatch panels — stroke only
    g.roundRect(cx - 16 * S, cy - 10 * S, 12 * S, 8 * S, 1.2 * S)
     .stroke({ width: 0.7 * S, color: 0x2a4a6a, alpha: 0.55 });
    g.roundRect(cx - 16 * S, cy + 0.5 * S, 12 * S, 9 * S, 1.2 * S)
     .stroke({ width: 0.7 * S, color: 0x2a4a6a, alpha: 0.55 });
    g.roundRect(cx - 36 * S, cy - 10 * S, 15 * S, 17 * S, 1.5 * S)
     .stroke({ width: 0.7 * S, color: 0x2a4a6a, alpha: 0.50 });
    g.roundRect(cx + 12 * S, cy - 9 * S, 12 * S, 8 * S, 1.2 * S)
     .stroke({ width: 0.7 * S, color: 0x2a4a6a, alpha: 0.55 });
    // Fuel cap circles
    g.circle(cx - 9 * S, cy - 1.5 * S, 1.6 * S).stroke({ width: 0.6 * S, color: 0x3a5a7a, alpha: 0.60 });
    g.circle(cx + 6 * S, cy - 1.5 * S, 1.6 * S).stroke({ width: 0.6 * S, color: 0x3a5a7a, alpha: 0.60 });

    // ── Rivets ─────────────────────────────────────────────────────────────────
    // Top edge row
    for (let rx = -33; rx <= 36; rx += 7) {
      g.circle(cx + rx * S, cy - 11.5 * S, 0.9 * S).fill({ color: 0x3a5a80, alpha: 0.52 });
    }
    // Bottom edge row
    for (let rx = -33; rx <= 36; rx += 7) {
      g.circle(cx + rx * S, cy + 11.5 * S, 0.9 * S).fill({ color: 0x2a4a6a, alpha: 0.42 });
    }
    // Bulkhead seam rivets at cx-18 and cx+10
    for (const bx of [-18, 10]) {
      for (let ry = -8; ry <= 8; ry += 4.5) {
        g.circle(cx + bx * S, cy + ry * S, 0.8 * S).fill({ color: 0x3a5a80, alpha: 0.48 });
      }
    }

    // ── Cockpit nose ───────────────────────────────────────────────────────────
    // Shadow underside triangle
    g.poly([cx + 38 * S, cy + 5 * S, cx + 68 * S, cy + 3 * S, cx + 38 * S, cy + 14 * S])
     .fill({ color: 0x040810, alpha: 0.50 });
    // Main nose polygon
    g.poly([cx + 38 * S, cy - 13 * S, cx + 68 * S, cy + 1 * S, cx + 38 * S, cy + 13 * S])
     .fill(0x111d28).stroke({ width: 1.5 * S, color: COL_HELI_TRIM });
    // Nose armour stripe
    g.poly([cx + 38 * S, cy - 13 * S, cx + 56 * S, cy - 5 * S, cx + 38 * S, cy + 2 * S])
     .fill({ color: 0x1c2e42, alpha: 0.4 });
    // Pitot probe
    g.moveTo(cx + 67 * S, cy - 0.5 * S).lineTo(cx + 81 * S, cy - 0.5 * S)
     .stroke({ width: 1 * S, color: 0x2a4060 });
    // AOA vane
    g.moveTo(cx + 79 * S, cy - 0.5 * S).lineTo(cx + 76 * S, cy - 4.5 * S)
     .stroke({ width: 0.7 * S, color: 0x2a4060, alpha: 0.80 });

    // ── FLIR / sensor turret under nose ───────────────────────────────────────
    // Housing circle
    g.circle(cx + 58 * S, cy + 8 * S, 5.5 * S)
     .fill(0x080e18).stroke({ width: 1 * S, color: 0x3a5a7a });
    // Dome fill
    g.circle(cx + 58 * S, cy + 8 * S, 4 * S).fill({ color: 0x1a3060, alpha: 0.90 });
    // Lens circle
    g.circle(cx + 59 * S, cy + 7.5 * S, 2.2 * S).fill({ color: 0x44aaff, alpha: 0.85 });
    // Specular point
    g.circle(cx + 59.8 * S, cy + 6.8 * S, 0.8 * S).fill({ color: 0xddf0ff, alpha: 0.70 });

    // ── Cockpit 4-pane window (2 cols × 2 rows) ───────────────────────────────
    const WX   = cx + 40 * S;
    const WY   = cy - 9.5 * S;
    const WW   = 8 * S;
    const WH   = 7.5 * S;
    const WGAP = 1 * S;
    const paneConfigs = [
      { col: 0, row: 0 }, { col: 1, row: 0 },
      { col: 0, row: 1 }, { col: 1, row: 1 },
    ];
    for (const { col, row } of paneConfigs) {
      const px = WX + col * (WW + WGAP);
      const py = WY + row * (WH + WGAP);
      // Dark recess behind glass
      g.roundRect(px - 0.8 * S, py - 0.8 * S, WW + 1.6 * S, WH + 1.6 * S, 1.5 * S)
       .fill({ color: 0x050c18, alpha: 0.90 });
      // Glass fill — vibrant teal cockpit
      g.roundRect(px, py, WW, WH, 1 * S)
       .fill({ color: 0x0a4a7a, alpha: 0.95 });
      // Glass inner glow
      g.roundRect(px + 0.5 * S, py + 0.5 * S, WW - 1 * S, WH - 1 * S, 0.8 * S)
       .fill({ color: 0x2288cc, alpha: 0.22 });
      // Frame stroke
      g.roundRect(px, py, WW, WH, 1 * S)
       .stroke({ width: 1.0 * S, color: 0x88d0ff, alpha: 0.80 });
      // Vertical centre divider
      g.moveTo(px + WW * 0.5, py).lineTo(px + WW * 0.5, py + WH)
       .stroke({ width: 0.6 * S, color: 0x3a6a9a, alpha: 0.80 });
      // Reflection highlight — strong white streak
      g.roundRect(px + 0.8 * S, py + 0.7 * S, WW * 0.60, 2.2 * S, 0.5 * S)
       .fill({ color: 0xffffff, alpha: 0.55 });
    }
    // HUD amber glow over all 4 panes
    const hudW = 2 * WW + WGAP;
    const hudH = 2 * WH + WGAP;
    g.roundRect(WX, WY, hudW, hudH, 1.5 * S)
     .fill({ color: 0xffaa00, alpha: 0.10 + 0.04 * beat });
    // Full window frame outer stroke
    g.roundRect(WX - 1 * S, WY - 1 * S, hudW + 2 * S, hudH + 2 * S, 2 * S)
     .stroke({ width: 1.2 * S, color: COL_HELI_TRIM });

    // ── Pilot helmet ──────────────────────────────────────────────────────────
    const PHX = WX + hudW + WGAP * 0.5;
    const PHY = WY + hudH * 0.65;
    // Helmet shell
    g.circle(PHX, PHY, 4.8 * S).fill({ color: 0x0a1828, alpha: 0.95 });
    g.circle(PHX, PHY, 4.8 * S).stroke({ width: 0.6 * S, color: COL_HELI_TRIM, alpha: 0.60 });
    // Helmet body ellipse (torso outline)
    g.ellipse(PHX, PHY + 5 * S, 3.5 * S, 4 * S).fill({ color: 0x0c1e30, alpha: 0.80 });
    // Visor tint reflection ellipse
    g.ellipse(PHX - 1 * S, PHY - 1 * S, 3 * S, 2.2 * S)
     .fill({ color: 0x60a0d8, alpha: 0.30 });

    // ── Wing pylons with weapon pods ──────────────────────────────────────────
    // Pylon struts
    g.moveTo(cx - 8 * S, cy + 12 * S).lineTo(cx - 18 * S, cy + 20 * S)
     .moveTo(cx + 12 * S, cy + 12 * S).lineTo(cx + 22 * S, cy + 20 * S)
     .stroke({ width: 1.2 * S, color: 0x1e2e3e });

    // Left rocket pod
    g.roundRect(cx - 26 * S, cy + 18 * S, 16 * S, 5 * S, 1.5 * S)
     .fill(0x0e1820).stroke({ width: 0.8 * S, color: 0x3a5a7a });
    // Left pod leading fin
    g.moveTo(cx - 26 * S, cy + 18 * S)
     .lineTo(cx - 30 * S, cy + 15 * S)
     .lineTo(cx - 26 * S, cy + 20 * S)
     .stroke({ width: 0.8 * S, color: 0x2a4a6a, alpha: 0.70 });
    // Left pod 4 rocket tubes
    for (let i = 0; i < 4; i++) {
      g.circle(cx + (-24 + i * 3.5) * S, cy + 20.5 * S, 1.1 * S).fill(0x001018);
      g.circle(cx + (-24 + i * 3.5) * S, cy + 20.5 * S, 0.6 * S).fill({ color: 0x003040, alpha: 0.70 });
    }

    // Right rocket pod
    g.roundRect(cx + 14 * S, cy + 18 * S, 16 * S, 5 * S, 1.5 * S)
     .fill(0x0e1820).stroke({ width: 0.8 * S, color: 0x3a5a7a });
    // Right pod leading fin
    g.moveTo(cx + 14 * S, cy + 18 * S)
     .lineTo(cx + 10 * S, cy + 15 * S)
     .lineTo(cx + 14 * S, cy + 20 * S)
     .stroke({ width: 0.8 * S, color: 0x2a4a6a, alpha: 0.70 });
    // Right pod 4 rocket tubes
    for (let i = 0; i < 4; i++) {
      g.circle(cx + (16 + i * 3.5) * S, cy + 20.5 * S, 1.1 * S).fill(0x001018);
      g.circle(cx + (16 + i * 3.5) * S, cy + 20.5 * S, 0.6 * S).fill({ color: 0x003040, alpha: 0.70 });
    }

    // ── Landing skids ──────────────────────────────────────────────────────────
    // Forward diagonal braces
    g.moveTo(cx - 18 * S, cy + 12 * S).lineTo(cx - 28 * S, cy + 26 * S)
     .stroke({ width: 0.9 * S, color: 0x2a4a6a, alpha: 0.60 });
    g.moveTo(cx + 16 * S, cy + 12 * S).lineTo(cx + 24 * S, cy + 26 * S)
     .stroke({ width: 0.9 * S, color: 0x2a4a6a, alpha: 0.60 });
    // Main struts
    g.moveTo(cx - 22 * S, cy + 12 * S).lineTo(cx - 24 * S, cy + 26 * S)
     .moveTo(cx + 12 * S, cy + 12 * S).lineTo(cx + 14 * S, cy + 26 * S)
     .stroke({ width: 1.8 * S, color: COL_HELI_TRIM });
    // Skid cross-tube
    g.moveTo(cx - 30 * S, cy + 26 * S).lineTo(cx + 22 * S, cy + 26 * S)
     .stroke({ width: 1.8 * S, color: COL_HELI_TRIM });
    // Anti-skid yellow tape stripes — 5 stripes along cross-tube
    for (let i = 0; i < 5; i++) {
      const tx = cx + (-26 + i * 9) * S;
      g.rect(tx, cy + 25.2 * S, 3.5 * S, 1.6 * S)
       .fill({ color: 0xddaa00, alpha: 0.55 });
    }
    // Skid toe caps
    g.roundRect(cx - 32 * S, cy + 24.5 * S, 6 * S, 3 * S, 1 * S).fill(0x1a2a3a);
    g.roundRect(cx + 22 * S, cy + 24.5 * S, 6 * S, 3 * S, 1 * S).fill(0x1a2a3a);

    // ── Navigation lights ──────────────────────────────────────────────────────
    const nf = Math.floor(now / 500) % 2 === 0;
    // Port nav light on skid toe cap (left toe)
    if (nf) {
      g.circle(cx - 30 * S, cy + 26 * S, 2.5 * S).fill({ color: 0xff2200, alpha: 0.95 });
      g.circle(cx - 30 * S, cy + 26 * S, 5   * S).fill({ color: 0xff2200, alpha: 0.18 });
    }
    // Strobe — offset by 250 ms from nav light
    if (Math.floor((now + 250) / 500) % 2 === 0) {
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

    // ── Tail boom — shadow underside + main body ───────────────────────────────
    // Shadow underside
    ctx.fillStyle = 'rgba(4,8,16,0.50)';
    ctx.beginPath();
    ctx.moveTo(cx - 38 * s, cy + 5 * s);
    ctx.lineTo(cx - 76 * s, cy + 3.5 * s);
    ctx.lineTo(cx - 76 * s, cy + 8 * s);
    ctx.lineTo(cx - 38 * s, cy + 11 * s);
    ctx.closePath();
    ctx.fill();
    // Main boom
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

    // ── Vertical tail fin — shadow + main ─────────────────────────────────────
    // Shadow trailing face
    ctx.fillStyle = 'rgba(4,8,16,0.45)';
    ctx.beginPath();
    ctx.moveTo(cx - 64 * s, cy + 3 * s);
    ctx.lineTo(cx - 67 * s, cy - 24 * s);
    ctx.lineTo(cx - 65 * s, cy - 24 * s);
    ctx.lineTo(cx - 62 * s, cy + 3 * s);
    ctx.closePath();
    ctx.fill();
    // Main fin
    ctx.fillStyle   = '#0e1824';
    ctx.strokeStyle = '#3d6e9e';
    ctx.lineWidth   = Math.max(1, 1 * s);
    ctx.beginPath();
    ctx.moveTo(cx - 76 * s, cy + 5 * s);
    ctx.lineTo(cx - 76 * s, cy - 14 * s);
    ctx.lineTo(cx - 70 * s, cy - 14 * s);
    ctx.lineTo(cx - 67 * s, cy + 3 * s);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // ── Tail rotor ────────────────────────────────────────────────────────────
    ctx.strokeStyle = '#3d6e9e';
    ctx.lineWidth   = Math.max(1, 1.2 * s);
    ctx.beginPath();
    ctx.moveTo(cx - 76 * s, cy - 12 * s);
    ctx.lineTo(cx - 76 * s, cy + 1 * s);
    ctx.stroke();

    // ── Fuselage — shadow + main + highlight + armour edge ────────────────────
    const r  = 4 * s;
    // Shadow underside
    ctx.fillStyle = 'rgba(4,7,16,0.50)';
    const sdx = cx - 38 * s, sdy = cy + 1 * s, sdw = 76 * s, sdh = 12 * s;
    ctx.beginPath();
    ctx.moveTo(sdx + r, sdy);
    ctx.lineTo(sdx + sdw - r, sdy);
    ctx.arcTo(sdx + sdw, sdy, sdx + sdw, sdy + r, r);
    ctx.lineTo(sdx + sdw, sdy + sdh - r);
    ctx.arcTo(sdx + sdw, sdy + sdh, sdx + sdw - r, sdy + sdh, r);
    ctx.lineTo(sdx + r, sdy + sdh);
    ctx.arcTo(sdx, sdy + sdh, sdx, sdy + sdh - r, r);
    ctx.lineTo(sdx, sdy + r);
    ctx.arcTo(sdx, sdy, sdx + r, sdy, r);
    ctx.closePath();
    ctx.fill();
    // Main body
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
    // Top highlight band
    ctx.fillStyle = 'rgba(48,96,168,0.13)';
    const hr = 3 * s;
    const hx = cx - 37 * s, hy = cy - 11 * s, hw = 74 * s, hh = 7.5 * s;
    ctx.beginPath();
    ctx.moveTo(hx + hr, hy);
    ctx.lineTo(hx + hw - hr, hy);
    ctx.arcTo(hx + hw, hy, hx + hw, hy + hr, hr);
    ctx.lineTo(hx + hw, hy + hh - hr);
    ctx.arcTo(hx + hw, hy + hh, hx + hw - hr, hy + hh, hr);
    ctx.lineTo(hx + hr, hy + hh);
    ctx.arcTo(hx, hy + hh, hx, hy + hh - hr, hr);
    ctx.lineTo(hx, hy + hr);
    ctx.arcTo(hx, hy, hx + hr, hy, hr);
    ctx.closePath();
    ctx.fill();
    // Armour plate top edge
    ctx.strokeStyle = 'rgba(42,62,84,0.65)';
    ctx.lineWidth   = Math.max(1, 2.2 * s);
    ctx.beginPath();
    ctx.moveTo(cx - 36 * s, cy - 11.5 * s);
    ctx.lineTo(cx + 36 * s, cy - 11.5 * s);
    ctx.stroke();

    // ── Panel lines ───────────────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(42,74,106,0.55)';
    ctx.lineWidth   = Math.max(0.5, 0.8 * s);
    // Vertical bulkheads
    ctx.beginPath();
    ctx.moveTo(cx - 18 * s, cy - 12 * s); ctx.lineTo(cx - 18 * s, cy + 12 * s);
    ctx.moveTo(cx + 10 * s, cy - 12 * s); ctx.lineTo(cx + 10 * s, cy + 12 * s);
    ctx.stroke();
    // Access hatch rects
    ctx.beginPath();
    ctx.strokeRect(cx - 16 * s, cy - 10 * s, 12 * s, 8 * s);
    ctx.strokeRect(cx - 16 * s, cy + 0.5 * s, 12 * s, 9 * s);

    // ── Rivet rows top and bottom ──────────────────────────────────────────────
    ctx.fillStyle = 'rgba(58,90,128,0.52)';
    for (let rx = -33; rx <= 36; rx += 7) {
      ctx.beginPath();
      ctx.arc(cx + rx * s, cy - 11.5 * s, Math.max(0.5, 0.9 * s), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(42,74,106,0.42)';
    for (let rx = -33; rx <= 36; rx += 7) {
      ctx.beginPath();
      ctx.arc(cx + rx * s, cy + 11.5 * s, Math.max(0.5, 0.9 * s), 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Cockpit nose ──────────────────────────────────────────────────────────
    // Shadow underside
    ctx.fillStyle = 'rgba(4,8,16,0.45)';
    ctx.beginPath();
    ctx.moveTo(cx + 38 * s, cy + 5 * s);
    ctx.lineTo(cx + 68 * s, cy + 3 * s);
    ctx.lineTo(cx + 38 * s, cy + 14 * s);
    ctx.closePath();
    ctx.fill();
    // Main nose
    ctx.fillStyle   = '#111d28';
    ctx.strokeStyle = '#3d6e9e';
    ctx.lineWidth   = Math.max(1, 1.5 * s);
    ctx.beginPath();
    ctx.moveTo(cx + 38 * s, cy - 12 * s);
    ctx.lineTo(cx + 65 * s, cy);
    ctx.lineTo(cx + 38 * s, cy + 12 * s);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // ── Cockpit 4-pane window (2×2) with pilot helmet ─────────────────────────
    const WX = cx + 40 * s;
    const WY = cy - 9.5 * s;
    const WW = 8 * s;
    const WH = 7.5 * s;
    const WGAP = 1 * s;
    const paneCfg = [
      { col: 0, row: 0 }, { col: 1, row: 0 },
      { col: 0, row: 1 }, { col: 1, row: 1 },
    ];
    for (const { col, row } of paneCfg) {
      const px = WX + col * (WW + WGAP);
      const py = WY + row * (WH + WGAP);
      // Dark recess
      ctx.fillStyle = 'rgba(5,12,24,0.90)';
      ctx.fillRect(px - 0.8 * s, py - 0.8 * s, WW + 1.6 * s, WH + 1.6 * s);
      // Glass fill — vibrant teal cockpit
      ctx.fillStyle = 'rgba(10,74,122,0.95)';
      ctx.fillRect(px, py, WW, WH);
      // Inner glow
      ctx.fillStyle = 'rgba(34,136,204,0.22)';
      ctx.fillRect(px + 0.5 * s, py + 0.5 * s, WW - 1 * s, WH - 1 * s);
      // Frame
      ctx.strokeStyle = 'rgba(136,208,255,0.80)';
      ctx.lineWidth   = Math.max(0.5, 1.0 * s);
      ctx.strokeRect(px, py, WW, WH);
      // Vertical divider
      ctx.strokeStyle = 'rgba(58,106,154,0.80)';
      ctx.lineWidth   = Math.max(0.3, 0.6 * s);
      ctx.beginPath();
      ctx.moveTo(px + WW * 0.5, py); ctx.lineTo(px + WW * 0.5, py + WH);
      ctx.stroke();
      // Reflection highlight — strong white streak
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(px + 0.8 * s, py + 0.7 * s, WW * 0.60, 2.2 * s);
    }
    // Pilot helmet
    const PHX = WX + 2 * WW + WGAP + WGAP * 0.5;
    const PHY = WY + (2 * WH + WGAP) * 0.65;
    // Helmet shell
    ctx.fillStyle = 'rgba(10,24,40,0.95)';
    ctx.beginPath();
    ctx.arc(PHX, PHY, 4.8 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(61,110,158,0.60)';
    ctx.lineWidth   = Math.max(0.4, 0.6 * s);
    ctx.stroke();
    // Visor tint
    ctx.fillStyle = 'rgba(96,160,216,0.30)';
    ctx.beginPath();
    ctx.ellipse(PHX - 1 * s, PHY - 1 * s, 3 * s, 2.2 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── Rotor mast ────────────────────────────────────────────────────────────
    ctx.strokeStyle = '#7aaed8';
    ctx.lineWidth   = Math.max(1, 2 * s);
    ctx.beginPath();
    ctx.moveTo(cx, cy - 12 * s);
    ctx.lineTo(cx, cy - 22 * s);
    ctx.stroke();

    // ── Main rotor — disc + tip-trace circle + 3 ghost blade lines ────────────
    // Translucent disc fill
    ctx.fillStyle = 'rgba(138,184,216,0.14)';
    ctx.beginPath();
    ctx.arc(cx, cy - 22 * s, 63 * s, 0, Math.PI * 2);
    ctx.fill();
    // Tip-trace circle
    ctx.strokeStyle = 'rgba(170,212,240,0.28)';
    ctx.lineWidth   = Math.max(1, 1.4 * s);
    ctx.beginPath();
    ctx.arc(cx, cy - 22 * s, 63 * s, 0, Math.PI * 2);
    ctx.stroke();
    // Motion-blur ghost traces
    const ghostAngles = [Math.PI / 8, Math.PI / 5, Math.PI / 3.2, Math.PI / 2.4];
    const ghostAlphas = [0.10, 0.07, 0.05, 0.03];
    for (let b = 0; b < 4; b++) {
      const a  = ghostAngles[b];
      const bx = Math.cos(a) * 62 * s;
      const by = Math.sin(a) * 62 * s;
      ctx.globalAlpha = ghostAlphas[b];
      ctx.strokeStyle = '#5a9acc';
      ctx.lineWidth   = Math.max(1, 2.2 * s);
      ctx.beginPath();
      ctx.moveTo(cx - bx, cy - 22 * s - by);
      ctx.lineTo(cx + bx, cy - 22 * s + by);
      ctx.stroke();
    }
    // Bright current blade at 0°
    ctx.globalAlpha = 0.82;
    ctx.strokeStyle = '#c8e0f8';
    ctx.lineWidth   = Math.max(1.5, 2.8 * s);
    ctx.beginPath();
    ctx.moveTo(cx - 62 * s, cy - 22 * s);
    ctx.lineTo(cx + 62 * s, cy - 22 * s);
    ctx.stroke();
    // Leading-edge specular
    ctx.globalAlpha = 0.30;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = Math.max(0.5, 1.0 * s);
    ctx.beginPath();
    ctx.moveTo(cx - 62 * s, cy - 22 * s);
    ctx.lineTo(cx + 62 * s, cy - 22 * s);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // ── Landing skids ─────────────────────────────────────────────────────────
    ctx.strokeStyle = '#3d6e9e';
    ctx.lineWidth   = Math.max(1, 1.5 * s);
    ctx.beginPath();
    ctx.moveTo(cx - 22 * s, cy + 12 * s);
    ctx.lineTo(cx - 24 * s, cy + 24 * s);
    ctx.moveTo(cx + 12 * s, cy + 12 * s);
    ctx.lineTo(cx + 14 * s, cy + 24 * s);
    ctx.moveTo(cx - 30 * s, cy + 24 * s);
    ctx.lineTo(cx + 22 * s, cy + 24 * s);
    ctx.stroke();
    // Anti-skid tape stripes
    ctx.fillStyle = 'rgba(221,170,0,0.55)';
    for (let i = 0; i < 5; i++) {
      const tx = cx + (-26 + i * 9) * s;
      ctx.fillRect(tx, cy + 23.5 * s, 3.5 * s, 1.6 * s);
    }
  }
}
