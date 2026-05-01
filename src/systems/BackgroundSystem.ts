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
interface DayBird { x: number; y: number; phase: number; speed: number; }
interface PowerPole { x: number; h: number; }

// Star colours: mostly white/silver, rare warm yellow
const STAR_COLORS = [0xffffff, 0xffffff, 0xe8eeff, 0xfff8e0, 0xddeeff];

export class BackgroundSystem {
  readonly container: PIXI.Container;
  private readonly skyGfx:      PIXI.Graphics;
  private readonly starGfx:     PIXI.Graphics;
  private readonly mountainGfx: PIXI.Graphics;
  private readonly hillGfx:     PIXI.Graphics;
  private readonly cloudGfx:    PIXI.Graphics;
  private readonly bgCityGfx:   PIXI.Graphics;
  private readonly groundGfx:   PIXI.Graphics;
  private readonly shadowGfx:   PIXI.Graphics;
  private readonly detailGfx:   PIXI.Graphics;
  private readonly foreGfx:     PIXI.Graphics;

  private stars:         Star[]         = [];
  private clouds:        Cloud[]        = [];
  private bgCity:        BgBuilding[]   = [];
  private groundDetails: GroundDetail[] = [];
  private dayBirds:      DayBird[]      = [];
  private powerPoles:    PowerPole[]    = [];
  private bgScrollX = 0;

  constructor() {
    this.container   = new PIXI.Container();
    this.skyGfx      = new PIXI.Graphics();
    this.starGfx     = new PIXI.Graphics();
    this.mountainGfx = new PIXI.Graphics();
    this.hillGfx     = new PIXI.Graphics();
    this.cloudGfx    = new PIXI.Graphics();
    this.bgCityGfx   = new PIXI.Graphics();
    this.groundGfx   = new PIXI.Graphics();
    this.shadowGfx   = new PIXI.Graphics();
    this.detailGfx   = new PIXI.Graphics();
    this.foreGfx     = new PIXI.Graphics();
    this.container.addChild(
      this.skyGfx, this.starGfx, this.mountainGfx,
      this.hillGfx, this.cloudGfx, this.bgCityGfx,
      this.groundGfx, this.shadowGfx, this.detailGfx,
      this.foreGfx,
    );
  }

  init(): void {
    this.bgScrollX = 0;
    this._initStars();
    this._initClouds();
    this._initBgCity();
    this._seedGroundDetails();
    this._initDayBirds();
    this._initPowerPoles();
    this._drawStaticSky();
    this._drawMoon();
  }

  private _initDayBirds(): void {
    this.dayBirds = [];
    for (let i = 0; i < 24; i++) {
      this.dayBirds.push({
        x: Math.random() * W,
        y: 35 + Math.random() * 210,
        phase: Math.random() * Math.PI * 2,
        speed: 0.15 + Math.random() * 0.50,
      });
    }
  }

