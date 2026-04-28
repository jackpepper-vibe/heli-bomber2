import * as PIXI from 'pixi.js';
import { GROUND_Y, COL_GREEN, COL_DK_GREEN, COL_LT_GREEN } from '../utils/constants';
import { blinkMs } from '../utils/math';

export type BuildingType = 'building' | 'fuel' | 'radar' | 'bunker';

export interface LayerDef {
  w: number;
  h: number;
  wins: boolean[];
}

export interface BuildingData {
  x: number;
  baseW: number;
  type: BuildingType;
  layers: LayerDef[];
  totalLayers: number;
  hp: number;
  maxHp: number;
  damaged: boolean;
  shade: number;
  crackSeed: number;
  hasWaterTower: boolean;
  hasAntenna: boolean;
  hasNeon: boolean;
}

function layerRects(b: BuildingData): Array<{ i: number; x: number; y: number; w: number; h: number }> {
  const cx = b.x + b.baseW / 2;
  let curY = GROUND_Y;
  return b.layers.map((lay, i) => {
    const r = { i, x: cx - lay.w / 2, y: curY - lay.h, w: lay.w, h: lay.h };
    curY -= lay.h;
    return r;
  });
}

export function mkBuilding(startX: number): BuildingData {
  const r = Math.random();
  const type: BuildingType =
    r < 0.07 ? 'fuel' : r < 0.14 ? 'radar' : r < 0.21 ? 'bunker' : 'building';

  if (type === 'fuel') return mkFuel(startX);
  if (type === 'radar') return mkRadar(startX);
  if (type === 'bunker') return mkBunker(startX);

  const nLayers = 1 + Math.floor(Math.random() * 4);
  const baseW = 28 + Math.random() * 44 | 0;
  const layers: LayerDef[] = [];
  let w = baseW;
  for (let i = 0; i < nLayers; i++) {
    const h = 16 + Math.random() * 36 | 0;
    const nw = Math.max(2, Math.floor(w / 10));
    const wins = Array.from({ length: nw }, () => Math.random() > 0.3);
    layers.push({ w, h, wins });
    w = Math.max(12, (w * (0.6 + Math.random() * 0.25)) | 0);
  }
  return {
    x: startX, baseW, type: 'building', layers,
    totalLayers: nLayers, hp: nLayers,
    maxHp: nLayers, damaged: false,
    shade: COL_DK_GREEN, crackSeed: Math.random(),
    hasWaterTower: Math.random() < 0.3,
    hasAntenna: Math.random() < 0.5,
    hasNeon: Math.random() < 0.35,
  };
}

function mkFuel(x: number): BuildingData {
  const baseW = 44;
  return {
    x, baseW, type: 'fuel',
    layers: [{ w: 36, h: 44, wins: [] }],
    totalLayers: 1, hp: 1, maxHp: 1,
    damaged: false, shade: 0x001e0a, crackSeed: Math.random(),
    hasWaterTower: false, hasAntenna: false, hasNeon: false,
  };
}

function mkRadar(x: number): BuildingData {
  const baseW = 38;
  return {
    x, baseW, type: 'radar',
    layers: [
      { w: 30, h: 14, wins: [] },
      { w: 6,  h: 30, wins: [] },
      { w: 4,  h: 20, wins: [] },
      { w: 28, h: 12, wins: [] },
    ],
    totalLayers: 2, hp: 2, maxHp: 2,
    damaged: false, shade: 0x001800, crackSeed: Math.random(),
    hasWaterTower: false, hasAntenna: false, hasNeon: false,
  };
}

function mkBunker(x: number): BuildingData {
  const baseW = 52;
  return {
    x, baseW, type: 'bunker',
    layers: [
      { w: 50, h: 22, wins: [] },
      { w: 40, h: 16, wins: [] },
    ],
    totalLayers: 2, hp: 3, maxHp: 3,
    damaged: false, shade: 0x001a08, crackSeed: Math.random(),
    hasWaterTower: false, hasAntenna: false, hasNeon: false,
  };
}

export function seedBuildings(): BuildingData[] {
  const arr: BuildingData[] = [];
  let x = 60;
  while (x < W_REF * 1.5) {
    const b = mkBuilding(x);
    arr.push(b);
    x += b.baseW + 80 + Math.random() * 80 | 0;
  }
  return arr;
}

