import * as PIXI from 'pixi.js';
import { W, H, GROUND_Y, COL_GREEN, COL_DK_GREEN, CAVE_SCROLL_SPD } from '../utils/constants';
import { dist } from '../utils/math';
import type { FwdMissileData } from '../entities/Missile';

// Cave profile: returns { ceil, floor } Y values at a given world-X scroll position
export function caveProfile(scrollX: number): { ceil: number; floor: number } {
  const wx = scrollX;
  const ceil  = 60 + 30 + 25 * Math.sin(wx * 0.008) + 15 * Math.sin(wx * 0.021 + 1.3);
  const floor = GROUND_Y - 50 - 20 * Math.sin(wx * 0.009 + 0.8) - 12 * Math.sin(wx * 0.019 + 2.1);
  return { ceil, floor };
}

interface Formation {
  wx: number;    // world x (scrolls left)
  ceilPts: number[];
  floorPts: number[];
}

interface CaveRock {
  wx: number; wy: number;
  r: number;
  onCeil: boolean;
}

interface CaveMissileData {
  x: number; y: number;
  vx: number; vy: number;
}

export class CaveSystem {
  readonly container: PIXI.Container;
  private readonly gfx: PIXI.Graphics;

  private scrollX = 0;
  private formations: Formation[] = [];
  private rocks: CaveRock[] = [];
  private caveMissiles: CaveMissileData[] = [];
  private caveMissileTimer = 60;

  crashed = false;
  crashTimer = 0;
  crashAlpha = 0;

  constructor() {
    this.container = new PIXI.Container();
    this.gfx = new PIXI.Graphics();
    this.container.addChild(this.gfx);
  }

  init(): void {
    this.scrollX = 0;
    this.formations = [];
    this.rocks = [];
    this.caveMissiles = [];
    this.caveMissileTimer = 60;
    this.crashed = false;
    this.crashTimer = 0;
    this.crashAlpha = 0;
    this._seedFormations();
    this._seedRocks();
  }

  private _seedFormations(): void {
    for (let i = 0; i < 4; i++) {
      this._spawnFormation(W + i * 280 + Math.random() * 120);
    }
  }

  private _spawnFormation(wx: number): void {
    const pts = this._buildFormation(wx);
    this.formations.push(pts);
  }

  private _buildFormation(wx: number): Formation {
    const { ceil, floor } = caveProfile(wx);
    const mid = (ceil + floor) / 2;
    const gap = 55 + Math.random() * 25;
    const ceilPts: number[] = [];
    const floorPts: number[] = [];
    for (let dx = -30; dx <= 30; dx += 5) {
      ceilPts.push(wx + dx, ceil + (mid - ceil) * (1 - Math.abs(dx) / 30) - gap / 2);
      floorPts.push(wx + dx, floor - (floor - mid) * (1 - Math.abs(dx) / 30) + gap / 2);
    }
    return { wx, ceilPts, floorPts };
  }

  private _seedRocks(): void {
    for (let i = 0; i < 6; i++) {
      const wx = W + 120 + i * 180 + Math.random() * 80;
      const { ceil, floor } = caveProfile(wx);
      const onCeil = Math.random() < 0.5;
      const wy = onCeil ? ceil + 14 : floor - 14;
      this.rocks.push({ wx, wy, r: 10 + Math.random() * 14 | 0, onCeil });
    }
  }

  get currentScroll(): number { return this.scrollX; }

  getProfile(screenX: number): { ceil: number; floor: number } {
    return caveProfile(this.scrollX + screenX);
  }

  update(
    heliX: number, heliY: number, hitMult: number,
    _playerFireFwdMissile: (x: number, y: number) => FwdMissileData,
    onCrash: () => void,
  ): void {
    if (this.crashed) {
      this.crashTimer++;
      this.crashAlpha = Math.min(1, this.crashAlpha + 0.025);
      return;
    }

    this.scrollX += CAVE_SCROLL_SPD;

    // Formations — scroll left (subtract spd from wx)
    for (const f of this.formations) {
      for (let i = 0; i < f.ceilPts.length; i += 2) f.ceilPts[i]  -= CAVE_SCROLL_SPD;
      for (let i = 0; i < f.floorPts.length; i += 2) f.floorPts[i] -= CAVE_SCROLL_SPD;
      f.wx -= CAVE_SCROLL_SPD;
    }
    this.formations = this.formations.filter(f => f.wx + 30 > -10);
    const lastF = this.formations[this.formations.length - 1];
    if (!lastF || lastF.wx < W + 60) {
      this._spawnFormation((lastF ? lastF.wx : W) + 200 + Math.random() * 100);
    }

    // Rocks
    for (const r of this.rocks) r.wx -= CAVE_SCROLL_SPD;
    this.rocks = this.rocks.filter(r => r.wx + r.r > -20);
    const lastR = this.rocks[this.rocks.length - 1];
    if (!lastR || lastR.wx < W + 60) {
      const wx = (lastR ? lastR.wx : W) + 120 + Math.random() * 100;
      const { ceil, floor } = caveProfile(this.scrollX + wx);
      const onCeil = Math.random() < 0.5;
      this.rocks.push({ wx, wy: onCeil ? ceil + 14 : floor - 14, r: 10 + Math.random() * 14 | 0, onCeil });
    }

    // Cave wall collision
    const { ceil: cc, floor: cf } = caveProfile(this.scrollX + heliX);
    const hs = hitMult;
    if (heliY - 22 * hs < cc || heliY + 24 * hs > cf) {
      this._triggerCrash(onCrash);
      return;
    }

    // Rock collision
    for (const r of this.rocks) {
      if (dist(heliX, heliY, r.wx, r.wy) < r.r + 16 * hs) {
        this._triggerCrash(onCrash);
        return;
      }
    }

    // Cave missiles (fly left from right edge)
    if (--this.caveMissileTimer <= 0) {
      this.caveMissileTimer = 90 + Math.floor(Math.random() * 80);
      const { ceil, floor } = caveProfile(this.scrollX + W);
      const my = ceil + (floor - ceil) * (0.25 + Math.random() * 0.5);
      this.caveMissiles.push({
        x: W + 20, y: my,
        vx: -(3.5 + Math.random() * 2),
        vy: (Math.random() - 0.5) * 1.2,
      });
    }

    this.caveMissiles = this.caveMissiles.filter(m => {
      m.x += m.vx; m.y += m.vy;
      if (m.x < -20) return false;
      if (dist(m.x, m.y, heliX, heliY) < 18 * hs) {
        this._triggerCrash(onCrash);
        return false;
      }
      return true;
    });
  }