  private _initPowerPoles(): void {
    this.powerPoles = [];
    for (let x = 80; x < W * 4; x += 90 + (Math.random() * 60 | 0)) {
      this.powerPoles.push({ x, h: 55 + (Math.random() * 22 | 0) });
    }
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
    // Night clouds — subtle
    for (let i = 0; i < 8; i++) {
      this.clouds.push({
        x: Math.random() * W, y: 20 + Math.random() * 120,
        w: 90 + Math.random() * 160, h: 22 + Math.random() * 35,
        alpha: 0.022 + Math.random() * 0.035,
        speed: 0.18 + Math.random() * 0.15,
      });
    }
    // Daytime clouds — fewer but massive, volumetric cumulus
    for (let i = 0; i < 6; i++) {
      this.clouds.push({
        x: -200 + Math.random() * (W + 600), y: 28 + Math.random() * 110,
        w: 320 + Math.random() * 300, h: 120 + Math.random() * 130,
        alpha: 0.92,
        speed: 0.07 + Math.random() * 0.12,
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
    if (r < 0.58) return { x, type: 'tree',    h: 48 + Math.random() * 40 | 0 };
    if (r < 0.78) return { x, type: 'lamp',    h: 26 + Math.random() * 8  | 0 };
    return              { x, type: 'antenna', h: 32 + Math.random() * 22 | 0 };
  }

  // ── Update ────────────────────────────────────────────────────────────────────

  update(spd: number): void {
    this.bgScrollX += spd;
    for (let i = 0; i < this.clouds.length; i++) {
      const cl = this.clouds[i];
      cl.x -= spd * cl.speed;
      if (cl.x + cl.w / 2 < -10) {
        cl.x = W + cl.w / 2;
        if (i < 8) {
          // Night cloud — small, vary alpha
          cl.y = 18 + Math.random() * 120;
          cl.alpha = 0.022 + Math.random() * 0.035;
        } else {
          // Daytime cloud — large, keep alpha fixed
          cl.y = 28 + Math.random() * 110;
        }
      }
    }
    for (const b of this.dayBirds) {
      b.x -= b.speed + spd * 0.06;
      b.phase += 0.04;
      if (b.x < -30) {
        b.x = W + 20 + Math.random() * 80;
        b.y = 55 + Math.random() * 160;
      }
    }
    for (const d of this.groundDetails) d.x -= spd;
    this.groundDetails = this.groundDetails.filter(d => d.x > -30);
    const last = this.groundDetails[this.groundDetails.length - 1];
    if (!last || last.x < W + 80) {
      const nx = (last ? last.x : W) + 28 + Math.random() * 55 | 0;
      this.groundDetails.push(this._mkDetail(nx));
    }

    // Power poles scroll at full speed
    for (const p of this.powerPoles) p.x -= spd;
    this.powerPoles = this.powerPoles.filter(p => p.x > -30);
    const lastPole = this.powerPoles[this.powerPoles.length - 1];
    if (!lastPole || lastPole.x < W + 80) {
      const nx = (lastPole?.x ?? W) + 90 + (Math.random() * 60 | 0);
      this.powerPoles.push({ x: nx, h: 55 + (Math.random() * 22 | 0) });
    }
  }

  // ── Draw ──────────────────────────────────────────────────────────────────────

  draw(showGround: boolean, showSea = false, daytime = false, heliX = -1, heliY = -1): void {
    if (daytime) {
      this._drawDaySky();
      this._drawSun();
      this._drawDayMountains();
      this._drawRollingHills();
      this._drawDayClouds();
      this._drawDayBirds();
      if (showGround) {
        this._drawDayGround();
        this._drawGroundDetails(true);
        this._drawHeliShadow(heliX, heliY);
      }
      this._drawPowerLines(true);
    } else {
      this.hillGfx.clear();
      this.shadowGfx.clear();
      this.foreGfx.clear();
      this._drawStars();
      this._drawMountains();
      this._drawClouds();
      this._drawBgCity();
      if (showGround) { this._drawGround(); this._drawGroundDetails(false); }
      if (showSea)    this._drawSea();
    }
  }

  private _drawDaySky(): void {
    const g = this.skyGfx;
    g.clear();

    // Rich saturated daytime blue sky — deep navy zenith to pale horizon
    const sky = new PIXI.FillGradient({
      type: 'linear',
      start: { x: 0, y: 0 },
      end:   { x: 0, y: GROUND_Y },
      textureSpace: 'global',
    });
    sky.addColorStop(0.00, 0x091428);
    sky.addColorStop(0.10, 0x122240);
    sky.addColorStop(0.22, 0x1b4280);
    sky.addColorStop(0.38, 0x2c72b8);
    sky.addColorStop(0.55, 0x4494cc);
    sky.addColorStop(0.70, 0x68b0d8);
    sky.addColorStop(0.84, 0x90c8e0);
    sky.addColorStop(1.00, 0xb8d8e8);
    g.rect(0, 0, W, GROUND_Y).fill(sky);

    // Very faint warm haze just at the ground horizon
    g.rect(0, GROUND_Y - 18, W, 18).fill({ color: 0xd0e8c0, alpha: 0.22 });
  }

  private _drawSun(): void {
    const g = this.starGfx;
    g.clear();
    const now = Date.now();
    const sx = 660, sy = 118;

    // Wide screen-space atmospheric haze around sun
    g.circle(sx, sy, 220).fill({ color: 0xfff4c0, alpha: 0.018 });
    g.circle(sx, sy, 170).fill({ color: 0xffeea0, alpha: 0.032 });

    // Volumetric god rays — wider and longer
    for (let i = 0; i < 16; i++) {
      const a    = (i / 16) * Math.PI * 2 + now * 0.000028;
      const rayL = 280 + 100 * Math.sin(now * 0.0007 + i * 0.78);
      const hw   = 0.046 + 0.012 * Math.sin(now * 0.0011 + i * 2.1);
      const x1 = sx + Math.cos(a - hw) * 38, y1 = sy + Math.sin(a - hw) * 38;
      const x2 = sx + Math.cos(a + hw) * 38, y2 = sy + Math.sin(a + hw) * 38;
      const x3 = sx + Math.cos(a + hw) * rayL, y3 = sy + Math.sin(a + hw) * rayL;
      const x4 = sx + Math.cos(a - hw) * rayL, y4 = sy + Math.sin(a - hw) * rayL;
      const base  = 0.048 + 0.022 * Math.sin(now * 0.0013 + i * 1.3);
      const angle_factor = 0.50 + 0.50 * Math.sin(a + now * 0.00005);
      const alpha = base * angle_factor;
      g.poly([x1, y1, x2, y2, x3, y3, x4, y4]).fill({ color: 0xfff0a0, alpha });
    }

    // Golden horizontal lens flare across sky
    g.rect(0, sy - 1, W, 2).fill({ color: 0xffe880, alpha: 0.04 });
    g.rect(sx - 220, sy - 0.8, 440, 1.6).fill({ color: 0xffffff, alpha: 0.05 });

    // Atmospheric aureole layers
    g.circle(sx, sy, 140).fill({ color: 0xfff8e0, alpha: 0.032 });
    g.circle(sx, sy, 108).fill({ color: 0xffef98, alpha: 0.065 });
    g.circle(sx, sy,  80).fill({ color: 0xffe860, alpha: 0.110 });
    g.circle(sx, sy,  58).fill({ color: 0xfff0a0, alpha: 0.220 });
    g.circle(sx, sy,  42).fill({ color: 0xfffacc, alpha: 0.500 });
    // Sun disc
    g.circle(sx, sy, 30).fill({ color: 0xfffde8, alpha: 0.94 });
    g.circle(sx, sy, 22).fill({ color: 0xffffff, alpha: 0.90 });
    // Bright inner core
    g.circle(sx, sy, 12).fill({ color: 0xffffff, alpha: 0.98 });
  }

  private _drawDayMountains(): void {
    const g = this.mountainGfx;
    g.clear();
    // Farthest: tall, hazy blue-grey (atmospheric perspective)
    this._drawMountainRange(g, 0.03, GROUND_Y - 20, 148, 0.0019, 1.18, 0xa0aec0, 0.60);
    this._drawMountainRange(g, 0.03, GROUND_Y - 20, 148, 0.0019, 1.18, 0xbcc8d8, 0.22);
    // Second: rocky grey-brown (most visible range)
    this._drawMountainRange(g, 0.06, GROUND_Y - 16, 122, 0.0026, 1.72, 0x787060, 0.84);
    this._drawMountainRange(g, 0.06, GROUND_Y - 16, 122, 0.0026, 1.72, 0x908880, 0.28);
    // Third: darker brown-green foothills
    this._drawMountainRange(g, 0.12, GROUND_Y - 10, 88,  0.0044, 2.50, 0x485838, 0.90);
    this._drawMountainRange(g, 0.12, GROUND_Y - 10, 88,  0.0044, 2.50, 0x607050, 0.26);
    // Nearest ridge: dark green treeline blending into hills
    this._drawMountainRange(g, 0.22, GROUND_Y - 5,  48,  0.0070, 3.30, 0x203818, 0.96);
    this._drawMountainRange(g, 0.22, GROUND_Y - 5,  48,  0.0070, 3.30, 0x385828, 0.32);
    this._drawSnowCaps();
  }

  private _drawSnowCaps(): void {
    const g = this.mountainGfx;
    const scroll  = 0.03;
    const offset  = this.bgScrollX * scroll;
    const baseY   = GROUND_Y - 20;  // matches updated mountain baseY
    const amp     = 148;            // matches updated amplitude
    const freq    = 0.0019;
    const seed    = 1.18;
    const step    = 5;
    const snowLine = baseY - amp * 0.38; // threshold — adjusted for taller peaks

    let patchOpen = false;
    let patchPts: number[] = [];

    const flush = (endX: number) => {
      if (!patchOpen || patchPts.length < 6) { patchOpen = false; patchPts = []; return; }
      patchPts.push(endX, snowLine);
      g.poly([...patchPts]).fill({ color: 0xeef4ff, alpha: 0.90 });
      // Bright highlight on windward face (left side of each cap)
      const hl = patchPts.slice(0, Math.min(10, patchPts.length));
      if (hl.length >= 6) g.poly(hl).fill({ color: 0xffffff, alpha: 0.40 });
      patchOpen = false;
      patchPts  = [];
    };

    for (let sx = 0; sx <= W + step; sx += step) {
      const h  = this._mtnH(sx + offset, amp, freq, seed);
      const py = Math.max(14, baseY - amp * 0.55 - Math.max(0, h));
      if (py <= snowLine) {
        if (!patchOpen) { patchPts = [sx, snowLine]; patchOpen = true; }
        patchPts.push(sx, py);
      } else {
        if (patchOpen) flush(sx);
      }
    }
    flush(W + step);
  }

  private _drawRollingHills(): void {
    const g = this.hillGfx;
    g.clear();

    // Farthest hills — hazy sage, very slow scroll
    const off0 = this.bgScrollX * 0.10;
    const pts0: number[] = [0, GROUND_Y];
    for (let sx = 0; sx <= W; sx += 4) {
      const h = 48 * Math.sin((sx + off0) * 0.0055 + 0.2)
              + 20 * Math.sin((sx + off0) * 0.0130 + 1.8)
              +  9 * Math.sin((sx + off0) * 0.0030 + 3.7);
      pts0.push(sx, GROUND_Y - 62 - Math.max(0, h));
    }
    pts0.push(W, GROUND_Y);
    g.poly(pts0).fill({ color: 0x7abf48, alpha: 0.52 });

    // Mid hills — vibrant green, medium scroll
    const off1 = this.bgScrollX * 0.18;
    const pts1: number[] = [0, GROUND_Y];
    for (let sx = 0; sx <= W; sx += 4) {
      const h = 56 * Math.sin((sx + off1) * 0.0068 + 0.5)
              + 22 * Math.sin((sx + off1) * 0.0150 + 1.2)
              + 10 * Math.sin((sx + off1) * 0.0038 + 2.1);
      pts1.push(sx, GROUND_Y - 44 - Math.max(0, h));
    }
    pts1.push(W, GROUND_Y);
    g.poly(pts1).fill({ color: 0x62b82e, alpha: 0.80 });

    // Near hills — richest green, faster scroll
    const off2 = this.bgScrollX * 0.30;
    const pts2: number[] = [0, GROUND_Y];
    for (let sx = 0; sx <= W; sx += 4) {
      const h = 40 * Math.sin((sx + off2) * 0.0088 + 1.8)
              + 16 * Math.sin((sx + off2) * 0.0200 + 0.7)
              +  7 * Math.sin((sx + off2) * 0.0051 + 3.4);
      pts2.push(sx, GROUND_Y - 28 - Math.max(0, h));
    }
    pts2.push(W, GROUND_Y);
    g.poly(pts2).fill({ color: 0x4aaa1e, alpha: 0.94 });

    // Sunlit ridge crest highlight
    const ridgePts: number[] = [];
    for (let sx = 0; sx <= W; sx += 4) {
      const h = 40 * Math.sin((sx + off2) * 0.0088 + 1.8)
              + 16 * Math.sin((sx + off2) * 0.0200 + 0.7)
              +  7 * Math.sin((sx + off2) * 0.0051 + 3.4);
      ridgePts.push(sx, GROUND_Y - 28 - Math.max(0, h));
    }
    if (ridgePts.length >= 4) {
      g.moveTo(ridgePts[0], ridgePts[1]);
      for (let i = 2; i < ridgePts.length; i += 2) g.lineTo(ridgePts[i], ridgePts[i + 1]);
      g.stroke({ width: 2, color: 0x88e040, alpha: 0.60 });
    }
  }

  private _drawPowerLines(daytime: boolean): void {
    const g = this.foreGfx;
    g.clear();
    const poleCol = daytime ? 0x3a3020 : 0x1a1a1a;
    const wireCol = daytime ? 0x28221a : 0x111111;
    const poleAlpha = daytime ? 0.75 : 0.88;

    // Draw wires between adjacent poles (behind poles)
    for (let i = 0; i < this.powerPoles.length - 1; i++) {
      const p1 = this.powerPoles[i];
      const p2 = this.powerPoles[i + 1];
      if (p2.x < -20 || p1.x > W + 20) continue;
      // Three wire heights on cross-arm
      const wireFracs = [0.14, 0.28, 0.42];
      for (const wf of wireFracs) {
        const y1 = GROUND_Y - p1.h * (1 - wf);
        const y2 = GROUND_Y - p2.h * (1 - wf);
        const midX = (p1.x + p2.x) * 0.5;
        const sag  = (p2.x - p1.x) * 0.038;
        const midY = Math.max(y1, y2) + sag;
        g.moveTo(p1.x, y1)
         .quadraticCurveTo(midX, midY, p2.x, y2)
         .stroke({ width: 1, color: wireCol, alpha: daytime ? 0.50 : 0.72 });
      }
    }

    // Draw poles on top of wires
    for (const p of this.powerPoles) {
      if (p.x < -20 || p.x > W + 20) continue;
      const topY    = GROUND_Y - p.h;
      const armY    = topY + p.h * 0.14;
      const armHalf = 13;

      // Main pole
      g.moveTo(p.x, GROUND_Y).lineTo(p.x, topY)
       .stroke({ width: 3.5, color: poleCol, alpha: poleAlpha });
      // Cross-arm
      g.moveTo(p.x - armHalf, armY).lineTo(p.x + armHalf, armY)
       .stroke({ width: 2.5, color: poleCol, alpha: poleAlpha });
      // Insulators on arm ends + top
      const insCols = [{ x: p.x - armHalf, y: armY }, { x: p.x + armHalf, y: armY }, { x: p.x, y: topY }];
      for (const ins of insCols) {
        g.circle(ins.x, ins.y, 2.5).fill({ color: daytime ? 0x8a7a50 : 0x555555, alpha: 0.85 });
      }
    }

    // Foreground grass blades (daytime only)
    if (daytime) {
      const scrollOff = this.bgScrollX * 1.1;
      for (let i = 0; i < 55; i++) {
        const gx = ((scrollOff + i * (W / 55) + Math.sin(i * 7.3) * 12) % W + W) % W;
        const gh = 5 + Math.sin(i * 3.7 + scrollOff * 0.04) * 3;
        const lean = Math.cos(i * 2.1 + scrollOff * 0.03) * 2;
        g.moveTo(gx, GROUND_Y + 2)
         .lineTo(gx + lean, GROUND_Y + 2 - gh)
         .stroke({ width: 1.5, color: 0x68c830, alpha: 0.65 });
      }
    }
  }

  private _drawHeliShadow(hx: number, hy: number): void {
    const g = this.shadowGfx;
    g.clear();
    if (hx < 0 || hy >= GROUND_Y - 18) return;
    const height = GROUND_Y - hy;
    const t      = Math.min(1, height / 340);
    const rx     = 52 * (1 - t * 0.60);
    const ry     =  9 * (1 - t * 0.60);
    const alpha  = 0.45 * (1 - t * 0.78);
    // Sun is at x=660 (right side) so shadow projects slightly left
    const shadowX = hx - 6 - t * 18;
    // Soft layered ellipses
    g.ellipse(shadowX, GROUND_Y + 4, rx * 1.70, ry * 1.70).fill({ color: 0x000000, alpha: alpha * 0.12 });
    g.ellipse(shadowX, GROUND_Y + 3, rx * 1.35, ry * 1.35).fill({ color: 0x040808, alpha: alpha * 0.22 });
    g.ellipse(shadowX, GROUND_Y + 2, rx,        ry        ).fill({ color: 0x0a1408, alpha: alpha * 0.55 });
  }

  private _drawDayClouds(): void {
    const g = this.cloudGfx;
    g.clear();
    const dayClouds = this.clouds.slice(8);
    for (const cl of dayClouds) {
      const { x, y, w, h } = cl;

      // --- Deep shadow base (darkest underside) ---
      g.ellipse(x - w * 0.04, y + h * 0.32, w * 0.54, h * 0.30).fill({ color: 0x6080a0, alpha: 0.50 });
      g.ellipse(x + w * 0.22, y + h * 0.28, w * 0.44, h * 0.26).fill({ color: 0x6888a8, alpha: 0.42 });
      g.ellipse(x - w * 0.20, y + h * 0.22, w * 0.38, h * 0.24).fill({ color: 0x7090b0, alpha: 0.36 });

      // --- Mid body (grey-blue transition) ---
      g.ellipse(x - w * 0.22, y + h * 0.06, w * 0.46, h * 0.54).fill({ color: 0xbccce0, alpha: 0.88 });
      g.ellipse(x + w * 0.24, y + h * 0.03, w * 0.48, h * 0.56).fill({ color: 0xc0d0e2, alpha: 0.90 });
      g.ellipse(x + w * 0.02, y - h * 0.01, w * 0.52, h * 0.58).fill({ color: 0xc8d8e8, alpha: 0.86 });
      g.ellipse(x - w * 0.10, y + h * 0.14, w * 0.44, h * 0.50).fill({ color: 0xc4d4e4, alpha: 0.84 });

      // --- Upper body (lightening toward white) ---
      g.ellipse(x - w * 0.18, y - h * 0.22, w * 0.42, h * 0.52).fill({ color: 0xdce8f4, alpha: 0.92 });
      g.ellipse(x + w * 0.20, y - h * 0.24, w * 0.46, h * 0.54).fill({ color: 0xe0ecf8, alpha: 0.94 });
      g.ellipse(x + w * 0.04, y - h * 0.30, w * 0.48, h * 0.54).fill({ color: 0xe8f0fc, alpha: 0.92 });
      g.ellipse(x - w * 0.12, y - h * 0.18, w * 0.40, h * 0.48).fill({ color: 0xe4eef8, alpha: 0.90 });

      // --- Bright sunlit tops ---
      g.ellipse(x + w * 0.24, y - h * 0.42, w * 0.38, h * 0.46).fill({ color: 0xf4f8ff, alpha: 0.96 });
      g.ellipse(x - w * 0.16, y - h * 0.40, w * 0.34, h * 0.44).fill({ color: 0xf6faff, alpha: 0.94 });
      g.ellipse(x + w * 0.06, y - h * 0.48, w * 0.36, h * 0.46).fill({ color: 0xfafcff, alpha: 0.97 });

      // --- Pure white crown peaks ---
      g.ellipse(x + w * 0.16, y - h * 0.58, w * 0.24, h * 0.34).fill({ color: 0xffffff, alpha: 0.99 });
      g.ellipse(x - w * 0.08, y - h * 0.54, w * 0.22, h * 0.32).fill({ color: 0xfffcfa, alpha: 0.95 });
      g.ellipse(x + w * 0.34, y - h * 0.50, w * 0.20, h * 0.30).fill({ color: 0xffffff, alpha: 0.90 });
    }
  }

  private _drawDayBirds(): void {
    const g = this.bgCityGfx; // reuse bgCity layer (cleared in _drawBgCity; cleared here for daytime)
    g.clear();
    const now = Date.now();
    for (const b of this.dayBirds) {
      const wing = Math.sin(b.phase) * 4; // wing flap offset
      const bx = b.x, by = b.y;
      const scale = 0.7 + b.speed * 0.8; // far birds smaller
      // V-shape silhouette
      g.moveTo(bx,            by)
       .lineTo(bx - 8 * scale, by + wing)
       .moveTo(bx,            by)
       .lineTo(bx + 8 * scale, by + wing)
       .stroke({ width: 1.2, color: 0x1a2a40, alpha: 0.55 + 0.1 * Math.sin(now * 0.002 + b.phase) });
    }
  }

  private _drawDayGround(): void {
    const g = this.groundGfx;
    g.clear();
    // Lush meadow base
    g.rect(0, GROUND_Y, W, H - GROUND_Y).fill(0x2a8010);
    // Bright sunlit top band
    g.rect(0, GROUND_Y, W, 12).fill(0x50bc28);
    // Second band — mid tone
    g.rect(0, GROUND_Y + 12, W, 14).fill({ color: 0x3a9818, alpha: 0.80 });
    // Deeper shadow toward bottom
    g.rect(0, GROUND_Y + 26, W, H - GROUND_Y - 26).fill({ color: 0x1a5808, alpha: 0.40 });
    // Grass fringe — irregular tufts along horizon
    for (let sx = 0; sx < W; sx += 6) {
      const fh = 4 + 5 * Math.abs(Math.sin(sx * 0.13 + 1.1));
      const fc = (sx % 18 < 9) ? 0x60d030 : 0x4ab820;
      g.rect(sx, GROUND_Y - fh + 1, 4, fh).fill({ color: fc, alpha: 0.70 });
    }
    // Crisp horizon line
    g.moveTo(0, GROUND_Y).lineTo(W, GROUND_Y)
     .stroke({ width: 2, color: 0x70d840, alpha: 0.90 });
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

  private _drawGroundDetails(daytime = false): void {
    const g = this.detailGfx;
    g.clear();
    const now = Date.now();
    for (const d of this.groundDetails) {
      if (d.x < -60 || d.x > W + 40) continue;
      const bx = d.x, by = GROUND_Y;
      if (d.type === 'tree') {
        // Trunk
        g.moveTo(bx, by).lineTo(bx, by - d.h * 0.28)
         .stroke({ width: daytime ? 4 : 2, color: daytime ? 0x2a1808 : 0x10200a });
        // 5-tier pine silhouette (daytime) or 3-tier (night)
        const tiers = daytime ? 5 : 3;
        const dayC  = [0x142c0a, 0x1a3c0e, 0x204e12, 0x2a6018, 0x346e1e];
        const nightC = [0x0a180a, 0x182e10, 0x244a18];
        for (let i = 0; i < tiers; i++) {
          const ty = by - d.h * (daytime ? 0.20 : 0.28) - i * d.h * (daytime ? 0.15 : 0.22);
          const tw = d.h * (daytime ? 0.42 - i * 0.06 : 0.44 - i * 0.04);
          const tc = daytime ? dayC[i] : nightC[Math.min(i, 2)];
          g.poly([bx - tw, ty, bx, ty - d.h * (daytime ? 0.21 : 0.28), bx + tw, ty])
           .fill(tc);
          if (daytime) {
            // Sunlit right-face highlight
            g.poly([bx, ty - d.h * 0.21, bx + tw, ty, bx + tw * 0.6, ty - d.h * 0.08])
             .fill({ color: 0x2c5c14, alpha: 0.30 });
          }
        }
      } else if (d.type === 'lamp') {
        g.moveTo(bx, by).lineTo(bx, by - d.h)
         .moveTo(bx, by - d.h).lineTo(bx + 10, by - d.h + 5)
         .stroke({ width: 1.5, color: daytime ? 0x4a5840 : 0x1a2a18 });
        const la = daytime ? 0.0 : 0.6 + 0.3 * Math.sin(now * 0.0018 + bx * 0.13);
        if (!daytime) {
          g.circle(bx + 10, by - d.h + 5, 4).fill({ color: 0xffee88, alpha: la * 0.85 });
          g.circle(bx + 10, by - d.h + 5, 9).fill({ color: 0xffcc44, alpha: la * 0.12 });
        }
      } else {
        g.moveTo(bx, by).lineTo(bx, by - d.h)
         .stroke({ width: 1, color: daytime ? 0x566048 : 0x14221a });
        for (let t = 0.3; t < 1; t += 0.22) {
          const bar = d.h * 0.18 * (1 - t * 0.5);
          g.moveTo(bx - bar, by - d.h * t).lineTo(bx + bar, by - d.h * t)
           .stroke({ width: 1, color: daytime ? 0x566048 : 0x14221a });
        }
        if (!daytime && blinkMs(700)) {
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
