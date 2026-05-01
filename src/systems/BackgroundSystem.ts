import * as PIXI from 'pixi.js';
import {
  W, H, GROUND_Y,
  COL_SKY_DEEP, COL_SKY_MID, COL_SKY_HORIZON,
  COL_GROUND_DARK, COL_GROUND_EDGE,
  COL_HUD,
} from '../utils/constants';
import { blinkMs } from '../utils/math';

interface Star   { x: number; y: number; r: number; phase: number; layer: number; }
interface Cloud  { x: number; y: number; w: number; h: number; alpha: number; speed: number; }
interface BgBuilding { x: number; w: number; h: number; wins: Array<{ rx: number; ry: number; lit: boolean }>; }
interface GroundDetail { x: number; type: 'tree' | 'lamp' | 'antenna'; h: number; }

// Star colours: mostly white/silver, rare warm yellow
const STAR_COLORS = [0xffffff, 0xffffff, 0xe8eeff, 0xfff8e0, 0xddeeff];

export class BackgroundSystem {
  readonly container: PIXI.Container;
  private readonly skyGfx:      PIXI.Graphics;
  private readonly starGfx:     PIXI.Graphics;
  private readonly mountainGfx: PIXI.Graphics;
  private readonly cloudGfx:    PIXI.Graphics;
  private readonly bgCityGfx:   PIXI.Graphics;
  private readonly groundGfx:   PIXI.Graphics;
  private readonly detailGfx:   PIXI.Graphics;

  private stars:         Star[]         = [];
  private clouds:        Cloud[]        = [];
  private bgCity:        BgBuilding[]   = [];
  private groundDetails: GroundDetail[] = [];
  private bgScrollX = 0;

  constructor() {
    this.container   = new PIXI.Container();
    this.skyGfx      = new PIXI.Graphics();
    this.starGfx     = new PIXI.Graphics();
    this.mountainGfx = new PIXI.Graphics();
    this.cloudGfx    = new PIXI.Graphics();
    this.bgCityGfx   = new PIXI.Graphics();
    this.groundGfx   = new PIXI.Graphics();
    this.detailGfx   = new PIXI.Graphics();
    this.container.addChild(
      this.skyGfx, this.starGfx, this.mountainGfx,
      this.cloudGfx, this.bgCityGfx, this.groundGfx, this.detailGfx,
    );
  }

  init(): void {
    this.bgScrollX = 0;
    this._initStars();
    this._initClouds();
    this._initBgCity();
    this._seedGroundDetails();
    this._drawStaticSky();
    this._drawMoon();
  }

  // ── Static layers ─────────────────────────────────────────────────────────────

  private _drawStaticSky(): void {
    const g = this.skyGfx;
    g.clear();
    const bands = [
      { y: 0,           h: 60,             color: COL_SKY_DEEP    },
      { y: 60,          h: 60,             color: 0x07101e        },
      { y: 120,         h: 80,             color: COL_SKY_MID     },
      { y: 200,         h: 80,             color: 0x101e32        },
      { y: 280,         h: 80,             color: 0x131f33        },
      { y: 360,         h: GROUND_Y - 360, color: COL_SKY_HORIZON },
    ];
    for (const b of bands) g.rect(0, b.y, W, b.h).fill(b.color);
    // Subtle warm atmospheric haze near horizon
    const hg = GROUND_Y - 30;
    g.rect(0, hg,      W, 30).fill({ color: 0x1a1a30, alpha: 0.30 });
    g.rect(0, hg + 10, W, 20).fill({ color: 0x202040, alpha: 0.18 });
  }