const W_REF = 920;

export function getBuildingRects(b: BuildingData) {
  return layerRects(b);
}

/** Check if bomb hits this building. Returns layer index hit or -1. */
export function checkBombHit(b: BuildingData, bx: number, by: number): number {
  if (bx < b.x - 3 || bx > b.x + b.baseW + 3) return -1;
  const rects = layerRects(b);
  for (const r of rects) {
    if (bx >= r.x && bx <= r.x + r.w && by >= r.y && by <= r.y + r.h) return r.i;
  }
  return -1;
}

export class BuildingRenderer {
  readonly container: PIXI.Container;
  private readonly gfx: PIXI.Graphics;

  constructor() {
    this.container = new PIXI.Container();
    this.gfx = new PIXI.Graphics();
    this.container.addChild(this.gfx);
  }

  draw(buildings: BuildingData[]): void {
    const g = this.gfx;
    g.clear();
    for (const b of buildings) {
      if (b.type === 'fuel')   { this._drawFuel(g, b); continue; }
      if (b.type === 'radar')  { this._drawRadar(g, b); continue; }
      if (b.type === 'bunker') { this._drawBunker(g, b); continue; }
      this._drawBuilding(g, b);
    }
  }

  private _drawBuilding(g: PIXI.Graphics, b: BuildingData): void {
    const cx  = b.x + b.baseW / 2;
    const rects = layerRects(b);
    const now = Date.now();

    for (let li = 0; li < rects.length; li++) {
      const r = rects[li];
      const lay = b.layers[li];

      g.rect(r.x, r.y, r.w, r.h).fill(b.damaged ? 0x0a0a00 : b.shade).stroke({ width: 1, color: COL_GREEN });

      if (r.h > 14) {
        g.moveTo(r.x + 1, r.y + r.h * 0.45).lineTo(r.x + r.w - 1, r.y + r.h * 0.45)
         .stroke({ width: 0.5, color: 0x003a10, alpha: 0.6 });
      }

      const wW = 5, wH = Math.min(6, r.h - 5);
      if (lay.wins.length > 0 && wH > 1) {
        const span = r.w - 6;
        const gap = lay.wins.length === 1 ? 0 : (span - wW) / (lay.wins.length - 1);
        lay.wins.forEach((lit, j) => {
          const wx = r.x + 3 + (lay.wins.length === 1 ? (span - wW) / 2 : j * gap);
          const wy = r.y + (r.h - wH) / 2;
          if (lit) {
            const flicker = Math.sin(now * 0.003 + b.x * 0.1 + j * 1.7) > 0.94;
            const wColor = flicker ? 0xcc6600 : 0xffcc44;
            const wAlpha = flicker ? 0.5 : 0.85 + 0.1 * Math.sin(now * 0.002 + b.x + j);
            // Window glow
            g.rect(wx - 1, wy - 1, wW + 2, wH + 2).fill({ color: 0xffaa00, alpha: wAlpha * 0.15 });
            g.rect(wx, wy, wW, wH).fill({ color: wColor, alpha: wAlpha });
            // Window reflection
            g.rect(wx + 1, wy + 1, 1.5, wH * 0.4).fill({ color: 0xfff0c0, alpha: 0.5 });
          } else {
            g.rect(wx, wy, wW, wH).fill(0x001200);
          }
        });
      }
    }

    // Rooftop details
    if (rects.length > 0) {
      const topR = rects[rects.length - 1];
      const topLay = b.layers[b.layers.length - 1];
      if (topLay.h > 20) {
        const rx = topR.x;
        if (b.hasWaterTower) {
          const tx = rx + topLay.w * 0.7;
          g.ellipse(tx, topR.y - 10, 7, 5).fill(0x002800).stroke({ width: 1, color: 0x00aa28 });
          g.moveTo(tx - 6, topR.y - 6).lineTo(tx - 4, topR.y)
           .moveTo(tx, topR.y - 5).lineTo(tx, topR.y)
           .moveTo(tx + 6, topR.y - 6).lineTo(tx + 4, topR.y)
           .stroke({ width: 1, color: 0x00aa28 });
        }
        if (b.hasAntenna) {
          const ah = 14 + Math.random() * 16 | 0;
          g.moveTo(cx, topR.y).lineTo(cx, topR.y - ah).stroke({ width: 1, color: 0x00aa28 });
          g.moveTo(cx - 5, topR.y - ah * 0.6).lineTo(cx + 5, topR.y - ah * 0.6)
           .moveTo(cx - 3, topR.y - ah * 0.8).lineTo(cx + 3, topR.y - ah * 0.8)
           .stroke({ width: 1, color: 0x00aa28 });
          if (blinkMs(600)) g.circle(cx, topR.y - ah, 2).fill({ color: 0xff2200, alpha: 0.75 });
        }
      }
    }

    if (b.hasNeon) {
      const nw = Math.min(b.baseW - 4, 28);
      const nx = b.x + (b.baseW - nw) / 2;
      const ny = GROUND_Y - 12;
      const pulse = Math.sin(Date.now() * 0.004 + b.x);
      const na = 0.55 + 0.35 * pulse;
      // Neon glow layers
      g.rect(nx - 2, ny - 2, nw + 4, 11).fill({ color: COL_GREEN, alpha: na * 0.08 });
      g.rect(nx,     ny,     nw,     7 ).fill({ color: COL_GREEN, alpha: na * 0.12 });
      g.rect(nx,     ny,     nw,     7 ).stroke({ width: 2, color: COL_GREEN, alpha: na });
      // Inner bright line
      g.moveTo(nx + 3, ny + 3).lineTo(nx + nw - 3, ny + 3)
       .stroke({ width: 1, color: 0xaaffc0, alpha: na * 0.65 });
    }

    if (b.damaged && rects.length > 0) {
      this._drawDamage(g, b, cx, rects[rects.length - 1].y);
    }
  }

