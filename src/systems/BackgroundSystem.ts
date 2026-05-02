import * as PIXI from 'pixi.js';
import {
  W, H, GROUND_Y,
  COL_SKY_DEEP, COL_SKY_MID, COL_SKY_HORIZON,
  COL_GROUND_DARK, COL_GROUND_EDGE,
  COL_HUD,
} from '../utils/constants';
import { blinkMs } from '../utils/math';

interface Star        { x: number; y: number; r: number; phase: number; layer: number; }
interface Cloud       { x: number; y: number; w: number; h: number; alpha: number; speed: number; }
interface BgBuilding  { x: number; w: number; h: number; wins: Array<{ rx: number; ry: number; lit: boolean }>; }
interface GroundDetail { x: number; type: 'tree' | 'lamp' | 'antenna'; h: number; }
interface DayBird     { x: number; y: number; phase: number; speed: number; }
interface PowerPole   { x: number; h: number; }

const STAR_COLORS = [0xffffff, 0xffffff, 0xe8eeff, 0xfff8e0, 0xddeeff];

// ─── Ground canvas geometry ──────────────────────────────────────────────────
const GRASS_FRINGE = 18;                       // px of canvas above GROUND_Y
const GROUND_CANVAS_H = (H - GROUND_Y) + GRASS_FRINGE;   // 60 px total
const GROUND_SPRITE_Y = GROUND_Y - GRASS_FRINGE;          // y=460 on screen

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

  // Canvas2D-baked high-fidelity sprites
  private readonly daySkySprite:    PIXI.Sprite;
  private readonly dayGroundSprite: PIXI.Sprite;
  private skyBaked    = false;
  private groundBaked = false;

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

    this.daySkySprite    = new PIXI.Sprite();
    this.dayGroundSprite = new PIXI.Sprite();
    this.daySkySprite.visible    = false;
    this.dayGroundSprite.visible = false;
    this.dayGroundSprite.y = GROUND_SPRITE_Y;

    this.container.addChild(
      this.daySkySprite,
      this.skyGfx,
      this.starGfx,
      this.mountainGfx,
      this.hillGfx,
      this.cloudGfx,
      this.bgCityGfx,
      this.groundGfx,
      this.dayGroundSprite,
      this.shadowGfx,
      this.detailGfx,
      this.foreGfx,
    );
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

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

  // ── Seed helpers ─────────────────────────────────────────────────────────────

  private _initDayBirds(): void {
    this.dayBirds = [];
    for (let i = 0; i < 24; i++) {
      this.dayBirds.push({
        x: Math.random() * W, y: 35 + Math.random() * 210,
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

  private _initStars(): void {
    this.stars = [];
    for (let i = 0; i < 120; i++)
      this.stars.push({ x: Math.random() * W, y: Math.random() * (GROUND_Y - 60), r: 0.5,            phase: Math.random() * Math.PI * 2, layer: 0 });
    for (let i = 0; i < 55; i++)
      this.stars.push({ x: Math.random() * W, y: Math.random() * (GROUND_Y - 80), r: 0.8 + Math.random() * 0.5, phase: Math.random() * Math.PI * 2, layer: 1 });
    for (let i = 0; i < 18; i++)
      this.stars.push({ x: Math.random() * W, y: Math.random() * (GROUND_Y - 100), r: 1.4 + Math.random() * 0.8, phase: Math.random() * Math.PI * 2, layer: 2 });
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
      const h = 22 + Math.random() * 80, ww = 18 + Math.random() * 52;
      const wins: BgBuilding['wins'] = [];
      const rows = Math.floor(h / 10), cols = Math.floor(ww / 9);
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
          wins.push({ rx: c / cols, ry: r / rows, lit: Math.random() > 0.45 });
      this.bgCity.push({ x, w: ww, h, wins });
      x += ww + 4 + Math.random() * 18;
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
          cl.y = 18 + Math.random() * 120;
          cl.alpha = 0.022 + Math.random() * 0.035;
        } else {
          cl.y = 28 + Math.random() * 110;
        }
      }
    }
    for (const b of this.dayBirds) {
      b.x -= b.speed + spd * 0.06;
      b.phase += 0.04;
      if (b.x < -30) { b.x = W + 20 + Math.random() * 80; b.y = 55 + Math.random() * 160; }
    }
    for (const d of this.groundDetails) d.x -= spd;
    this.groundDetails = this.groundDetails.filter(d => d.x > -30);
    const last = this.groundDetails[this.groundDetails.length - 1];
    if (!last || last.x < W + 80) {
      const nx = (last ? last.x : W) + 28 + Math.random() * 55 | 0;
      this.groundDetails.push(this._mkDetail(nx));
    }
    for (const p of this.powerPoles) p.x -= spd;
    this.powerPoles = this.powerPoles.filter(p => p.x > -30);
    const lastPole = this.powerPoles[this.powerPoles.length - 1];
    if (!lastPole || lastPole.x < W + 80) {
      const nx = (lastPole?.x ?? W) + 90 + (Math.random() * 60 | 0);
      this.powerPoles.push({ x: nx, h: 55 + (Math.random() * 22 | 0) });
    }
  }

  // ── Top-level draw ────────────────────────────────────────────────────────────

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
      } else {
        this.dayGroundSprite.visible = false;
        this.groundGfx.clear();
      }
      this._drawPowerLines(true);
    } else {
      this.daySkySprite.visible    = false;
      this.dayGroundSprite.visible = false;
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

  // ══════════════════════════════════════════════════════════════════════════════
  // CANVAS2D BAKED TEXTURES — high-fidelity painted layers
  // ══════════════════════════════════════════════════════════════════════════════

  private _bakeDaySky(): void {
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = GROUND_Y;
    const ctx = canvas.getContext('2d')!;

    // 1 — Rich multi-stop base gradient (deep navy zenith → pale cerulean horizon)
    const base = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    base.addColorStop(0.00, '#091428');
    base.addColorStop(0.10, '#0e1e3a');
    base.addColorStop(0.20, '#162848');
    base.addColorStop(0.32, '#1e4878');
    base.addColorStop(0.46, '#2c6aaa');
    base.addColorStop(0.60, '#4088c4');
    base.addColorStop(0.74, '#60a4d4');
    base.addColorStop(0.86, '#84bce0');
    base.addColorStop(1.00, '#aad4ec');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, GROUND_Y);

    // 2 — Sun corona baked into sky (radial gradient — only possible in Canvas2D)
    const SX = 660, SY = 118;
    const corona = ctx.createRadialGradient(SX, SY, 18, SX, SY, 390);
    corona.addColorStop(0.00, 'rgba(255,244,170,0.32)');
    corona.addColorStop(0.14, 'rgba(255,228,130,0.20)');
    corona.addColorStop(0.30, 'rgba(255,205,80,0.11)');
    corona.addColorStop(0.52, 'rgba(255,180,55,0.05)');
    corona.addColorStop(1.00, 'rgba(255,150,30,0.00)');
    ctx.fillStyle = corona;
    ctx.fillRect(0, 0, W, GROUND_Y);

    // 3 — Atmospheric haze bands: slightly angled brush-stroke passes
    const hazeBands = [
      { y:  36, h: 24, c: 'rgba(38,88,180,0.062)' },
      { y:  72, h: 28, c: 'rgba(54,110,200,0.052)' },
      { y: 112, h: 26, c: 'rgba(74,140,218,0.046)' },
      { y: 152, h: 30, c: 'rgba(96,164,228,0.044)' },
      { y: 196, h: 32, c: 'rgba(122,186,236,0.042)' },
      { y: 244, h: 28, c: 'rgba(148,202,238,0.040)' },
      { y: 292, h: 26, c: 'rgba(168,212,240,0.044)' },
      { y: 342, h: 30, c: 'rgba(188,218,242,0.050)' },
      { y: 394, h: 26, c: 'rgba(206,226,244,0.058)' },
      { y: 442, h: 22, c: 'rgba(220,232,244,0.068)' },
    ];
    for (let i = 0; i < hazeBands.length; i++) {
      const b = hazeBands[i];
      const yOff = Math.sin(i * 0.83) * 3;
      const bg = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
      bg.addColorStop(0,   'rgba(0,0,0,0)');
      bg.addColorStop(0.5, b.c);
      bg.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = bg;
      // Slightly angled trapezoid for hand-painted brushstroke feel
      ctx.beginPath();
      ctx.moveTo(-12,  b.y + yOff);
      ctx.lineTo(W + 12, b.y - yOff);
      ctx.lineTo(W + 12, b.y + b.h - yOff);
      ctx.lineTo(-12,  b.y + b.h + yOff);
      ctx.closePath();
      ctx.fill();
    }

    // 4 — Warm horizon glow (golden hour tint along ground line)
    const horizGlow = ctx.createLinearGradient(0, GROUND_Y - 95, 0, GROUND_Y);
    horizGlow.addColorStop(0.0, 'rgba(215,200,120,0.00)');
    horizGlow.addColorStop(0.4, 'rgba(215,200,120,0.06)');
    horizGlow.addColorStop(0.75,'rgba(240,215,110,0.11)');
    horizGlow.addColorStop(1.0, 'rgba(255,222,90,0.18)');
    ctx.fillStyle = horizGlow;
    ctx.fillRect(0, GROUND_Y - 95, W, 95);

    // 5 — Left atmospheric deepening (edge darkening)
    const leftVign = ctx.createLinearGradient(0, 0, 180, 0);
    leftVign.addColorStop(0, 'rgba(8,16,38,0.07)');
    leftVign.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = leftVign;
    ctx.fillRect(0, 0, W, GROUND_Y);

    // 6 — Vertical atmospheric turbulence streaks (painted mood)
    for (let i = 0; i < 16; i++) {
      const sx = 40 + (i / 16) * (W - 80) + Math.sin(i * 2.1) * 28;
      const sw = 18 + Math.abs(Math.sin(i * 1.4)) * 22;
      const alpha = 0.008 + Math.sin(i * 1.73) * 0.004;
      const sg = ctx.createLinearGradient(sx, 15, sx + 6, GROUND_Y - 45);
      sg.addColorStop(0.0, `rgba(200,220,255,0)`);
      sg.addColorStop(0.3, `rgba(200,220,255,${(alpha + 0.004).toFixed(4)})`);
      sg.addColorStop(0.7, `rgba(200,220,255,${alpha.toFixed(4)})`);
      sg.addColorStop(1.0, `rgba(200,220,255,0)`);
      ctx.fillStyle = sg;
      ctx.fillRect(sx - sw * 0.5, 15, sw, GROUND_Y - 60);
    }

    // Update sprite
    const tex = PIXI.Texture.from(canvas as HTMLCanvasElement);
    this.daySkySprite.texture = tex;
    this.skyBaked = true;
  }

  private _bakeDayGround(): void {
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = GROUND_CANVAS_H;
    const ctx = canvas.getContext('2d')!;
    const GL = GRASS_FRINGE; // y=GL is the ground line within this canvas

    // 1 — Lush meadow gradient (from ground line downward)
    const base = ctx.createLinearGradient(0, GL, 0, GROUND_CANVAS_H);
    base.addColorStop(0.00, '#5ec82e');
    base.addColorStop(0.05, '#48b020');
    base.addColorStop(0.20, '#369010');
    base.addColorStop(0.45, '#287008');
    base.addColorStop(0.70, '#1c5004');
    base.addColorStop(1.00, '#103002');
    ctx.fillStyle = base;
    ctx.fillRect(0, GL, W, GROUND_CANVAS_H - GL);

    // 2 — Horizontal colour-variation field patches
    const patches: [number, number, string][] = [
      [  0, 100, 'rgba(88,198,28,0.11)'],   [80,  130, 'rgba(48,138,10,0.08)'],
      [195,  90, 'rgba(100,208,38,0.13)'],  [270, 110, 'rgba(44,128,8,0.09)'],
      [375, 145, 'rgba(78,188,24,0.10)'],   [502, 125, 'rgba(92,202,36,0.12)'],
      [618, 105, 'rgba(40,122,7,0.08)'],    [715, 135, 'rgba(76,182,20,0.11)'],
      [838,  80, 'rgba(58,158,16,0.09)'],
    ];
    for (const [px, pw, col] of patches) {
      const pg = ctx.createLinearGradient(px, 0, px + pw, 0);
      pg.addColorStop(0,   'rgba(0,0,0,0)');
      pg.addColorStop(0.5, col);
      pg.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = pg;
      ctx.fillRect(px - 16, GL, pw + 32, (GROUND_CANVAS_H - GL) * 0.40);
    }

    // 3 — Painted field rows: alternating light/dark green bands
    const numRows = 5;
    for (let r = 0; r < numRows; r++) {
      const ry = GL + r * ((GROUND_CANVAS_H - GL) / numRows);
      const rh = (GROUND_CANVAS_H - GL) / numRows;
      const rowG = ctx.createLinearGradient(0, ry, 0, ry + rh);
      const isLight = r % 2 === 0;
      rowG.addColorStop(0,   'rgba(0,0,0,0)');
      rowG.addColorStop(0.5, isLight ? 'rgba(72,192,18,0.055)' : 'rgba(18,76,4,0.055)');
      rowG.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = rowG;
      ctx.fillRect(0, ry, W, rh);
    }

    // 4 — Grass blade strokes (bezier curves, base at ground line)
    for (let i = 0; i < 380; i++) {
      const gx  = (i / 380) * W * 1.06 - W * 0.03 + Math.sin(i * 7.31) * 9;
      const gh  = 3 + Math.abs(Math.sin(i * 2.73)) * 11;
      const lean = Math.cos(i * 1.93) * 4.5;
      const gv  = 122 + Math.floor(Math.sin(i * 3.11) * 48);
      const ga  = (0.48 + Math.sin(i * 5.13) * 0.16).toFixed(3);
      ctx.strokeStyle = `rgba(46,${gv},14,${ga})`;
      ctx.lineWidth   = 0.85 + Math.abs(Math.sin(i * 5.09)) * 0.65;
      ctx.beginPath();
      ctx.moveTo(gx, GL);
      ctx.quadraticCurveTo(gx + lean * 0.45, GL - gh * 0.45, gx + lean, GL - gh);
      ctx.stroke();
    }

    // 5 — Wildflower specks scattered along the top
    const flowers: [number, number, string][] = [
      [ 38, 3, 'rgba(255,252,185,0.68)'],  [108, 2, 'rgba(255,218,55,0.62)'],
      [192, 4, 'rgba(255,196,196,0.58)'],  [264, 2, 'rgba(215,255,215,0.58)'],
      [352, 3, 'rgba(255,248,165,0.68)'],  [428, 2, 'rgba(255,222,75,0.62)'],
      [516, 4, 'rgba(255,202,208,0.58)'],  [602, 2, 'rgba(255,250,185,0.65)'],
      [674, 3, 'rgba(255,225,85,0.60)'],   [762, 2, 'rgba(215,255,208,0.55)'],
      [842, 3, 'rgba(255,245,172,0.65)'],  [900, 2, 'rgba(255,215,65,0.62)'],
    ];
    for (const [fx, fy, fc] of flowers) {
      ctx.fillStyle = fc;
      for (let p = 0; p < 4; p++) {
        const px = fx + p * 8 + Math.sin(p * 2.3) * 4;
        const py = GL - fy - Math.cos(p * 1.7) * 2;
        ctx.beginPath();
        ctx.arc(px, py, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 6 — Soft top-edge shadow (ground meets world)
    const topShadow = ctx.createLinearGradient(0, GL - 4, 0, GL + 6);
    topShadow.addColorStop(0, 'rgba(0,20,0,0)');
    topShadow.addColorStop(1, 'rgba(0,20,0,0.18)');
    ctx.fillStyle = topShadow;
    ctx.fillRect(0, GL - 4, W, 10);

    const tex = PIXI.Texture.from(canvas as HTMLCanvasElement);
    this.dayGroundSprite.texture = tex;
    this.groundBaked = true;
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // DAY SKY
  // ══════════════════════════════════════════════════════════════════════════════

  private _drawDaySky(): void {
    if (!this.skyBaked) this._bakeDaySky();
    this.daySkySprite.visible = true;
    this.skyGfx.clear();
  }

  // ── Sun + god rays (PIXI.Graphics, animated) ──────────────────────────────────

  private _drawSun(): void {
    const g = this.starGfx;
    g.clear();
    const now = Date.now();
    const sx = 660, sy = 118;

    g.circle(sx, sy, 220).fill({ color: 0xfff4c0, alpha: 0.018 });
    g.circle(sx, sy, 170).fill({ color: 0xffeea0, alpha: 0.032 });

    for (let i = 0; i < 16; i++) {
      const a   = (i / 16) * Math.PI * 2 + now * 0.000028;
      const len = 280 + 100 * Math.sin(now * 0.0007 + i * 0.78);
      const hw  = 0.046 + 0.012 * Math.sin(now * 0.0011 + i * 2.1);
      const x1 = sx + Math.cos(a - hw) * 38, y1 = sy + Math.sin(a - hw) * 38;
      const x2 = sx + Math.cos(a + hw) * 38, y2 = sy + Math.sin(a + hw) * 38;
      const x3 = sx + Math.cos(a + hw) * len, y3 = sy + Math.sin(a + hw) * len;
      const x4 = sx + Math.cos(a - hw) * len, y4 = sy + Math.sin(a - hw) * len;
      const base = 0.048 + 0.022 * Math.sin(now * 0.0013 + i * 1.3);
      const af   = 0.50 + 0.50 * Math.sin(a + now * 0.00005);
      g.poly([x1, y1, x2, y2, x3, y3, x4, y4]).fill({ color: 0xfff0a0, alpha: base * af });
    }

    g.rect(0, sy - 1, W, 2).fill({ color: 0xffe880, alpha: 0.04 });
    g.rect(sx - 220, sy - 0.8, 440, 1.6).fill({ color: 0xffffff, alpha: 0.05 });

    g.circle(sx, sy, 140).fill({ color: 0xfff8e0, alpha: 0.032 });
    g.circle(sx, sy, 108).fill({ color: 0xffef98, alpha: 0.065 });
    g.circle(sx, sy,  80).fill({ color: 0xffe860, alpha: 0.110 });
    g.circle(sx, sy,  58).fill({ color: 0xfff0a0, alpha: 0.220 });
    g.circle(sx, sy,  42).fill({ color: 0xfffacc, alpha: 0.500 });
    g.circle(sx, sy,  30).fill({ color: 0xfffde8, alpha: 0.94  });
    g.circle(sx, sy,  22).fill({ color: 0xffffff, alpha: 0.90  });
    g.circle(sx, sy,  12).fill({ color: 0xffffff, alpha: 0.98  });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // PAINTED MOUNTAINS — multi-pass with vertex noise, rock strata, snow detail
  // ══════════════════════════════════════════════════════════════════════════════

  // Deterministic vertex noise: consistent world-space turbulence, no frame jitter
  private _vtxNoise(wx: number, amp: number, seed = 0): number {
    const s = wx + seed * 11.7;
    return amp * (
      0.44 * Math.sin(s * 0.431) +
      0.28 * Math.sin(s * 1.073) +
      0.16 * Math.sin(s * 2.317) +
      0.12 * Math.sin(s * 5.131)
    );
  }

  // Multi-pass mountain polygon with optional y-shift and vertex noise
  private _drawPaintedMtnRange(
    g: PIXI.Graphics,
    scroll: number, baseY: number, amp: number, freq: number, mtnSeed: number,
    color: number, alpha: number,
    dyShift = 0, noiseAmp = 0, noiseSeed = 0,
  ): void {
    const offset = this.bgScrollX * scroll;
    const step   = 4;
    const pts: number[] = [0, baseY];
    for (let sx = 0; sx <= W + step; sx += step) {
      const h  = this._mtnH(sx + offset, amp, freq, mtnSeed);
      const ny = noiseAmp > 0 ? this._vtxNoise(sx + offset, noiseAmp, noiseSeed) : 0;
      pts.push(sx, Math.max(10, baseY - amp * 0.55 - Math.max(0, h) + dyShift + ny));
    }
    pts.push(W, baseY);
    g.poly(pts).fill({ color, alpha });
  }

  private _drawDayMountains(): void {
    const g = this.mountainGfx;
    g.clear();

    // ── Range 1: Farthest — hazy atmospheric blue-grey ─────────────────────────
    // 6 layered passes: deep shadow → main → highlights → haze
    this._drawPaintedMtnRange(g, 0.03, GROUND_Y-20, 148, 0.0019, 1.18,  0x606e80, 0.44, +4, 3.0, 7.3);  // shadow underbelly
    this._drawPaintedMtnRange(g, 0.03, GROUND_Y-20, 148, 0.0019, 1.18,  0x8898ac, 0.58,  0, 2.0, 3.1);  // main body
    this._drawPaintedMtnRange(g, 0.03, GROUND_Y-20, 148, 0.0019, 1.18,  0xa0b0c4, 0.30, -3, 2.5, 5.7);  // mid highlight
    this._drawPaintedMtnRange(g, 0.03, GROUND_Y-20, 148, 0.0019, 1.18,  0xb8c8d8, 0.16, -6, 3.2, 9.2);  // sunlit crest
    this._drawPaintedMtnRange(g, 0.03, GROUND_Y-20, 148, 0.0019, 1.18,  0xccd8e4, 0.08,-10, 4.0, 2.4);  // bright rim
    this._drawPaintedMtnRange(g, 0.03, GROUND_Y-20, 148, 0.0019, 1.18,  0xb8c8d8, 0.20,  0, 1.2, 4.8);  // atmospheric haze wash

    // ── Range 2: Rocky grey-brown ──────────────────────────────────────────────
    this._drawPaintedMtnRange(g, 0.06, GROUND_Y-16, 122, 0.0026, 1.72,  0x484038, 0.68, +3, 3.2, 6.1);  // deep shadow
    this._drawPaintedMtnRange(g, 0.06, GROUND_Y-16, 122, 0.0026, 1.72,  0x706858, 0.82,  0, 2.2, 2.7);  // main
    this._drawPaintedMtnRange(g, 0.06, GROUND_Y-16, 122, 0.0026, 1.72,  0x888068, 0.34, -3, 2.8, 8.4);  // highlight
    this._drawPaintedMtnRange(g, 0.06, GROUND_Y-16, 122, 0.0026, 1.72,  0xa09070, 0.18, -6, 3.5, 1.9);  // warm sunlit face
    this._drawPaintedMtnRange(g, 0.06, GROUND_Y-16, 122, 0.0026, 1.72,  0x504840, 0.12, +4, 4.5, 3.8);  // dark crevasse detail

    // ── Range 3: Dark brown-green foothills ────────────────────────────────────
    this._drawPaintedMtnRange(g, 0.12, GROUND_Y-10,  88, 0.0044, 2.50,  0x283018, 0.74, +2, 2.4, 7.7);  // shadow
    this._drawPaintedMtnRange(g, 0.12, GROUND_Y-10,  88, 0.0044, 2.50,  0x445830, 0.88,  0, 1.9, 3.4);  // main
    this._drawPaintedMtnRange(g, 0.12, GROUND_Y-10,  88, 0.0044, 2.50,  0x587040, 0.30, -3, 2.6, 6.2);  // highlight
    this._drawPaintedMtnRange(g, 0.12, GROUND_Y-10,  88, 0.0044, 2.50,  0x404830, 0.10, +3, 3.8, 2.1);  // dark detail

    // ── Range 4: Nearest dark green ridge ─────────────────────────────────────
    this._drawPaintedMtnRange(g, 0.22, GROUND_Y-5,   48, 0.0070, 3.30,  0x121e08, 0.84, +1, 1.8, 5.5);  // shadow
    this._drawPaintedMtnRange(g, 0.22, GROUND_Y-5,   48, 0.0070, 3.30,  0x1e3414, 0.94,  0, 1.3, 1.8);  // main
    this._drawPaintedMtnRange(g, 0.22, GROUND_Y-5,   48, 0.0070, 3.30,  0x304822, 0.26, -2, 2.0, 4.3);  // sunlit edge

    this._drawSnowCaps();
  }

  private _drawSnowCaps(): void {
    const g = this.mountainGfx;
    const scroll = 0.03, baseY = GROUND_Y - 20, amp = 148, freq = 0.0019, seed = 1.18;
    const offset   = this.bgScrollX * scroll;
    const step     = 4;
    const snowLine = baseY - amp * 0.40;

    let patchOpen = false;
    let patchPts: number[] = [];

    const flush = (endX: number) => {
      if (!patchOpen || patchPts.length < 6) { patchOpen = false; patchPts = []; return; }
      patchPts.push(endX, snowLine);

      // Main snow mass — cool white-blue
      g.poly([...patchPts]).fill({ color: 0xeef4ff, alpha: 0.92 });
      // Windward highlight — bright white
      const hl = patchPts.slice(0, Math.min(16, patchPts.length));
      if (hl.length >= 6) g.poly([...hl, hl[0], snowLine]).fill({ color: 0xffffff, alpha: 0.48 });
      // Leeward crevasse shadow — blue-grey
      const sh = patchPts.slice(Math.max(0, patchPts.length - 16));
      if (sh.length >= 6) { sh.push(endX, snowLine); g.poly(sh).fill({ color: 0xaabccc, alpha: 0.30 }); }
      // Second shifted snow layer for depth
      const shifted = patchPts.map((v, i) => (i % 2 === 1) ? v + this._vtxNoise(patchPts[i - 1] ?? 0, 2.8, 3.9) : v);
      g.poly([...shifted, endX, snowLine]).fill({ color: 0xf4f9ff, alpha: 0.22 });

      patchOpen = false; patchPts = [];
    };

    for (let sx = 0; sx <= W + step; sx += step) {
      const h  = this._mtnH(sx + offset, amp, freq, seed);
      const ny = this._vtxNoise(sx + offset, 2.2, 8.8);
      const py = Math.max(10, baseY - amp * 0.55 - Math.max(0, h) + ny);
      if (py <= snowLine) {
        if (!patchOpen) { patchPts = [sx, snowLine]; patchOpen = true; }
        patchPts.push(sx, py);
      } else {
        if (patchOpen) flush(sx);
      }
    }
    flush(W + step);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // PAINTED HILLS — organic edges, multi-pass colour variation, meadow patches
  // ══════════════════════════════════════════════════════════════════════════════

  private _hillProfile(scroll: number, baseH: number, a0: number, a1: number, a2: number,
                        f0: number, f1: number, f2: number, ph: number, noiseS: number): number[] {
    const off = this.bgScrollX * scroll;
    const pts: number[] = [0, GROUND_Y];
    for (let sx = 0; sx <= W + 4; sx += 4) {
      const h  = a0 * Math.sin((sx + off) * f0 + ph)
               + a1 * Math.sin((sx + off) * f1 + ph * 2.1)
               + a2 * Math.sin((sx + off) * f2 + ph * 0.7);
      const ny = this._vtxNoise(sx + off, 1.8, noiseS);
      pts.push(sx, GROUND_Y - baseH - Math.max(0, h) + ny);
    }
    pts.push(W, GROUND_Y);
    return pts;
  }

  // Shift all Y values in a flat [x,y,x,y…] polygon list by dy
  private _shiftY(pts: number[], dy: number): number[] {
    return pts.map((v, i) => (i % 2 === 1) ? Math.min(v + dy, GROUND_Y) : v);
  }

  private _drawRollingHills(): void {
    const g = this.hillGfx;
    g.clear();

    // ── Farthest hills ─────────────────────────────────────────────────────────
    const p0 = this._hillProfile(0.10, 62, 48, 20,  9, 0.0055, 0.0130, 0.0030, 0.2, 9.1);
    g.poly(this._shiftY(p0,  4)).fill({ color: 0x4a8820, alpha: 0.22 }); // shadow underlayer
    g.poly(p0)                  .fill({ color: 0x72b840, alpha: 0.50 }); // main
    g.poly(this._shiftY(p0, -3)).fill({ color: 0x90cc50, alpha: 0.14 }); // sunlit crest

    // ── Mid hills ──────────────────────────────────────────────────────────────
    const p1 = this._hillProfile(0.18, 44, 56, 22, 10, 0.0068, 0.0150, 0.0038, 0.5, 5.4);
    g.poly(this._shiftY(p1,  5)).fill({ color: 0x3a8015, alpha: 0.30 }); // shadow
    g.poly(p1)                  .fill({ color: 0x58a825, alpha: 0.76 }); // main
    g.poly(this._shiftY(p1, -4)).fill({ color: 0x78c838, alpha: 0.17 }); // highlight

    // ── Near hills ─────────────────────────────────────────────────────────────
    const p2 = this._hillProfile(0.30, 28, 40, 16,  7, 0.0088, 0.0200, 0.0051, 1.8, 2.8);
    g.poly(this._shiftY(p2,  6)).fill({ color: 0x286010, alpha: 0.35 }); // shadow
    g.poly(p2)                  .fill({ color: 0x469818, alpha: 0.94 }); // main
    g.poly(this._shiftY(p2, -5)).fill({ color: 0x68b830, alpha: 0.20 }); // highlight

    // Ridge crest glow
    const off2 = this.bgScrollX * 0.30;
    const ridgePts: number[] = [];
    for (let sx = 0; sx <= W; sx += 4) {
      const h  = 40 * Math.sin((sx + off2) * 0.0088 + 1.8) + 16 * Math.sin((sx + off2) * 0.0200 + 0.7) + 7 * Math.sin((sx + off2) * 0.0051 + 3.4);
      const ny = this._vtxNoise(sx + off2, 1.8, 2.8);
      ridgePts.push(sx, GROUND_Y - 28 - Math.max(0, h) + ny);
    }
    if (ridgePts.length >= 4) {
      g.moveTo(ridgePts[0], ridgePts[1]);
      for (let i = 2; i < ridgePts.length; i += 2) g.lineTo(ridgePts[i], ridgePts[i + 1]);
      g.stroke({ width: 2.5, color: 0x78d035, alpha: 0.55 });
    }

    // ── Scattered meadow light-patches (sunlit field variation) ────────────────
    const off1 = this.bgScrollX * 0.18;
    for (let i = 0; i < 20; i++) {
      const px  = ((i * 52 + off1 * 0.85) % (W + 180) + W * 1.1) % (W * 1.1) - 50;
      const hv  = 56 * Math.sin((px + off1) * 0.0068 + 0.5) + 22 * Math.sin((px + off1) * 0.0150 + 1.2);
      const py  = GROUND_Y - 44 - Math.max(0, hv) - 12 + this._vtxNoise(i * 43, 8, 2.1);
      const rw  = 16 + Math.abs(Math.sin(i * 1.71)) * 24;
      const rh  = 5  + Math.abs(Math.sin(i * 2.33)) * 8;
      g.ellipse(px, py, rw, rh).fill({
        color: (i % 3 !== 2) ? 0x7ed838 : 0x38880e,
        alpha: 0.16 + Math.abs(Math.sin(i * 1.27)) * 0.08,
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // PAINTED CLOUDS — 47 ellipses: deep shadows, body, crown, wisps, golden rim
  // ══════════════════════════════════════════════════════════════════════════════

  private _drawDayClouds(): void {
    const g = this.cloudGfx;
    g.clear();
    const dayClouds = this.clouds.slice(8);
    for (const cl of dayClouds) {
      const { x, y, w, h } = cl;

      // ── Dramatic storm-shadow underbase (new — wider, darker) ─────────────
      g.ellipse(x - w*0.02, y + h*0.45, w*0.64, h*0.36).fill({ color: 0x405868, alpha: 0.60 });
      g.ellipse(x + w*0.22, y + h*0.41, w*0.54, h*0.32).fill({ color: 0x4a6878, alpha: 0.50 });
      g.ellipse(x - w*0.24, y + h*0.31, w*0.46, h*0.28).fill({ color: 0x567082, alpha: 0.42 });

      // ── Original deep shadow layer ─────────────────────────────────────────
      g.ellipse(x - w*0.04, y + h*0.32, w*0.54, h*0.30).fill({ color: 0x6080a0, alpha: 0.50 });
      g.ellipse(x + w*0.22, y + h*0.28, w*0.44, h*0.26).fill({ color: 0x6888a8, alpha: 0.42 });
      g.ellipse(x - w*0.20, y + h*0.22, w*0.38, h*0.24).fill({ color: 0x7090b0, alpha: 0.36 });

      // ── Mid body ──────────────────────────────────────────────────────────
      g.ellipse(x - w*0.22, y + h*0.06, w*0.46, h*0.54).fill({ color: 0xbccce0, alpha: 0.88 });
      g.ellipse(x + w*0.24, y + h*0.03, w*0.48, h*0.56).fill({ color: 0xc0d0e2, alpha: 0.90 });
      g.ellipse(x + w*0.02, y - h*0.01, w*0.52, h*0.58).fill({ color: 0xc8d8e8, alpha: 0.86 });
      g.ellipse(x - w*0.10, y + h*0.14, w*0.44, h*0.50).fill({ color: 0xc4d4e4, alpha: 0.84 });

      // ── Interior detail blobs (painted depth) ─────────────────────────────
      g.ellipse(x + w*0.10, y - h*0.04, w*0.28, h*0.30).fill({ color: 0xcedde8, alpha: 0.48 });
      g.ellipse(x - w*0.16, y + h*0.01, w*0.24, h*0.26).fill({ color: 0xb8c8da, alpha: 0.36 });
      g.ellipse(x + w*0.28, y + h*0.10, w*0.22, h*0.24).fill({ color: 0xbacad8, alpha: 0.34 });

      // ── Upper body ────────────────────────────────────────────────────────
      g.ellipse(x - w*0.18, y - h*0.22, w*0.42, h*0.52).fill({ color: 0xdce8f4, alpha: 0.92 });
      g.ellipse(x + w*0.20, y - h*0.24, w*0.46, h*0.54).fill({ color: 0xe0ecf8, alpha: 0.94 });
      g.ellipse(x + w*0.04, y - h*0.30, w*0.48, h*0.54).fill({ color: 0xe8f0fc, alpha: 0.92 });
      g.ellipse(x - w*0.12, y - h*0.18, w*0.40, h*0.48).fill({ color: 0xe4eef8, alpha: 0.90 });

      // ── Bright sunlit tops ────────────────────────────────────────────────
      g.ellipse(x + w*0.24, y - h*0.42, w*0.38, h*0.46).fill({ color: 0xf4f8ff, alpha: 0.96 });
      g.ellipse(x - w*0.16, y - h*0.40, w*0.34, h*0.44).fill({ color: 0xf6faff, alpha: 0.94 });
      g.ellipse(x + w*0.06, y - h*0.48, w*0.36, h*0.46).fill({ color: 0xfafcff, alpha: 0.97 });

      // ── White crown peaks ────────────────────────────────────────────────
      g.ellipse(x + w*0.16, y - h*0.58, w*0.24, h*0.34).fill({ color: 0xffffff, alpha: 0.99 });
      g.ellipse(x - w*0.08, y - h*0.54, w*0.22, h*0.32).fill({ color: 0xfffcfa, alpha: 0.95 });
      g.ellipse(x + w*0.34, y - h*0.50, w*0.20, h*0.30).fill({ color: 0xffffff, alpha: 0.90 });

      // ── Golden warm rim light on upper-right edge ─────────────────────────
      for (let ri = 0; ri < 10; ri++) {
        const ang  = -Math.PI * 0.55 + (ri / 10) * Math.PI * 0.80;
        const rimX = x + Math.cos(ang) * w * 0.47;
        const rimY = y + Math.sin(ang) * h * 0.44;
        g.ellipse(rimX, rimY, w * 0.082, h * 0.062)
         .fill({ color: 0xfff4c0, alpha: 0.24 + 0.12 * Math.sin(ri * 0.97) });
      }

      // ── Wispy tendrils around perimeter ──────────────────────────────────
      for (let wi = 0; wi < 20; wi++) {
        const ang  = (wi / 20) * Math.PI * 2 + wi * 0.27;
        const dist = 0.39 + 0.17 * Math.sin(wi * 1.71);
        const wx = x + Math.cos(ang) * w * dist;
        const wy = y + Math.sin(ang) * h * dist * 0.62;
        const wr = w * (0.038 + 0.028 * Math.abs(Math.sin(wi * 2.13)));
        const wh = h * (0.016 + 0.011 * Math.abs(Math.sin(wi * 1.81)));
        g.ellipse(wx, wy, wr, wh).fill({
          color: wy < y - h * 0.08 ? 0xeef4ff : 0xa8bccc,
          alpha: 0.11 + 0.07 * Math.sin(wi * 1.09 + 0.5),
        });
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // DAY GROUND — Canvas2D baked sprite
  // ══════════════════════════════════════════════════════════════════════════════

  private _drawDayGround(): void {
    if (!this.groundBaked) this._bakeDayGround();
    this.dayGroundSprite.visible = true;
    this.groundGfx.clear();
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // PAINTED GROUND DETAILS — organic foliage trees
  // ══════════════════════════════════════════════════════════════════════════════

  private _drawPaintedTree(g: PIXI.Graphics, bx: number, by: number, h: number): void {
    const w  = h * 0.36;
    const tw = Math.max(2.5, h * 0.055);

    // Tapered trunk — wider at base, dark brown
    g.poly([
      bx - tw * 0.72, by,
      bx + tw * 0.72, by,
      bx + tw * 0.32, by - h * 0.32,
      bx - tw * 0.32, by - h * 0.32,
    ]).fill({ color: 0x261508 });

    // 12-ellipse foliage cluster — organic painted pine/broadleaf crown
    type FoliageCluster = [number, number, number, number, number, number];
    const clusters: FoliageCluster[] = [
      // [dx%, dy%, rx%, ry%, colorHex, alpha]
      [  0.00, -0.45, 0.54, 0.30, 0x0c2006, 0.93 ],  // core shadow base
      [ -0.28, -0.38, 0.40, 0.25, 0x112806, 0.86 ],  // left base lobe
      [  0.26, -0.40, 0.38, 0.24, 0x0e2404, 0.84 ],  // right base lobe
      [  0.00, -0.60, 0.46, 0.28, 0x193806, 0.90 ],  // mid crown
      [ -0.27, -0.55, 0.35, 0.22, 0x1d400a, 0.80 ],  // left mid
      [  0.25, -0.57, 0.34, 0.21, 0x1b3c08, 0.80 ],  // right mid
      [  0.00, -0.76, 0.35, 0.22, 0x224810, 0.87 ],  // upper
      [ -0.18, -0.72, 0.26, 0.17, 0x265016, 0.77 ],  // upper left
      [  0.20, -0.74, 0.25, 0.17, 0x244e12, 0.77 ],  // upper right
      [  0.00, -0.91, 0.19, 0.15, 0x2a5a18, 0.86 ],  // apex spire
      // Sunlit right-face highlights
      [  0.24, -0.62, 0.17, 0.12, 0x3c701e, 0.30 ],
      [  0.18, -0.78, 0.13, 0.10, 0x4a8026, 0.23 ],
    ];
    for (const [dx, dy, rx, ry, col, a] of clusters) {
      g.ellipse(bx + dx * w, by + dy * h, rx * w, ry * h).fill({ color: col, alpha: a });
    }
  }

  private _drawGroundDetails(daytime = false): void {
    const g = this.detailGfx;
    g.clear();
    const now = Date.now();
    for (const d of this.groundDetails) {
      if (d.x < -60 || d.x > W + 40) continue;
      const bx = d.x, by = GROUND_Y;

      if (d.type === 'tree') {
        if (daytime) {
          this._drawPaintedTree(g, bx, by, d.h);
        } else {
          // Night: compact 3-blob silhouette
          g.moveTo(bx, by).lineTo(bx, by - d.h * 0.28)
           .stroke({ width: 2, color: 0x10200a });
          const nbw = d.h * 0.44;
          g.ellipse(bx, by - d.h * 0.48, nbw * 0.50, d.h * 0.32).fill({ color: 0x091606, alpha: 0.93 });
          g.ellipse(bx, by - d.h * 0.65, nbw * 0.42, d.h * 0.26).fill({ color: 0x0b1a08, alpha: 0.88 });
          g.ellipse(bx, by - d.h * 0.82, nbw * 0.30, d.h * 0.20).fill({ color: 0x0e2008, alpha: 0.84 });
        }
      } else if (d.type === 'lamp') {
        g.moveTo(bx, by).lineTo(bx, by - d.h)
         .moveTo(bx, by - d.h).lineTo(bx + 10, by - d.h + 5)
         .stroke({ width: 1.5, color: daytime ? 0x4a5840 : 0x1a2a18 });
        if (!daytime) {
          const la = 0.6 + 0.3 * Math.sin(now * 0.0018 + bx * 0.13);
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
          g.circle(bx, by - d.h, 6  ).fill({ color: 0xff2200, alpha: 0.2 });
        }
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // POWER LINES + FOREGROUND GRASS
  // ══════════════════════════════════════════════════════════════════════════════

  private _drawPowerLines(daytime: boolean): void {
    const g = this.foreGfx;
    g.clear();
    const poleCol  = daytime ? 0x3a3020 : 0x1a1a1a;
    const wireCol  = daytime ? 0x28221a : 0x111111;
    const poleAlpha = daytime ? 0.75 : 0.88;

    for (let i = 0; i < this.powerPoles.length - 1; i++) {
      const p1 = this.powerPoles[i], p2 = this.powerPoles[i + 1];
      if (p2.x < -20 || p1.x > W + 20) continue;
      for (const wf of [0.14, 0.28, 0.42]) {
        const y1 = GROUND_Y - p1.h * (1 - wf), y2 = GROUND_Y - p2.h * (1 - wf);
        const midX = (p1.x + p2.x) * 0.5;
        const sag  = (p2.x - p1.x) * 0.038;
        g.moveTo(p1.x, y1).quadraticCurveTo(midX, Math.max(y1, y2) + sag, p2.x, y2)
         .stroke({ width: 1, color: wireCol, alpha: daytime ? 0.50 : 0.72 });
      }
    }
    for (const p of this.powerPoles) {
      if (p.x < -20 || p.x > W + 20) continue;
      const topY = GROUND_Y - p.h, armY = topY + p.h * 0.14, armHalf = 13;
      g.moveTo(p.x, GROUND_Y).lineTo(p.x, topY)
       .stroke({ width: 3.5, color: poleCol, alpha: poleAlpha });
      g.moveTo(p.x - armHalf, armY).lineTo(p.x + armHalf, armY)
       .stroke({ width: 2.5, color: poleCol, alpha: poleAlpha });
      for (const ins of [{ x: p.x - armHalf, y: armY }, { x: p.x + armHalf, y: armY }, { x: p.x, y: topY }])
        g.circle(ins.x, ins.y, 2.5).fill({ color: daytime ? 0x8a7a50 : 0x555555, alpha: 0.85 });
    }

    if (daytime) {
      const scrollOff = this.bgScrollX * 1.1;
      for (let i = 0; i < 55; i++) {
        const gx = ((scrollOff + i * (W / 55) + Math.sin(i * 7.3) * 12) % W + W) % W;
        const gh = 5 + Math.sin(i * 3.7 + scrollOff * 0.04) * 3;
        const lean = Math.cos(i * 2.1 + scrollOff * 0.03) * 2;
        g.moveTo(gx, GROUND_Y + 2).lineTo(gx + lean, GROUND_Y + 2 - gh)
         .stroke({ width: 1.5, color: 0x68c830, alpha: 0.65 });
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // HELICOPTER SHADOW
  // ══════════════════════════════════════════════════════════════════════════════

  private _drawHeliShadow(hx: number, hy: number): void {
    const g = this.shadowGfx;
    g.clear();
    if (hx < 0 || hy >= GROUND_Y - 18) return;
    const height  = GROUND_Y - hy;
    const t       = Math.min(1, height / 340);
    const rx      = 52 * (1 - t * 0.60);
    const ry      =  9 * (1 - t * 0.60);
    const alpha   = 0.45 * (1 - t * 0.78);
    const shadowX = hx - 6 - t * 18;
    g.ellipse(shadowX, GROUND_Y + 4, rx * 1.70, ry * 1.70).fill({ color: 0x000000, alpha: alpha * 0.12 });
    g.ellipse(shadowX, GROUND_Y + 3, rx * 1.35, ry * 1.35).fill({ color: 0x040808, alpha: alpha * 0.22 });
    g.ellipse(shadowX, GROUND_Y + 2, rx,        ry        ).fill({ color: 0x0a1408, alpha: alpha * 0.55 });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // DAY BIRDS
  // ══════════════════════════════════════════════════════════════════════════════

  private _drawDayBirds(): void {
    const g = this.bgCityGfx;
    g.clear();
    const now = Date.now();
    for (const b of this.dayBirds) {
      const wing = Math.sin(b.phase) * 4;
      const sc   = 0.7 + b.speed * 0.8;
      g.moveTo(b.x,              b.y).lineTo(b.x - 8 * sc, b.y + wing)
       .moveTo(b.x,              b.y).lineTo(b.x + 8 * sc, b.y + wing)
       .stroke({ width: 1.2, color: 0x1a2a40, alpha: 0.55 + 0.1 * Math.sin(now * 0.002 + b.phase) });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // NIGHT MODE — unchanged from original
  // ══════════════════════════════════════════════════════════════════════════════

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
    g.rect(0, GROUND_Y - 30, W, 30).fill({ color: 0x1a1a30, alpha: 0.30 });
    g.rect(0, GROUND_Y - 20, W, 20).fill({ color: 0x202040, alpha: 0.18 });
  }

  private _drawMoon(): void {
    const g = this.starGfx;
    const mx = 748, my = 72;
    g.circle(mx, my, 100).fill({ color: 0xaaccff, alpha: 0.008 });
    g.circle(mx, my,  78).fill({ color: 0xbbddff, alpha: 0.018 });
    g.circle(mx, my,  60).fill({ color: 0xccddff, alpha: 0.035 });
    g.circle(mx, my,  46).fill({ color: 0xddeeff, alpha: 0.07  });
    g.circle(mx, my,  36).fill({ color: 0xeef4ff, alpha: 0.13  });
    g.circle(mx, my,  28).fill({ color: 0xe2dcc8, alpha: 0.92  });
    g.circle(mx, my,  27).fill({ color: 0xeee8d8, alpha: 0.55  });
    g.circle(mx - 9,  my - 9,  11 ).fill({ color: 0xf8f4e8, alpha: 0.28 });
    g.circle(mx - 11, my - 11,  5 ).fill({ color: 0xfffcf0, alpha: 0.22 });
    g.circle(mx + 7,  my + 5,   6 ).fill({ color: 0xb8b0a0, alpha: 0.65 });
    g.circle(mx - 4,  my + 9,   4 ).fill({ color: 0xb8b0a0, alpha: 0.55 });
    g.circle(mx + 11, my - 8, 4.5 ).fill({ color: 0xb8b0a0, alpha: 0.60 });
    g.circle(mx - 9,  my - 2,   3 ).fill({ color: 0xb8b0a0, alpha: 0.50 });
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
      pts.push(sx, Math.max(14, baseY - amp * 0.55 - Math.max(0, this._mtnH(sx + offset, amp, freq, seed))));
    }
    pts.push(W, baseY);
    g.poly(pts).fill({ color, alpha });
  }

  private _drawMountains(): void {
    const g = this.mountainGfx;
    g.clear();
    this._drawMountainRange(g, 0.06, GROUND_Y - 20, 100, 0.0028, 1.42, 0x060c14, 0.9);
    this._drawMountainRange(g, 0.06, GROUND_Y - 20, 100, 0.0028, 1.42, 0x101e2c, 0.2);
    this._drawMountainRange(g, 0.14, GROUND_Y - 10,  70, 0.0048, 2.88, 0x090f18, 0.95);
    this._drawMountainRange(g, 0.14, GROUND_Y - 10,  70, 0.0048, 2.88, 0x1a2840, 0.14);
  }

  private _drawClouds(): void {
    const g = this.cloudGfx;
    g.clear();
    for (const cl of this.clouds) {
      g.ellipse(cl.x,              cl.y,                cl.w * 0.5,  cl.h * 0.5 ).fill({ color: 0x8090a8, alpha: cl.alpha });
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
      g.rect(sx, topY, bg.w, bg.h).fill({ color: 0x08090f, alpha: 0.88 });
      g.rect(sx, topY, bg.w, bg.h).stroke({ width: 0.5, color: 0x1a1e30, alpha: 0.5 });
      for (const win of bg.wins) {
        if (!win.lit) continue;
        const wx = sx + win.rx * bg.w + 1.5, wy = topY + win.ry * bg.h + 2;
        const flicker = Math.sin(now * 0.002 + bg.x * 0.07 + win.rx * 13) > 0.94;
        const wColor  = flicker ? 0x884400 : 0xffcc44;
        const wAlpha  = flicker ? 0.25 : (0.4 + 0.15 * Math.sin(now * 0.001 + win.ry * 7 + bg.x));
        g.rect(wx, wy, 4, 5).fill({ color: wColor, alpha: wAlpha });
        g.rect(wx - 1, wy - 1, 6, 7).fill({ color: 0xffaa00, alpha: wAlpha * 0.12 });
      }
      if (bg.h > 55 && blinkMs(900))
        g.circle(sx + bg.w * 0.5, topY - 3, 2).fill({ color: 0xff3300, alpha: 0.85 });
    }
    g.rect(0, GROUND_Y - 18, W, 18).fill({ color: 0x0d1020, alpha: 0.45 });
    g.rect(0, GROUND_Y - 8,  W, 8 ).fill({ color: 0x14182a, alpha: 0.28 });
  }

  private _drawGround(): void {
    const g = this.groundGfx;
    g.clear();
    g.rect(0, GROUND_Y, W, H - GROUND_Y).fill(COL_GROUND_DARK);
    g.rect(0, GROUND_Y, W, 6).fill({ color: 0x101a0a, alpha: 0.85 });
    for (let y = GROUND_Y + 14; y < H; y += 12)
      g.moveTo(0, y).lineTo(W, y).stroke({ width: 0.5, color: 0x0a1006, alpha: 0.6 });
    g.moveTo(0, GROUND_Y).lineTo(W, GROUND_Y).stroke({ width: 1.5, color: COL_GROUND_EDGE, alpha: 0.9 });
    g.moveTo(0, GROUND_Y - 1).lineTo(W, GROUND_Y - 1).stroke({ width: 3, color: COL_GROUND_EDGE, alpha: 0.18 });
    g.rect(0, GROUND_Y - 6, W, 6).fill({ color: COL_GROUND_EDGE, alpha: 0.04 });
  }

  private _drawSea(waterPhase = 0): void {
    const g = this.groundGfx;
    g.clear();
    const seaH = H - GROUND_Y;
    g.rect(0, GROUND_Y,              W, seaH * 0.5).fill(0x002244);
    g.rect(0, GROUND_Y + seaH * 0.5, W, seaH * 0.5).fill(0x001828);
    const now = Date.now() * 0.0004;
    for (let x = 0; x < W; x += 28) {
      const shimA = 0.05 + 0.04 * Math.sin(now + x * 0.04);
      g.rect(x, GROUND_Y, 14, seaH).fill({ color: 0x80ccff, alpha: shimA });
    }
    for (let row = 0; row < 5; row++) {
      const y = GROUND_Y + 5 + row * 9;
      const pts: number[] = [];
      for (let x = 0; x <= W; x += 10) {
        pts.push(x, y + Math.sin((x + waterPhase * 42 + row * 28) * 0.045) * 2.2);
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

  // ══════════════════════════════════════════════════════════════════════════════
  // FINISH LINE
  // ══════════════════════════════════════════════════════════════════════════════

  drawFinishLine(finishLineX: number): void {
    if (finishLineX > W + 30 || finishLineX < -20) return;
    const x = Math.round(finishLineX);
    const g = this.detailGfx;
    const sqH = 18;
    for (let i = 0; i * sqH < GROUND_Y; i++)
      g.rect(x - 6, i * sqH, 12, sqH).fill(i % 2 === 0 ? COL_HUD : 0x0a1008);
    g.moveTo(x, 0).lineTo(x, GROUND_Y).stroke({ width: 2, color: COL_HUD, alpha: 0.8 });
    g.moveTo(x, 0).lineTo(x, GROUND_Y).stroke({ width: 8, color: COL_HUD, alpha: 0.08 });
  }

  get bgScroll(): number { return this.bgScrollX; }
}