  /** Called when player fires in cave — checks if a cave missile is hit */
  fireCaveMissile(fwd: FwdMissileData): boolean {
    for (let i = this.caveMissiles.length - 1; i >= 0; i--) {
      const m = this.caveMissiles[i];
      if (dist(fwd.x, fwd.y, m.x, m.y) < 20) {
        this.caveMissiles.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  private _triggerCrash(onCrash: () => void): void {
    if (this.crashed) return;
    this.crashed = true;
    this.crashTimer = 1;
    onCrash();
  }

  draw(_heliX: number, _heliY: number): void {
    const g = this.gfx;
    g.clear();

    // Cave ceiling polygon (fills area above cave profile)
    const ceilPts: number[] = [0, 0, W, 0];
    for (let x = 0; x <= W; x += 8) {
      const { ceil } = caveProfile(this.scrollX + x);
      ceilPts.push(W - x + 8, ceil);
    }
    // Close polygon back to top-left via the profile
    const ceilPolyFwd: number[] = [0, 0];
    for (let x = 0; x <= W; x += 8) {
      const { ceil } = caveProfile(this.scrollX + x);
      ceilPolyFwd.push(x, ceil);
    }
    ceilPolyFwd.push(W, 0);
    g.poly(ceilPolyFwd).fill(COL_DK_GREEN);

    // Cave floor polygon
    const floorPolyFwd: number[] = [0, H];
    for (let x = 0; x <= W; x += 8) {
      const { floor } = caveProfile(this.scrollX + x);
      floorPolyFwd.push(x, floor);
    }
    floorPolyFwd.push(W, H);
    g.poly(floorPolyFwd).fill(COL_DK_GREEN);

    // Cave border lines
    const ceilLine: number[] = [];
    const floorLine: number[] = [];
    for (let x = 0; x <= W; x += 4) {
      const { ceil, floor } = caveProfile(this.scrollX + x);
      ceilLine.push(x, ceil);
      floorLine.push(x, floor);
    }
    if (ceilLine.length >= 4) {
      g.moveTo(ceilLine[0], ceilLine[1]);
      for (let i = 2; i < ceilLine.length; i += 2) g.lineTo(ceilLine[i], ceilLine[i + 1]);
      g.stroke({ width: 1.5, color: COL_GREEN });
    }
    if (floorLine.length >= 4) {
      g.moveTo(floorLine[0], floorLine[1]);
      for (let i = 2; i < floorLine.length; i += 2) g.lineTo(floorLine[i], floorLine[i + 1]);
      g.stroke({ width: 1.5, color: COL_GREEN });
    }

    // Formations (rock blockades with gap)
    for (const f of this.formations) {
      if (f.ceilPts.length >= 4) {
        g.poly(f.ceilPts).fill({ color: 0x003a10, alpha: 0.8 }).stroke({ width: 1, color: COL_GREEN });
      }
      if (f.floorPts.length >= 4) {
        g.poly(f.floorPts).fill({ color: 0x003a10, alpha: 0.8 }).stroke({ width: 1, color: COL_GREEN });
      }
    }

    // Rocks
    for (const r of this.rocks) {
      g.circle(r.wx, r.wy, r.r).fill(0x003a10).stroke({ width: 1.5, color: COL_GREEN });
    }

    // Cave missiles (flying left)
    for (const m of this.caveMissiles) {
      g.circle(m.x, m.y, 4).fill(0xff3300);
      g.moveTo(m.x, m.y).lineTo(m.x - m.vx * 4, m.y - m.vy * 4)
       .stroke({ width: 2, color: 0xff6600, alpha: 0.6 });
    }

    // Crash overlay
    if (this.crashed && this.crashTimer > 0) {
      g.rect(0, 0, W, H).fill({ color: 0x000010, alpha: this.crashAlpha * 0.72 });
      if (this.crashAlpha > 0.3) {
        // Text overlay rendered by GameScene
      }
    }
  }
}