  private _drawMoon(): void {
    const g = this.starGfx;
    const mx = 748, my = 72;
    // Outer glow rings — cool silver-blue
    g.circle(mx, my, 100).fill({ color: 0xaaccff, alpha: 0.008 });
    g.circle(mx, my,  78).fill({ color: 0xbbddff, alpha: 0.018 });
    g.circle(mx, my,  60).fill({ color: 0xccddff, alpha: 0.035 });
    g.circle(mx, my,  46).fill({ color: 0xddeeff, alpha: 0.07  });
    g.circle(mx, my,  36).fill({ color: 0xeef4ff, alpha: 0.13  });
    // Moon body — pale ivory
    g.circle(mx, my, 28).fill({ color: 0xe2dcc8, alpha: 0.92 });
    g.circle(mx, my, 27).fill({ color: 0xeee8d8, alpha: 0.55 });
    // Highlight
    g.circle(mx - 9, my - 9, 11).fill({ color: 0xf8f4e8, alpha: 0.28 });
    g.circle(mx - 11, my - 11, 5).fill({ color: 0xfffcf0, alpha: 0.22 });
    // Craters — darker ivory
    g.circle(mx + 7,  my + 5,  6  ).fill({ color: 0xb8b0a0, alpha: 0.65 });
    g.circle(mx - 4,  my + 9,  4  ).fill({ color: 0xb8b0a0, alpha: 0.55 });
    g.circle(mx + 11, my - 8,  4.5).fill({ color: 0xb8b0a0, alpha: 0.60 });
    g.circle(mx - 9,  my - 2,  3  ).fill({ color: 0xb8b0a0, alpha: 0.50 });
  }

  // ── Init helpers ──────────────────────────────────────────────────────────────

  private _initStars(): void {
    this.stars = [];
    for (let i = 0; i < 120; i++) {
      this.stars.push({ x: Math.random() * W, y: Math.random() * (GROUND_Y - 60),
        r: 0.5, phase: Math.random() * Math.PI * 2, layer: 0 });
    }
    for (let i = 0; i < 55; i++) {
      this.stars.push({ x: Math.random() * W, y: Math.random() * (GROUND_Y - 80),
        r: 0.8 + Math.random() * 0.5, phase: Math.random() * Math.PI * 2, layer: 1 });
    }
    for (let i = 0; i < 18; i++) {
      this.stars.push({ x: Math.random() * W, y: Math.random() * (GROUND_Y - 100),
        r: 1.4 + Math.random() * 0.8, phase: Math.random() * Math.PI * 2, layer: 2 });
    }
  }

  private _initClouds(): void {
    this.clouds = [];
    for (let i = 0; i < 8; i++) {
      this.clouds.push({
        x: Math.random() * W, y: 20 + Math.random() * 120,
        w: 90 + Math.random() * 160, h: 22 + Math.random() * 35,
        alpha: 0.022 + Math.random() * 0.035,
        speed: 0.18 + Math.random() * 0.15,
      });
    }
  }