  private _drawFuel(g: PIXI.Graphics, b: BuildingData): void {
    const cx = b.x + b.baseW / 2;
    const rects = layerRects(b);
    if (rects.length === 0) return;
    const r = rects[0];
    const ty = r.y, th = r.h, tw = r.w;
    const tx = cx - tw / 2;
    const now = Date.now();

    // Support legs
    g.moveTo(tx + 8, GROUND_Y).lineTo(tx + 8, ty + th * 0.65)
     .moveTo(tx + tw - 8, GROUND_Y).lineTo(tx + tw - 8, ty + th * 0.65)
     .moveTo(cx, GROUND_Y).lineTo(cx, ty + th * 0.75)
     .stroke({ width: 2.5, color: 0x00aa44 });

    // Tank body
    g.roundRect(tx, ty, tw, th, 8).fill(b.damaged ? 0x150800 : 0x001e0a).stroke({ width: 1.5, color: 0x00cc44 });

    // Band lines
    g.moveTo(tx + 8, ty + th / 3).lineTo(tx + tw - 8, ty + th / 3)
     .moveTo(tx + 8, ty + th * 2 / 3).lineTo(tx + tw - 8, ty + th * 2 / 3)
     .stroke({ width: 0.8, color: 0x00aa44, alpha: 0.55 });

    // Top dome
    g.ellipse(cx, ty + 4, tw * 0.42, 9).fill(b.damaged ? 0x1a0a00 : 0x003a12)
     .stroke({ width: 1, color: 0x00cc44 });

    // FUEL label
    // (rendered via separate text layer in GameScene for proper font)

    // Hazard stripes
    for (let i = 0; i < 3; i++) {
      g.rect(tx + i * (tw / 3), ty + th - 8, tw / 3, 8)
       .fill({ color: i % 2 === 0 ? 0xffaa00 : 0x001800, alpha: 0.45 });
    }

    // Fire if damaged
    if (b.damaged) {
      const flicker = 0.5 + 0.5 * Math.random();
      g.circle(cx, ty - 6, 6 + Math.random() * 8).fill({ color: 0xff5500, alpha: flicker * 0.85 });
      g.circle(cx, ty - 9, 3 + Math.random() * 4).fill({ color: 0xffcc00, alpha: flicker * 0.85 });
    }

    // Score pulse label
    const pa = 0.55 + 0.25 * Math.sin(now * 0.005 + b.x);
    g.circle(cx, ty - 12, 1).fill({ color: 0xffaa00, alpha: pa }); // placeholder position marker
  }

  private _drawRadar(g: PIXI.Graphics, b: BuildingData): void {
    const cx = b.x + b.baseW / 2;
    const rects = layerRects(b);
    if (rects.length < 2) return;

    // Base platform
    const base = rects[0];
    g.rect(base.x, base.y, base.w, base.h).fill(b.damaged ? 0x0a0800 : 0x001800).stroke({ width: 1.5, color: 0x00cc44 });
    g.moveTo(base.x + 4, base.y + base.h * 0.5).lineTo(base.x + base.w - 4, base.y + base.h * 0.5)
     .stroke({ width: 0.8, color: 0x00aa44, alpha: 0.6 });

    // Masts
    for (let i = 1; i < rects.length - 1; i++) {
      const m = rects[i];
      g.rect(m.x, m.y, m.w, m.h).fill(0x002800).stroke({ width: 1, color: 0x00cc44 });
    }

    // Dish (top element)
    if (rects.length >= 4) {
      const d = rects[rects.length - 1];
      const dy = d.y + d.h / 2;
      g.moveTo(d.x, dy + 5).quadraticCurveTo(cx, dy - 14, d.x + d.w, dy + 5)
       .fill(b.damaged ? 0x0a0a00 : 0x003a14).stroke({ width: 1.5, color: 0x00ff88 });
      g.moveTo(cx, dy + 5).lineTo(cx, rects[rects.length - 2].y).stroke({ width: 1, color: 0x00cc44 });
      if (blinkMs(400)) g.circle(cx, dy - 5, 2.5).fill({ color: 0x00ffaa, alpha: 0.9 });
    }

    if (b.damaged) this._drawDamage(g, b, cx, rects[rects.length - 1].y);
  }

  private _drawBunker(g: PIXI.Graphics, b: BuildingData): void {
    const cx = b.x + b.baseW / 2;
    const rects = layerRects(b);

    for (let ri = 0; ri < rects.length; ri++) {
      const r = rects[ri];
      const isTop = ri === rects.length - 1;
      g.rect(r.x, r.y, r.w, r.h).fill(b.damaged ? 0x0a0a05 : ri === 0 ? 0x001005 : 0x001a08)
       .stroke({ width: 1.5, color: 0x00cc44 });

      if (r.h > 10) {
        g.moveTo(r.x + 2, r.y + r.h * 0.5).lineTo(r.x + r.w - 2, r.y + r.h * 0.5)
         .stroke({ width: 0.8, color: 0x00aa44, alpha: 0.5 });
      }

      // Battlements on top
      if (isTop) {
        const merlonW = 10, merlonH = 8, gap = 10;
        const count = Math.floor(r.w / (merlonW + gap));
        const totalW = count * (merlonW + gap) - gap;
        const startX = r.x + (r.w - totalW) / 2;
        for (let i = 0; i < count; i++) {
          const mx = startX + i * (merlonW + gap);
          g.rect(mx, r.y - merlonH, merlonW, merlonH)
           .fill(b.damaged ? 0x0a0a05 : 0x001a08).stroke({ width: 1, color: 0x00cc44 });
        }
      }

      // Gun slits
      if (ri === 0) {
        const slitCount = Math.max(1, r.w / 22 | 0);
        const spacing = r.w / (slitCount + 1);
        for (let i = 1; i <= slitCount; i++) {
          g.rect(r.x + spacing * i - 6, r.y + r.h * 0.45, 12, 3).fill(0x000500);
        }
      }
    }

    if (b.damaged && rects.length > 0) this._drawDamage(g, b, cx, rects[rects.length - 1].y);
  }

  private _drawDamage(g: PIXI.Graphics, b: BuildingData, cx: number, topY: number): void {
    const seed = b.crackSeed;
    const bx = b.x, bw = b.baseW;
    g.moveTo(bx + bw * (0.3 + seed * 0.2), topY)
     .lineTo(bx + bw * (0.5 + seed * 0.15), topY + 20)
     .lineTo(bx + bw * (0.4 + seed * 0.1), topY + 38)
     .stroke({ width: 0.8, color: COL_LT_GREEN, alpha: 0.55 });
    const flicker = 0.4 + 0.6 * Math.random();
    g.circle(cx, topY - 4, 4 + Math.random() * 5).fill({ color: 0xff4400, alpha: flicker * 0.7 });
    g.circle(cx, topY - 6, 2 + Math.random() * 3).fill({ color: 0xffaa00, alpha: flicker * 0.7 });
  }
}