  private _initBgCity(): void {
    this.bgCity = [];
    let x = 0;
    while (x < W * 5) {
      const h = 22 + Math.random() * 80, w = 18 + Math.random() * 52;
      const wins: BgBuilding['wins'] = [];
      const rows = Math.floor(h / 10), cols = Math.floor(w / 9);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          wins.push({ rx: c / cols, ry: r / rows, lit: Math.random() > 0.45 });
        }
      }
      this.bgCity.push({ x, w, h, wins });
      x += w + 4 + Math.random() * 18;
    }
  }

  private _seedGroundDetails(): void {
    this.groundDetails = [];
    let x = 20;
    while (x < W * 2.5) {
      this.groundDetails.push(this._mkDetail(x));
      x += 28 + Math.random() * 55 | 0;
    }
  }

  private _mkDetail(x: number): GroundDetail {
    const r = Math.random();
    if (r < 0.38) return { x, type: 'tree',    h: 18 + Math.random() * 18 | 0 };
    if (r < 0.68) return { x, type: 'lamp',    h: 26 + Math.random() * 8  | 0 };
    return              { x, type: 'antenna', h: 32 + Math.random() * 22 | 0 };
  }

  // ── Update ────────────────────────────────────────────────────────────────────

  update(spd: number): void {
    this.bgScrollX += spd;
    for (const cl of this.clouds) {
      cl.x -= spd * cl.speed;
      if (cl.x + cl.w / 2 < -10) {
        cl.x   = W + cl.w / 2;
        cl.y   = 20 + Math.random() * 120;
        cl.alpha = 0.022 + Math.random() * 0.035;
      }
    }
    for (const d of this.groundDetails) d.x -= spd;
    this.groundDetails = this.groundDetails.filter(d => d.x > -30);
    const last = this.groundDetails[this.groundDetails.length - 1];
    if (!last || last.x < W + 80) {
      const nx = (last ? last.x : W) + 28 + Math.random() * 55 | 0;
      this.groundDetails.push(this._mkDetail(nx));
    }
  }

  // ── Draw ──────────────────────────────────────────────────────────────────────

  draw(showGround: boolean, showSea = false): void {
    this._drawStars();
    this._drawMountains();
    this._drawClouds();
    this._drawBgCity();
    if (showGround) { this._drawGround(); this._drawGroundDetails(); }
    if (showSea)    this._drawSea();
  }

  private _drawStars(): void {
    const g = this.starGfx;
    g.clear();
    this._drawMoon();

    const now = Date.now();
    const scrollSpeeds = [0, 0.015, 0.04];
    for (const st of this.stars) {
      const sx = ((st.x - this.bgScrollX * scrollSpeeds[st.layer]) % W + W) % W;
      const flicker = 0.5 + 0.5 * Math.sin(st.phase + now * (0.0006 + st.layer * 0.0003));
      const brightness = [0.4, 0.62, 0.88][st.layer];
      const col = STAR_COLORS[Math.floor(st.phase * 7) % STAR_COLORS.length];
      g.circle(sx, st.y, st.r).fill({ color: col, alpha: flicker * brightness });
      if (st.layer === 2 && flicker > 0.75) {
        const sl = st.r * 3.5;
        g.moveTo(sx - sl, st.y).lineTo(sx + sl, st.y)
         .moveTo(sx, st.y - sl).lineTo(sx, st.y + sl)
         .stroke({ width: 0.6, color: 0xddeeff, alpha: flicker * 0.3 });
      }
    }
  }

  private _mtnH(wx: number, amp: number, freq: number, seed: number): number {
    return amp * (
      0.40 * Math.sin(wx * freq         + seed       ) +
      0.28 * Math.sin(wx * freq * 2.30  + seed * 1.7 ) +
      0.20 * Math.sin(wx * freq * 0.61  + seed * 0.5 ) +
      0.12 * Math.sin(wx * freq * 5.10  + seed * 3.2 )
    );
  }

  private _drawMountainRange(
    g: PIXI.Graphics, scroll: number,
    baseY: number, amp: number, freq: number, seed: number,
    color: number, alpha: number,
  ): void {
    const offset = this.bgScrollX * scroll;
    const step   = 5;
    const pts: number[] = [0, baseY];
    for (let sx = 0; sx <= W + step; sx += step) {
      const h  = this._mtnH(sx + offset, amp, freq, seed);
      const py = Math.max(14, baseY - amp * 0.55 - Math.max(0, h));
      pts.push(sx, py);
    }
    pts.push(W, baseY);
    g.poly(pts).fill({ color, alpha });
    const ridgePts: number[] = [];
    for (let sx = 0; sx <= W + step; sx += step) {
      const h = this._mtnH(sx + offset, amp, freq, seed);
      ridgePts.push(sx, Math.max(14, baseY - amp * 0.55 - Math.max(0, h)));
    }
    if (ridgePts.length >= 4) {
      g.moveTo(ridgePts[0], ridgePts[1]);
      for (let i = 2; i < ridgePts.length; i += 2) g.lineTo(ridgePts[i], ridgePts[i + 1]);
      g.stroke({ width: 0.8, color, alpha: alpha * 0.5 });
    }
  }

  private _drawMountains(): void {
    const g = this.mountainGfx;
    g.clear();
    // Far mountains — very dark blue
    this._drawMountainRange(g, 0.06, GROUND_Y - 20, 100, 0.0028, 1.42, 0x060c14, 0.9);
    this._drawMountainRange(g, 0.06, GROUND_Y - 20, 100, 0.0028, 1.42, 0x101e2c, 0.2);
    // Near mountains — slightly lighter
    this._drawMountainRange(g, 0.14, GROUND_Y - 10, 70,  0.0048, 2.88, 0x090f18, 0.95);
    this._drawMountainRange(g, 0.14, GROUND_Y - 10, 70,  0.0048, 2.88, 0x1a2840, 0.14);
  }

  private _drawClouds(): void {
    const g = this.cloudGfx;
    g.clear();
    for (const cl of this.clouds) {
      g.ellipse(cl.x,              cl.y,              cl.w * 0.5,  cl.h * 0.5 ).fill({ color: 0x8090a8, alpha: cl.alpha });
      g.ellipse(cl.x + cl.w * 0.2, cl.y - cl.h * 0.15, cl.w * 0.38, cl.h * 0.45).fill({ color: 0x8090a8, alpha: cl.alpha * 0.75 });
      g.ellipse(cl.x - cl.w * 0.2, cl.y - cl.h * 0.1,  cl.w * 0.33, cl.h * 0.42).fill({ color: 0x8090a8, alpha: cl.alpha * 0.6  });
    }
  }

  private _drawBgCity(): void {
    const g = this.bgCityGfx;
    g.clear();
    const now = Date.now();
    for (const bg of this.bgCity) {
      const sx = ((bg.x - this.bgScrollX * 0.12) % (W * 5) + W * 5) % (W * 5) - 80;
      if (sx > W + 80 || sx + bg.w < -20) continue;
      const topY = GROUND_Y - bg.h;
      // Building silhouette — dark urban
      g.rect(sx, topY, bg.w, bg.h).fill({ color: 0x08090f, alpha: 0.88 });
      g.rect(sx, topY, bg.w, bg.h).stroke({ width: 0.5, color: 0x1a1e30, alpha: 0.5 });
      for (const win of bg.wins) {
        if (!win.lit) continue;
        const wx = sx + win.rx * bg.w + 1.5;
        const wy = topY + win.ry * bg.h + 2;
        const flicker = Math.sin(now * 0.002 + bg.x * 0.07 + win.rx * 13) > 0.94;
        const wColor = flicker ? 0x884400 : 0xffcc44;
        const wAlpha = flicker ? 0.25 : (0.4 + 0.15 * Math.sin(now * 0.001 + win.ry * 7 + bg.x));
        g.rect(wx, wy, 4, 5).fill({ color: wColor, alpha: wAlpha });
        g.rect(wx - 1, wy - 1, 6, 7).fill({ color: 0xffaa00, alpha: wAlpha * 0.12 });
      }
      if (bg.h > 55 && blinkMs(900)) {
        g.circle(sx + bg.w * 0.5, topY - 3, 2).fill({ color: 0xff3300, alpha: 0.85 });
      }
    }
    // City ambient glow at ground — muted blue-grey
    g.rect(0, GROUND_Y - 18, W, 18).fill({ color: 0x0d1020, alpha: 0.45 });
    g.rect(0, GROUND_Y - 8,  W, 8 ).fill({ color: 0x14182a, alpha: 0.28 });
  }

  private _drawGround(): void {
    const g = this.groundGfx;
    g.clear();
    g.rect(0, GROUND_Y, W, H - GROUND_Y).fill(COL_GROUND_DARK);
    g.rect(0, GROUND_Y, W, 6).fill({ color: 0x101a0a, alpha: 0.85 });
    // Subtle grid lines
    for (let y = GROUND_Y + 14; y < H; y += 12) {
      g.moveTo(0, y).lineTo(W, y).stroke({ width: 0.5, color: 0x0a1006, alpha: 0.6 });
    }
    // Ground horizon line — keep the HUD green for readability
    g.moveTo(0, GROUND_Y).lineTo(W, GROUND_Y)
     .stroke({ width: 1.5, color: COL_GROUND_EDGE, alpha: 0.9 });
    g.moveTo(0, GROUND_Y - 1).lineTo(W, GROUND_Y - 1)
     .stroke({ width: 3, color: COL_GROUND_EDGE, alpha: 0.18 });
    g.rect(0, GROUND_Y - 6, W, 6).fill({ color: COL_GROUND_EDGE, alpha: 0.04 });
  }

  private _drawSea(waterPhase = 0): void {
    const g = this.groundGfx;
    g.clear();
    const seaH = H - GROUND_Y;
    g.rect(0, GROUND_Y,               W, seaH * 0.5).fill(0x002244);
    g.rect(0, GROUND_Y + seaH * 0.5,  W, seaH * 0.5).fill(0x001828);
    const now = Date.now() * 0.0004;
    for (let x = 0; x < W; x += 28) {
      const shimA = 0.05 + 0.04 * Math.sin(now + x * 0.04);
      g.rect(x, GROUND_Y, 14, seaH).fill({ color: 0x80ccff, alpha: shimA });
    }
    for (let row = 0; row < 5; row++) {
      const y = GROUND_Y + 5 + row * 9;
      const pts: number[] = [];
      for (let x = 0; x <= W; x += 10) {
        const dy = Math.sin((x + waterPhase * 42 + row * 28) * 0.045) * 2.2;
        pts.push(x, y + dy);
      }
      if (pts.length >= 4) {
        g.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
        g.stroke({ width: 1, color: 0x5bb8e8, alpha: 0.22 - row * 0.03 });
      }
    }
    g.moveTo(0, GROUND_Y).lineTo(W, GROUND_Y).stroke({ width: 1.5, color: 0x3a88c0 });
  }

  drawSea(waterPhase: number): void { this._drawSea(waterPhase); }

  private _drawGroundDetails(): void {
    const g = this.detailGfx;
    g.clear();
    const now = Date.now();
    for (const d of this.groundDetails) {
      if (d.x < -60 || d.x > W + 40) continue;
      const bx = d.x, by = GROUND_Y;
      if (d.type === 'tree') {
        g.moveTo(bx, by).lineTo(bx, by - d.h * 0.4)
         .stroke({ width: 2, color: 0x10200a });
        for (let i = 0; i < 3; i++) {
          const ty = by - d.h * 0.32 - i * d.h * 0.22;
          const tw = d.h * 0.44 - i * 4;
          const tc = i === 0 ? 0x0a180a : i === 1 ? 0x182e10 : 0x244a18;
          g.poly([bx - tw, ty, bx, ty - d.h * 0.28, bx + tw, ty])
           .fill(tc).stroke({ width: 0.8, color: 0x2a5020, alpha: 0.5 });
        }
      } else if (d.type === 'lamp') {
        g.moveTo(bx, by).lineTo(bx, by - d.h)
         .moveTo(bx, by - d.h).lineTo(bx + 10, by - d.h + 5)
         .stroke({ width: 1.5, color: 0x1a2a18 });
        const la = 0.6 + 0.3 * Math.sin(now * 0.0018 + bx * 0.13);
        g.circle(bx + 10, by - d.h + 5, 4).fill({ color: 0xffee88, alpha: la * 0.85 });
        g.circle(bx + 10, by - d.h + 5, 9).fill({ color: 0xffcc44, alpha: la * 0.12 });
        g.circle(bx + 10, by - d.h + 5, 18).fill({ color: 0xffcc44, alpha: la * 0.05 });
      } else {
        g.moveTo(bx, by).lineTo(bx, by - d.h)
         .stroke({ width: 1, color: 0x14221a });
        for (let t = 0.3; t < 1; t += 0.22) {
          const bar = d.h * 0.18 * (1 - t * 0.5);
          g.moveTo(bx - bar, by - d.h * t).lineTo(bx + bar, by - d.h * t)
           .stroke({ width: 1, color: 0x14221a });
        }
        if (blinkMs(700)) {
          g.circle(bx, by - d.h, 2.5).fill({ color: 0xff3300, alpha: 0.9 });
          g.circle(bx, by - d.h, 6).fill({ color: 0xff2200, alpha: 0.2 });
        }
      }
    }
  }

  drawFinishLine(finishLineX: number): void {
    if (finishLineX > W + 30 || finishLineX < -20) return;
    const x = Math.round(finishLineX);
    const g = this.detailGfx;
    const sqH = 18;
    for (let i = 0; i * sqH < GROUND_Y; i++) {
      g.rect(x - 6, i * sqH, 12, sqH).fill(i % 2 === 0 ? COL_HUD : 0x0a1008);
    }
    g.moveTo(x, 0).lineTo(x, GROUND_Y).stroke({ width: 2, color: COL_HUD, alpha: 0.8 });
    g.moveTo(x, 0).lineTo(x, GROUND_Y).stroke({ width: 8, color: COL_HUD, alpha: 0.08 });
  }

  get bgScroll(): number { return this.bgScrollX; }
}
