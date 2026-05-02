import * as PIXI from 'pixi.js';
import {
  W, H, GROUND_Y,
  COL_SKY_DEEP, COL_SKY_MID, COL_SKY_HORIZON,
  COL_GROUND_DARK, COL_GROUND_EDGE,
  COL_HUD,
} from '../utils/constants';
import { blinkMs } from '../utils/math';

interface Star         { x: number; y: number; r: number; phase: number; layer: number; }
interface Cloud        { x: number; y: number; w: number; h: number; alpha: number; speed: number; }
interface BgBuilding   { x: number; w: number; h: number; wins: Array<{ rx: number; ry: number; lit: boolean }>; }
interface GroundDetail { x: number; type: 'tree' | 'lamp' | 'antenna'; h: number; }
interface DayBird      { x: number; y: number; phase: number; speed: number; }
interface PowerPole    { x: number; h: number; }

const STAR_COLORS = [0xffffff, 0xffffff, 0xe8eeff, 0xfff8e0, 0xddeeff];

const GRASS_FRINGE    = 18;
const GROUND_CANVAS_H = (H - GROUND_Y) + GRASS_FRINGE;
const GROUND_SPRITE_Y = GROUND_Y - GRASS_FRINGE;

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

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

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

  // ── Seed helpers ──────────────────────────────────────────────────────────────

  private _initDayBirds(): void {
    this.dayBirds = [];
    for (let i = 0; i < 24; i++) {
      this.dayBirds.push({
        x: Math.random() * W, y: 35 + Math.random() * 210,
        phase: Math.random() * Math.PI * 2, speed: 0.15 + Math.random() * 0.50,
      });
    }
  }

  private _initPowerPoles(): void {
    this.powerPoles = [];
    for (let x = 80; x < W * 4; x += 90 + (Math.random() * 60 | 0))
      this.powerPoles.push({ x, h: 55 + (Math.random() * 22 | 0) });
  }

  private _initStars(): void {
    this.stars = [];
    for (let i = 0; i < 120; i++)
      this.stars.push({ x: Math.random() * W, y: Math.random() * (GROUND_Y - 60),  r: 0.5,                      phase: Math.random() * Math.PI * 2, layer: 0 });
    for (let i = 0; i < 55; i++)
      this.stars.push({ x: Math.random() * W, y: Math.random() * (GROUND_Y - 80),  r: 0.8 + Math.random() * 0.5, phase: Math.random() * Math.PI * 2, layer: 1 });
    for (let i = 0; i < 18; i++)
      this.stars.push({ x: Math.random() * W, y: Math.random() * (GROUND_Y - 100), r: 1.4 + Math.random() * 0.8, phase: Math.random() * Math.PI * 2, layer: 2 });
  }

  private _initClouds(): void {
    this.clouds = [];
    for (let i = 0; i < 8; i++) {
      this.clouds.push({
        x: Math.random() * W, y: 20 + Math.random() * 120,
        w: 90 + Math.random() * 160, h: 22 + Math.random() * 35,
        alpha: 0.022 + Math.random() * 0.035, speed: 0.18 + Math.random() * 0.15,
      });
    }
    for (let i = 0; i < 6; i++) {
      this.clouds.push({
        x: -200 + Math.random() * (W + 600), y: 28 + Math.random() * 110,
        w: 320 + Math.random() * 300, h: 120 + Math.random() * 130,
        alpha: 0.92, speed: 0.07 + Math.random() * 0.12,
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
        if (i < 8) { cl.y = 18 + Math.random() * 120; cl.alpha = 0.022 + Math.random() * 0.035; }
        else        { cl.y = 28 + Math.random() * 110; }
      }
    }
    for (const b of this.dayBirds) {
      b.x -= b.speed + spd * 0.06; b.phase += 0.04;
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
      this._drawForestTreelines();
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
  // CANVAS2D BAKED TEXTURES — sky and ground painted once
  // ══════════════════════════════════════════════════════════════════════════════

  private _bakeDaySky(): void {
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = GROUND_Y;
    const ctx = canvas.getContext('2d')!;

    const base = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    base.addColorStop(0.00, '#091428'); base.addColorStop(0.10, '#0e1e3a');
    base.addColorStop(0.20, '#162848'); base.addColorStop(0.32, '#1e4878');
    base.addColorStop(0.46, '#2c6aaa'); base.addColorStop(0.60, '#4088c4');
    base.addColorStop(0.74, '#60a4d4'); base.addColorStop(0.86, '#84bce0');
    base.addColorStop(1.00, '#aad4ec');
    ctx.fillStyle = base; ctx.fillRect(0, 0, W, GROUND_Y);

    const SX = 660, SY = 118;
    const corona = ctx.createRadialGradient(SX, SY, 18, SX, SY, 390);
    corona.addColorStop(0.00, 'rgba(255,244,170,0.32)'); corona.addColorStop(0.14, 'rgba(255,228,130,0.20)');
    corona.addColorStop(0.30, 'rgba(255,205,80,0.11)');  corona.addColorStop(0.52, 'rgba(255,180,55,0.05)');
    corona.addColorStop(1.00, 'rgba(255,150,30,0.00)');
    ctx.fillStyle = corona; ctx.fillRect(0, 0, W, GROUND_Y);

    const hazeBands = [
      { y:  36, h: 24, c: 'rgba(38,88,180,0.062)'  }, { y:  72, h: 28, c: 'rgba(54,110,200,0.052)'  },
      { y: 112, h: 26, c: 'rgba(74,140,218,0.046)'  }, { y: 152, h: 30, c: 'rgba(96,164,228,0.044)'  },
      { y: 196, h: 32, c: 'rgba(122,186,236,0.042)' }, { y: 244, h: 28, c: 'rgba(148,202,238,0.040)' },
      { y: 292, h: 26, c: 'rgba(168,212,240,0.044)' }, { y: 342, h: 30, c: 'rgba(188,218,242,0.050)' },
      { y: 394, h: 26, c: 'rgba(206,226,244,0.058)' }, { y: 442, h: 22, c: 'rgba(220,232,244,0.068)' },
    ];
    for (let i = 0; i < hazeBands.length; i++) {
      const b = hazeBands[i], yOff = Math.sin(i * 0.83) * 3;
      const bg = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
      bg.addColorStop(0, 'rgba(0,0,0,0)'); bg.addColorStop(0.5, b.c); bg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.moveTo(-12, b.y + yOff); ctx.lineTo(W + 12, b.y - yOff);
      ctx.lineTo(W + 12, b.y + b.h - yOff); ctx.lineTo(-12, b.y + b.h + yOff);
      ctx.closePath(); ctx.fill();
    }

    const horizGlow = ctx.createLinearGradient(0, GROUND_Y - 95, 0, GROUND_Y);
    horizGlow.addColorStop(0.0, 'rgba(215,200,120,0.00)'); horizGlow.addColorStop(0.4, 'rgba(215,200,120,0.06)');
    horizGlow.addColorStop(0.75, 'rgba(240,215,110,0.11)'); horizGlow.addColorStop(1.0, 'rgba(255,222,90,0.18)');
    ctx.fillStyle = horizGlow; ctx.fillRect(0, GROUND_Y - 95, W, 95);

    const leftVign = ctx.createLinearGradient(0, 0, 180, 0);
    leftVign.addColorStop(0, 'rgba(8,16,38,0.07)'); leftVign.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = leftVign; ctx.fillRect(0, 0, W, GROUND_Y);

    for (let i = 0; i < 16; i++) {
      const sx = 40 + (i / 16) * (W - 80) + Math.sin(i * 2.1) * 28;
      const sw = 18 + Math.abs(Math.sin(i * 1.4)) * 22;
      const al = 0.008 + Math.sin(i * 1.73) * 0.004;
      const sg = ctx.createLinearGradient(sx, 15, sx + 6, GROUND_Y - 45);
      sg.addColorStop(0.0, 'rgba(200,220,255,0)');
      sg.addColorStop(0.3, `rgba(200,220,255,${(al + 0.004).toFixed(4)})`);
      sg.addColorStop(0.7, `rgba(200,220,255,${al.toFixed(4)})`);
      sg.addColorStop(1.0, 'rgba(200,220,255,0)');
      ctx.fillStyle = sg; ctx.fillRect(sx - sw * 0.5, 15, sw, GROUND_Y - 60);
    }

    this.daySkySprite.texture = PIXI.Texture.from(canvas as HTMLCanvasElement);
    this.skyBaked = true;
  }

  private _bakeDayGround(): void {
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = GROUND_CANVAS_H;
    const ctx = canvas.getContext('2d')!;
    const GL = GRASS_FRINGE;

    // Base lush meadow gradient
    const base = ctx.createLinearGradient(0, GL, 0, GROUND_CANVAS_H);
    base.addColorStop(0.00, '#6ed038'); base.addColorStop(0.04, '#54bc22');
    base.addColorStop(0.15, '#3e9810'); base.addColorStop(0.35, '#2e7808');
    base.addColorStop(0.60, '#1e5804'); base.addColorStop(1.00, '#0e2e02');
    ctx.fillStyle = base; ctx.fillRect(0, GL, W, GROUND_CANVAS_H - GL);

    // Soil patches visible through gaps
    const soilData: [number, number, number, number, string][] = [
      [ 48, GL+5, 26, 5, 'rgba(60,36,12,0.22)'],  [138, GL+4, 20, 4, 'rgba(52,30,8,0.18)'],
      [232, GL+6, 30, 5, 'rgba(66,40,14,0.20)'],  [318, GL+4, 18, 4, 'rgba(48,28,8,0.16)'],
      [412, GL+5, 24, 5, 'rgba(58,34,10,0.20)'],  [508, GL+4, 22, 4, 'rgba(54,32,8,0.18)'],
      [618, GL+6, 28, 5, 'rgba(64,38,12,0.22)'],  [724, GL+4, 22, 4, 'rgba(54,32,10,0.18)'],
      [828, GL+5, 20, 5, 'rgba(58,34,10,0.20)'],  [898, GL+4, 16, 4, 'rgba(48,28,8,0.16)'],
    ];
    for (const [px, py, pw, ph] of soilData) {
      const color = soilData[soilData.indexOf(soilData.find(d => d[0] === px)!)]![4];
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.ellipse(px + pw / 2, py + ph / 2, pw / 2, ph / 2, 0, 0, Math.PI * 2); ctx.fill();
    }

    // Horizontal field tonal variations
    const patches: [number, number, string][] = [
      [  0, 100, 'rgba(92,208,32,0.11)'],  [ 80, 130, 'rgba(48,138,10,0.08)'],
      [195,  90, 'rgba(108,218,38,0.13)'], [270, 110, 'rgba(44,128,8,0.09)'],
      [375, 145, 'rgba(84,198,28,0.10)'],  [502, 125, 'rgba(98,212,40,0.12)'],
      [618, 105, 'rgba(40,122,7,0.08)'],   [715, 135, 'rgba(82,194,26,0.11)'],
      [838,  80, 'rgba(62,162,18,0.09)'],
    ];
    for (const [px, pw, col] of patches) {
      const pg = ctx.createLinearGradient(px, 0, px + pw, 0);
      pg.addColorStop(0, 'rgba(0,0,0,0)'); pg.addColorStop(0.5, col); pg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = pg; ctx.fillRect(px - 16, GL, pw + 32, (GROUND_CANVAS_H - GL) * 0.42);
    }

    // Alternating light/dark field rows
    for (let r = 0; r < 6; r++) {
      const ry = GL + r * ((GROUND_CANVAS_H - GL) / 6);
      const rh = (GROUND_CANVAS_H - GL) / 6;
      const rowG = ctx.createLinearGradient(0, ry, 0, ry + rh);
      const isL = r % 2 === 0;
      rowG.addColorStop(0, 'rgba(0,0,0,0)');
      rowG.addColorStop(0.5, isL ? 'rgba(78,196,22,0.052)' : 'rgba(18,72,4,0.052)');
      rowG.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rowG; ctx.fillRect(0, ry, W, rh);
    }

    // Grass clumps (3–4 blades per clump at shared bases)
    for (let c = 0; c < 100; c++) {
      const cx = (c / 100) * W * 1.05 - W * 0.02 + Math.sin(c * 3.71) * 11;
      const nb = 3 + (Math.abs(Math.sin(cx * 0.7)) > 0.5 ? 1 : 0);
      for (let b = 0; b < nb; b++) {
        const bx   = cx + (b - nb * 0.5) * 4 + Math.sin(cx * 0.3 + b * 2.1) * 2;
        const gh   = 5 + Math.abs(Math.sin(cx * 0.41 + b * 1.7)) * 12;
        const lean = Math.cos(cx * 0.19 + b * 1.93) * 5;
        const gv   = 118 + Math.floor(Math.sin(cx * 0.31 + b * 2.3) * 52);
        const ga   = (0.52 + Math.sin(cx * 0.53 + b * 1.7) * 0.18).toFixed(3);
        ctx.strokeStyle = `rgba(42,${gv},12,${ga})`;
        ctx.lineWidth   = 0.8 + Math.abs(Math.sin(cx * 0.51 + b)) * 0.7;
        ctx.beginPath();
        ctx.moveTo(bx, GL);
        ctx.quadraticCurveTo(bx + lean * 0.42, GL - gh * 0.44, bx + lean, GL - gh);
        ctx.stroke();
      }
    }

    // Individual fine grass blades (500 total)
    for (let i = 0; i < 500; i++) {
      const gx   = (i / 500) * W * 1.08 - W * 0.04 + Math.sin(i * 7.31) * 9;
      const gh   = 3 + Math.abs(Math.sin(i * 2.73)) * 10;
      const lean = Math.cos(i * 1.93) * 4;
      const gv   = 120 + Math.floor(Math.sin(i * 3.11) * 46);
      const ga   = (0.45 + Math.sin(i * 5.13) * 0.15).toFixed(3);
      ctx.strokeStyle = `rgba(44,${gv},12,${ga})`;
      ctx.lineWidth   = 0.7 + Math.abs(Math.sin(i * 5.09)) * 0.55;
      ctx.beginPath();
      ctx.moveTo(gx, GL);
      ctx.quadraticCurveTo(gx + lean * 0.44, GL - gh * 0.44, gx + lean, GL - gh);
      ctx.stroke();
    }

    // Wildflower clusters (various hues)
    const flowers: [number, number, string][] = [
      [ 28, 3, 'rgba(255,252,185,0.72)'], [ 88, 2, 'rgba(255,218,55,0.65)'],
      [165, 4, 'rgba(255,196,196,0.62)'], [232, 2, 'rgba(215,255,215,0.60)'],
      [318, 3, 'rgba(255,248,165,0.70)'], [392, 2, 'rgba(255,222,75,0.65)'],
      [478, 4, 'rgba(255,202,208,0.62)'], [554, 3, 'rgba(255,245,172,0.68)'],
      [632, 2, 'rgba(255,225,85,0.62)'],  [708, 3, 'rgba(255,250,188,0.68)'],
      [784, 2, 'rgba(215,255,210,0.58)'], [856, 4, 'rgba(255,220,80,0.65)'],
      [904, 2, 'rgba(255,248,168,0.68)'],
    ];
    for (const [fx, fy, fc] of flowers) {
      ctx.fillStyle = fc;
      for (let p = 0; p < 5; p++) {
        const px = fx + p * 7 + Math.sin(p * 2.3 + fx * 0.1) * 5;
        const py = GL - fy - Math.cos(p * 1.7 + fx * 0.07) * 2.5;
        ctx.beginPath(); ctx.arc(px, py, 1.8, 0, Math.PI * 2); ctx.fill();
      }
      if (fx % 3 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.beginPath(); ctx.arc(fx + 14, GL - fy - 1, 1.2, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Small pebble/grit specks in the soil
    for (let s = 0; s < 32; s++) {
      const sx2 = 10 + (s / 32) * (W - 20) + Math.sin(s * 4.7) * 18;
      const sy2 = GL + 3 + Math.abs(Math.sin(s * 2.1)) * 4;
      const sr  = 0.8 + Math.abs(Math.sin(s * 3.3)) * 1.2;
      const cr  = 80 + (s % 3) * 12, cg = 62 + (s % 4) * 8, cb = 48 + (s % 5) * 6;
      ctx.fillStyle = `rgba(${cr},${cg},${cb},0.28)`;
      ctx.beginPath();
      ctx.ellipse(sx2, sy2, sr * 1.4, sr * 0.8, Math.sin(s * 1.2), 0, Math.PI * 2);
      ctx.fill();
    }

    // Top-edge soft shadow where world meets ground
    const topShadow = ctx.createLinearGradient(0, GL - 4, 0, GL + 8);
    topShadow.addColorStop(0, 'rgba(0,20,0,0)'); topShadow.addColorStop(1, 'rgba(0,20,0,0.20)');
    ctx.fillStyle = topShadow; ctx.fillRect(0, GL - 4, W, 12);

    this.dayGroundSprite.texture = PIXI.Texture.from(canvas as HTMLCanvasElement);
    this.groundBaked = true;
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // DAY SKY + SUN
  // ══════════════════════════════════════════════════════════════════════════════

  private _drawDaySky(): void {
    if (!this.skyBaked) this._bakeDaySky();
    this.daySkySprite.visible = true; this.skyGfx.clear();
  }

  private _drawSun(): void {
    const g = this.starGfx; g.clear();
    const now = Date.now(); const sx = 660, sy = 118;
    g.circle(sx, sy, 220).fill({ color: 0xfff4c0, alpha: 0.018 });
    g.circle(sx, sy, 170).fill({ color: 0xffeea0, alpha: 0.032 });
    for (let i = 0; i < 16; i++) {
      const a   = (i / 16) * Math.PI * 2 + now * 0.000028;
      const len = 280 + 100 * Math.sin(now * 0.0007 + i * 0.78);
      const hw  = 0.046 + 0.012 * Math.sin(now * 0.0011 + i * 2.1);
      const x1  = sx + Math.cos(a - hw) * 38, y1 = sy + Math.sin(a - hw) * 38;
      const x2  = sx + Math.cos(a + hw) * 38, y2 = sy + Math.sin(a + hw) * 38;
      const x3  = sx + Math.cos(a + hw) * len, y3 = sy + Math.sin(a + hw) * len;
      const x4  = sx + Math.cos(a - hw) * len, y4 = sy + Math.sin(a - hw) * len;
      const ba  = 0.048 + 0.022 * Math.sin(now * 0.0013 + i * 1.3);
      const af  = 0.50  + 0.50  * Math.sin(a + now * 0.00005);
      g.poly([x1, y1, x2, y2, x3, y3, x4, y4]).fill({ color: 0xfff0a0, alpha: ba * af });
    }
    g.rect(0, sy - 1, W, 2).fill({ color: 0xffe880, alpha: 0.04 });
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
  // MOUNTAINS — multi-pass vertex noise + geological rock strata + detailed snow
  // ══════════════════════════════════════════════════════════════════════════════

  private _vtxNoise(wx: number, amp: number, seed = 0): number {
    const s = wx + seed * 11.7;
    return amp * (0.44 * Math.sin(s * 0.431) + 0.28 * Math.sin(s * 1.073)
                + 0.16 * Math.sin(s * 2.317) + 0.12 * Math.sin(s * 5.131));
  }

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

  // Geological strata lines + rock texture patches on Range 2
  private _drawRockStrata(g: PIXI.Graphics): void {
    const scroll = 0.06, offset = this.bgScrollX * scroll;
    const baseY = GROUND_Y - 16, amp = 122, freq = 0.0026, seed = 1.72;

    // Strata lines: thin angled geological bands across the rock face
    for (let s = 0; s < 9; s++) {
      const tiltRate = 0.0022 + Math.sin(s * 1.73) * 0.0014;
      const col      = s % 3 === 0 ? 0x221a10 : s % 3 === 1 ? 0x2c2214 : 0x1c1508;
      const alph     = 0.14 + Math.sin(s * 1.43) * 0.05;

      let prevX = -1, prevY = -1;
      for (let sx = 0; sx <= W + 4; sx += 4) {
        const peakY = Math.max(10, baseY - amp * 0.55
          - Math.max(0, this._mtnH(sx + offset, amp, freq, seed))
          + this._vtxNoise(sx + offset, 2.2, s + 1.0));
        const elevF   = 0.07 + s * 0.10;
        const strataY = peakY + (baseY - peakY) * elevF + sx * tiltRate;
        if (strataY < peakY + 2 || strataY > baseY - 3) { prevX = -1; continue; }
        if (prevX >= 0) {
          g.moveTo(prevX, prevY).lineTo(sx, strataY)
           .stroke({ width: 1.0 + Math.sin(s * 0.7 + sx * 0.01) * 0.35, color: col, alpha: alph });
        }
        prevX = sx; prevY = strataY;
      }
    }

    // Weathered rock patches (mineral deposits / erosion blotches)
    for (let r = 0; r < 22; r++) {
      const wx  = r * 43 + Math.sin(r * 3.7) * 17;
      const sx  = ((wx - offset) % (22 * 43) + 22 * 43) % (22 * 43) - 22;
      if (sx < -22 || sx > W + 22) continue;
      const peakY = Math.max(10, baseY - amp * 0.55
        - Math.max(0, this._mtnH(sx + offset, amp, freq, seed)));
      const ry = peakY + (baseY - peakY) * (0.18 + Math.abs(Math.sin(r * 1.71)) * 0.58);
      if (ry < 14 || ry > baseY - 4) continue;
      g.ellipse(sx, ry,
        9  + Math.abs(Math.sin(r * 2.3)) * 13,
        3  + Math.abs(Math.sin(r * 3.1)) * 4)
       .fill({ color: r % 3 === 0 ? 0x342a18 : r % 3 === 1 ? 0x281e0e : 0x3e3020,
               alpha: 0.14 + Math.abs(Math.sin(r * 1.27)) * 0.07 });
    }
  }

  private _drawDayMountains(): void {
    const g = this.mountainGfx; g.clear();

    // Range 1: Farthest — hazy atmospheric blue-grey
    this._drawPaintedMtnRange(g, 0.03, GROUND_Y-20, 148, 0.0019, 1.18,  0x606e80, 0.44, +4, 3.0, 7.3);
    this._drawPaintedMtnRange(g, 0.03, GROUND_Y-20, 148, 0.0019, 1.18,  0x8898ac, 0.58,  0, 2.0, 3.1);
    this._drawPaintedMtnRange(g, 0.03, GROUND_Y-20, 148, 0.0019, 1.18,  0xa0b0c4, 0.30, -3, 2.5, 5.7);
    this._drawPaintedMtnRange(g, 0.03, GROUND_Y-20, 148, 0.0019, 1.18,  0xb8c8d8, 0.16, -6, 3.2, 9.2);
    this._drawPaintedMtnRange(g, 0.03, GROUND_Y-20, 148, 0.0019, 1.18,  0xccd8e4, 0.08,-10, 4.0, 2.4);
    this._drawPaintedMtnRange(g, 0.03, GROUND_Y-20, 148, 0.0019, 1.18,  0xb8c8d8, 0.20,  0, 1.2, 4.8);

    // Range 2: Jagged rocky grey-brown with geological strata texture
    this._drawPaintedMtnRange(g, 0.06, GROUND_Y-16, 122, 0.0026, 1.72,  0x484038, 0.68, +3, 3.2, 6.1);
    this._drawPaintedMtnRange(g, 0.06, GROUND_Y-16, 122, 0.0026, 1.72,  0x706858, 0.82,  0, 2.2, 2.7);
    this._drawPaintedMtnRange(g, 0.06, GROUND_Y-16, 122, 0.0026, 1.72,  0x888068, 0.34, -3, 2.8, 8.4);
    this._drawPaintedMtnRange(g, 0.06, GROUND_Y-16, 122, 0.0026, 1.72,  0xa09070, 0.18, -6, 3.5, 1.9);
    this._drawPaintedMtnRange(g, 0.06, GROUND_Y-16, 122, 0.0026, 1.72,  0x504840, 0.12, +4, 4.5, 3.8);
    this._drawRockStrata(g);

    // Range 3: Dark brown-green foothills
    this._drawPaintedMtnRange(g, 0.12, GROUND_Y-10,  88, 0.0044, 2.50,  0x283018, 0.74, +2, 2.4, 7.7);
    this._drawPaintedMtnRange(g, 0.12, GROUND_Y-10,  88, 0.0044, 2.50,  0x445830, 0.88,  0, 1.9, 3.4);
    this._drawPaintedMtnRange(g, 0.12, GROUND_Y-10,  88, 0.0044, 2.50,  0x587040, 0.30, -3, 2.6, 6.2);
    this._drawPaintedMtnRange(g, 0.12, GROUND_Y-10,  88, 0.0044, 2.50,  0x404830, 0.10, +3, 3.8, 2.1);

    // Range 4: Nearest dark green ridge
    this._drawPaintedMtnRange(g, 0.22, GROUND_Y-5,   48, 0.0070, 3.30,  0x121e08, 0.84, +1, 1.8, 5.5);
    this._drawPaintedMtnRange(g, 0.22, GROUND_Y-5,   48, 0.0070, 3.30,  0x1e3414, 0.94,  0, 1.3, 1.8);
    this._drawPaintedMtnRange(g, 0.22, GROUND_Y-5,   48, 0.0070, 3.30,  0x304822, 0.26, -2, 2.0, 4.3);

    this._drawSnowCaps();
  }

  private _drawSnowCaps(): void {
    const g = this.mountainGfx;
    const scroll = 0.03, baseY = GROUND_Y - 20, amp = 148, freq = 0.0019, seed = 1.18;
    const offset   = this.bgScrollX * scroll;
    const step     = 4;
    const snowLine = baseY - amp * 0.40;

    let patchOpen = false; let patchPts: number[] = [];

    const flush = (endX: number) => {
      if (!patchOpen || patchPts.length < 6) { patchOpen = false; patchPts = []; return; }
      patchPts.push(endX, snowLine);

      // Main snow mass — cool white-blue
      g.poly([...patchPts]).fill({ color: 0xeef4ff, alpha: 0.92 });
      // Windward sunlit face — bright white
      const hl = patchPts.slice(0, Math.min(16, patchPts.length));
      if (hl.length >= 6) g.poly([...hl, hl[0], snowLine]).fill({ color: 0xffffff, alpha: 0.50 });
      // Leeward crevasse shadow — blue-grey
      const sh = patchPts.slice(Math.max(0, patchPts.length - 16));
      if (sh.length >= 6) { sh.push(endX, snowLine); g.poly(sh).fill({ color: 0xaabccc, alpha: 0.34 }); }
      // Blue shadow pools in snow hollows
      const shifted = patchPts.map((v, i) =>
        (i % 2 === 1) ? v + this._vtxNoise(patchPts[i - 1] ?? 0, 2.8, 3.9) : v);
      g.poly([...shifted, endX, snowLine]).fill({ color: 0xd0e8f8, alpha: 0.22 });
      // Wind-blown snow wisps streaming off the peaks
      for (let w = 0; w < patchPts.length - 2; w += 8) {
        const wx2 = patchPts[w], wy2 = patchPts[w + 1];
        if (wy2 > snowLine - 8) continue;
        g.moveTo(wx2, wy2).lineTo(wx2 - 18 - Math.abs(Math.sin(w * 0.7)) * 12, wy2 + 2)
         .stroke({ width: 0.9, color: 0xf0f8ff, alpha: 0.30 });
      }
      // Snow crevasse cracks
      for (let c = 0; c < patchPts.length - 4; c += 12) {
        const cx1 = patchPts[c], cy1 = patchPts[c + 1];
        const cx2 = patchPts[c + 2] ?? cx1, cy2 = patchPts[c + 3] ?? cy1;
        if (cy1 > snowLine - 4 || cy2 > snowLine - 4) continue;
        g.moveTo(cx1, cy1)
         .quadraticCurveTo((cx1 + cx2) * 0.5, (cy1 + cy2) * 0.5 + 3, cx2, cy2)
         .stroke({ width: 0.7, color: 0x8ab0cc, alpha: 0.20 });
      }

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
  // PINE TREE — layered needle tiers with bark texture
  //   variant 0 = near/large (5 tiers, full detail, vibrant green)
  //   variant 1 = mid       (4 tiers, moderate detail, deep green)
  //   variant 2 = far/small  (3 tiers, simplified silhouette, muted green)
  // ══════════════════════════════════════════════════════════════════════════════

  private _drawPineTree(g: PIXI.Graphics, bx: number, by: number, h: number, seed = 0, variant = 0): void {
    const trunkH = h * 0.28;
    const tw     = Math.max(2.2, h * 0.055);

    // Trunk: tapered column, dark bark
    g.poly([bx - tw,      by,
            bx + tw,      by,
            bx + tw*0.30, by - trunkH,
            bx - tw*0.30, by - trunkH]).fill({ color: 0x1e0e06 });
    // Sunlit right face of trunk
    g.poly([bx + tw*0.14, by,
            bx + tw,      by,
            bx + tw*0.30, by - trunkH]).fill({ color: 0x3c1c0c, alpha: 0.58 });
    // Bark grain scars (horizontal)
    for (let gb = 0; gb < 3; gb++) {
      const gy  = by - trunkH * (0.16 + gb * 0.30);
      const gbw = tw * (0.86 - gb * 0.18);
      const jg  = Math.sin(seed * 1.7 + gb * 2.3) * 1.5;
      g.moveTo(bx - gbw + jg, gy).lineTo(bx + gbw + jg * 0.4, gy - 1.0)
       .stroke({ width: 0.7, color: 0x0e0602, alpha: 0.36 });
    }

    const numTiers = variant === 0 ? 5 : variant === 1 ? 4 : 3;
    // Colour palette per variant
    const c0 = variant === 2 ? 0x0a1a08 : 0x071408;  // deep shadow interior
    const c1 = variant === 2 ? 0x1e4010 : 0x163408;  // mid needle body
    const c2 = variant === 2 ? 0x2c5a1a : 0x224e12;  // sunlit face
    const c3 = variant === 2 ? 0x3c6e24 : 0x306420;  // bright tip highlights

    for (let t = 0; t < numTiers; t++) {
      const tf    = t / (numTiers - 1);             // 0 = bottom tier, 1 = apex
      const tierCY = by - trunkH - (h - trunkH) * (0.06 + tf * 0.76);
      const tw2    = (h * 0.5) * (1 - tf * 0.72);  // half-width of this tier
      const th     = h * (0.17 - tf * 0.05);        // tier height
      const droop  = th * 0.52;                      // lower-needle downward droop

      if (variant === 2) {
        // Far trees: simplified two-shape silhouette per tier (performance)
        g.poly([bx,         tierCY - th * 0.82,
                bx - tw2,   tierCY + droop,
                bx + tw2,   tierCY + droop]).fill({ color: c0, alpha: 0.95 });
        g.ellipse(bx, tierCY - th*0.14, tw2*0.82, th*0.68).fill({ color: c1, alpha: 0.88 });
      } else {
        // Mid/near trees: full layered needle rendering

        // Dark shadow underside: filled triangle + drooping lobes
        g.poly([bx,         tierCY - th * 0.82,
                bx - tw2,   tierCY + droop,
                bx + tw2,   tierCY + droop]).fill({ color: c0, alpha: 0.96 });
        g.ellipse(bx - tw2*0.52, tierCY + droop*0.48, tw2*0.52, droop*0.38).fill({ color: c0, alpha: 0.82 });
        g.ellipse(bx + tw2*0.52, tierCY + droop*0.48, tw2*0.48, droop*0.36).fill({ color: c0, alpha: 0.80 });

        // Main needle body: overlapping ellipses creating cluster texture
        g.ellipse(bx,            tierCY - th*0.14, tw2*0.84, th*0.70).fill({ color: c1, alpha: 0.92 });
        g.ellipse(bx - tw2*0.34, tierCY - th*0.06, tw2*0.60, th*0.56).fill({ color: c1, alpha: 0.84 });
        g.ellipse(bx + tw2*0.34, tierCY - th*0.08, tw2*0.56, th*0.54).fill({ color: c1, alpha: 0.82 });

        // Sunlit upper-right needle face
        g.ellipse(bx + tw2*0.22, tierCY - th*0.40, tw2*0.50, th*0.40).fill({ color: c2, alpha: 0.46 });
        g.ellipse(bx + tw2*0.38, tierCY - th*0.18, tw2*0.32, th*0.28).fill({ color: c3, alpha: 0.28 });
        // Bright specular highlights on topmost tiers only
        if (t >= numTiers - 2) {
          g.ellipse(bx + tw2*0.15, tierCY - th*0.52, tw2*0.26, th*0.20).fill({ color: c3, alpha: 0.20 });
        }
      }

      // Tier apex spike (both variants)
      g.poly([bx,            tierCY - th * 0.92,
              bx - tw2*0.18, tierCY - th * 0.52,
              bx + tw2*0.18, tierCY - th * 0.52]).fill({ color: c1, alpha: 0.86 });
    }

    // Tree apex spire — narrow pointed tip
    const axY = by - trunkH - (h - trunkH) * 0.89;
    const axT = by - h * 0.97;
    g.poly([bx, axT, bx - h*0.038, axY, bx + h*0.038, axY]).fill({ color: c1, alpha: 0.90 });
    g.poly([bx, axT, bx + h*0.016, axY - (axY - axT)*0.4, bx + h*0.038, axY])
     .fill({ color: c3, alpha: 0.30 });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // FOREST TREELINES — 3 parallax layers, each a dense pine forest band
  //   Layering order in hillGfx:
  //     far base fill → far trees → mid base fill → mid trees → near base fill → near trees
  //   Each subsequent layer's base fill occludes the previous layer's trunks,
  //   creating natural depth without any extra effort.
  // ══════════════════════════════════════════════════════════════════════════════

  private _hillProfile(
    scroll: number, baseH: number,
    a0: number, a1: number, a2: number,
    f0: number, f1: number, f2: number,
    ph: number, noiseS: number,
  ): number[] {
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

  private _shiftY(pts: number[], dy: number): number[] {
    return pts.map((v, i) => (i % 2 === 1) ? Math.min(v + dy, GROUND_Y) : v);
  }

  private _drawForestTreelines(): void {
    const g = this.hillGfx;
    g.clear();

    // ── Far forest (parallax 0.09×) — small muted pines in dense band ────
    const fp0 = this._hillProfile(0.09, 50, 44, 19, 8, 0.0053, 0.0122, 0.0031, 0.18, 8.3);
    g.poly(fp0).fill({ color: 0x2e4c1c, alpha: 0.62 });
    g.poly(this._shiftY(fp0, -3)).fill({ color: 0x3e6224, alpha: 0.14 });

    const FAR_N = 90, FAR_S = 20, FAR_T = FAR_N * FAR_S;
    const off0  = this.bgScrollX * 0.09;
    for (let i = 0; i < FAR_N; i++) {
      const wx = i * FAR_S + Math.sin(i * 3.71) * 3;
      const sx = ((wx - off0) % FAR_T + FAR_T) % FAR_T - FAR_S;
      if (sx < -28 || sx > W + 28) continue;
      const hh = 34 + Math.abs(Math.sin(i * 2.31)) * 16;
      this._drawPineTree(g, sx, GROUND_Y, hh, i, 2);
    }

    // ── Mid forest (parallax 0.17×) — medium deep-green pines ────────────
    const fp1 = this._hillProfile(0.17, 38, 52, 21, 9, 0.0067, 0.0148, 0.0038, 0.52, 4.8);
    g.poly(fp1).fill({ color: 0x1e3c10, alpha: 0.76 });
    g.poly(this._shiftY(fp1, -4)).fill({ color: 0x2c5418, alpha: 0.17 });

    const MID_N = 55, MID_S = 32, MID_T = MID_N * MID_S;
    const off1  = this.bgScrollX * 0.17;
    for (let i = 0; i < MID_N; i++) {
      const wx = i * MID_S + Math.sin(i * 2.19) * 7;
      const sx = ((wx - off1) % MID_T + MID_T) % MID_T - MID_S;
      if (sx < -40 || sx > W + 40) continue;
      const hh = 60 + Math.abs(Math.sin(i * 1.91)) * 28;
      this._drawPineTree(g, sx, GROUND_Y, hh, i + 31, 1);
    }

    // ── Near forest (parallax 0.28×) — large rich-green pines ────────────
    const fp2 = this._hillProfile(0.28, 24, 40, 16, 7, 0.0087, 0.0197, 0.0050, 1.72, 2.2);
    g.poly(fp2).fill({ color: 0x152e08, alpha: 0.88 });
    g.poly(this._shiftY(fp2, -5)).fill({ color: 0x224410, alpha: 0.20 });

    const NEAR_N = 38, NEAR_S = 52, NEAR_T = NEAR_N * NEAR_S;
    const off2   = this.bgScrollX * 0.28;
    for (let i = 0; i < NEAR_N; i++) {
      const wx = i * NEAR_S + Math.sin(i * 1.83) * 11;
      const sx = ((wx - off2) % NEAR_T + NEAR_T) % NEAR_T - NEAR_S;
      if (sx < -58 || sx > W + 58) continue;
      const hh = 90 + Math.abs(Math.sin(i * 1.63)) * 46;
      this._drawPineTree(g, sx, GROUND_Y, hh, i + 67, 0);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // DAY CLOUDS — 47-ellipse painted
  // ══════════════════════════════════════════════════════════════════════════════

  private _drawDayClouds(): void {
    const g = this.cloudGfx; g.clear();
    const dayClouds = this.clouds.slice(8);
    for (const cl of dayClouds) {
      const { x, y, w, h } = cl;
      g.ellipse(x - w*0.02, y + h*0.45, w*0.64, h*0.36).fill({ color: 0x405868, alpha: 0.60 });
      g.ellipse(x + w*0.22, y + h*0.41, w*0.54, h*0.32).fill({ color: 0x4a6878, alpha: 0.50 });
      g.ellipse(x - w*0.24, y + h*0.31, w*0.46, h*0.28).fill({ color: 0x567082, alpha: 0.42 });
      g.ellipse(x - w*0.04, y + h*0.32, w*0.54, h*0.30).fill({ color: 0x6080a0, alpha: 0.50 });
      g.ellipse(x + w*0.22, y + h*0.28, w*0.44, h*0.26).fill({ color: 0x6888a8, alpha: 0.42 });
      g.ellipse(x - w*0.20, y + h*0.22, w*0.38, h*0.24).fill({ color: 0x7090b0, alpha: 0.36 });
      g.ellipse(x - w*0.22, y + h*0.06, w*0.46, h*0.54).fill({ color: 0xbccce0, alpha: 0.88 });
      g.ellipse(x + w*0.24, y + h*0.03, w*0.48, h*0.56).fill({ color: 0xc0d0e2, alpha: 0.90 });
      g.ellipse(x + w*0.02, y - h*0.01, w*0.52, h*0.58).fill({ color: 0xc8d8e8, alpha: 0.86 });
      g.ellipse(x - w*0.10, y + h*0.14, w*0.44, h*0.50).fill({ color: 0xc4d4e4, alpha: 0.84 });
      g.ellipse(x + w*0.10, y - h*0.04, w*0.28, h*0.30).fill({ color: 0xcedde8, alpha: 0.48 });
      g.ellipse(x - w*0.16, y + h*0.01, w*0.24, h*0.26).fill({ color: 0xb8c8da, alpha: 0.36 });
      g.ellipse(x + w*0.28, y + h*0.10, w*0.22, h*0.24).fill({ color: 0xbacad8, alpha: 0.34 });
      g.ellipse(x - w*0.18, y - h*0.22, w*0.42, h*0.52).fill({ color: 0xdce8f4, alpha: 0.92 });
      g.ellipse(x + w*0.20, y - h*0.24, w*0.46, h*0.54).fill({ color: 0xe0ecf8, alpha: 0.94 });
      g.ellipse(x + w*0.04, y - h*0.30, w*0.48, h*0.54).fill({ color: 0xe8f0fc, alpha: 0.92 });
      g.ellipse(x - w*0.12, y - h*0.18, w*0.40, h*0.48).fill({ color: 0xe4eef8, alpha: 0.90 });
      g.ellipse(x + w*0.24, y - h*0.42, w*0.38, h*0.46).fill({ color: 0xf4f8ff, alpha: 0.96 });
      g.ellipse(x - w*0.16, y - h*0.40, w*0.34, h*0.44).fill({ color: 0xf6faff, alpha: 0.94 });
      g.ellipse(x + w*0.06, y - h*0.48, w*0.36, h*0.46).fill({ color: 0xfafcff, alpha: 0.97 });
      g.ellipse(x + w*0.16, y - h*0.58, w*0.24, h*0.34).fill({ color: 0xffffff, alpha: 0.99 });
      g.ellipse(x - w*0.08, y - h*0.54, w*0.22, h*0.32).fill({ color: 0xfffcfa, alpha: 0.95 });
      g.ellipse(x + w*0.34, y - h*0.50, w*0.20, h*0.30).fill({ color: 0xffffff, alpha: 0.90 });
      for (let ri = 0; ri < 10; ri++) {
        const ang = -Math.PI * 0.55 + (ri / 10) * Math.PI * 0.80;
        g.ellipse(x + Math.cos(ang) * w * 0.47, y + Math.sin(ang) * h * 0.44, w * 0.082, h * 0.062)
         .fill({ color: 0xfff4c0, alpha: 0.24 + 0.12 * Math.sin(ri * 0.97) });
      }
      for (let wi = 0; wi < 20; wi++) {
        const ang  = (wi / 20) * Math.PI * 2 + wi * 0.27;
        const dist = 0.39 + 0.17 * Math.sin(wi * 1.71);
        const wx2  = x + Math.cos(ang) * w * dist;
        const wy2  = y + Math.sin(ang) * h * dist * 0.62;
        g.ellipse(wx2, wy2,
          w * (0.038 + 0.028 * Math.abs(Math.sin(wi * 2.13))),
          h * (0.016 + 0.011 * Math.abs(Math.sin(wi * 1.81))))
         .fill({ color: wy2 < y - h * 0.08 ? 0xeef4ff : 0xa8bccc,
                 alpha: 0.11 + 0.07 * Math.sin(wi * 1.09 + 0.5) });
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // DAY GROUND
  // ══════════════════════════════════════════════════════════════════════════════

  private _drawDayGround(): void {
    if (!this.groundBaked) this._bakeDayGround();
    this.dayGroundSprite.visible = true; this.groundGfx.clear();
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // GROUND DETAILS — pine trees, lamps, antennas
  // ══════════════════════════════════════════════════════════════════════════════

  private _drawGroundDetails(daytime = false): void {
    const g = this.detailGfx; g.clear();
    const now = Date.now();
    for (const d of this.groundDetails) {
      if (d.x < -60 || d.x > W + 40) continue;
      const bx = d.x, by = GROUND_Y;

      if (d.type === 'tree') {
        if (daytime) {
          this._drawPineTree(g, bx, by, d.h, d.h % 31, 0);
        } else {
          g.moveTo(bx, by).lineTo(bx, by - d.h * 0.28).stroke({ width: 2, color: 0x10200a });
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
        g.moveTo(bx, by).lineTo(bx, by - d.h).stroke({ width: 1, color: daytime ? 0x566048 : 0x14221a });
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
    const g = this.foreGfx; g.clear();
    const poleCol   = daytime ? 0x3a3020 : 0x1a1a1a;
    const wireCol   = daytime ? 0x28221a : 0x111111;
    const poleAlpha = daytime ? 0.75 : 0.88;

    for (let i = 0; i < this.powerPoles.length - 1; i++) {
      const p1 = this.powerPoles[i], p2 = this.powerPoles[i + 1];
      if (p2.x < -20 || p1.x > W + 20) continue;
      for (const wf of [0.14, 0.28, 0.42]) {
        const y1 = GROUND_Y - p1.h * (1 - wf), y2 = GROUND_Y - p2.h * (1 - wf);
        const midX = (p1.x + p2.x) * 0.5, sag = (p2.x - p1.x) * 0.038;
        g.moveTo(p1.x, y1).quadraticCurveTo(midX, Math.max(y1, y2) + sag, p2.x, y2)
         .stroke({ width: 1, color: wireCol, alpha: daytime ? 0.50 : 0.72 });
      }
    }
    for (const p of this.powerPoles) {
      if (p.x < -20 || p.x > W + 20) continue;
      const topY = GROUND_Y - p.h, armY = topY + p.h * 0.14, armHalf = 13;
      g.moveTo(p.x, GROUND_Y).lineTo(p.x, topY).stroke({ width: 3.5, color: poleCol, alpha: poleAlpha });
      g.moveTo(p.x - armHalf, armY).lineTo(p.x + armHalf, armY)
       .stroke({ width: 2.5, color: poleCol, alpha: poleAlpha });
      for (const ins of [{ x: p.x - armHalf, y: armY }, { x: p.x + armHalf, y: armY }, { x: p.x, y: topY }])
        g.circle(ins.x, ins.y, 2.5).fill({ color: daytime ? 0x8a7a50 : 0x555555, alpha: 0.85 });
    }

    if (daytime) {
      const scrollOff = this.bgScrollX * 1.1;
      for (let i = 0; i < 55; i++) {
        const gx   = ((scrollOff + i * (W / 55) + Math.sin(i * 7.3) * 12) % W + W) % W;
        const gh   = 5 + Math.sin(i * 3.7 + scrollOff * 0.04) * 3;
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
    const g = this.shadowGfx; g.clear();
    if (hx < 0 || hy >= GROUND_Y - 18) return;
    const height = GROUND_Y - hy, t = Math.min(1, height / 340);
    const rx = 52 * (1 - t * 0.60), ry = 9 * (1 - t * 0.60), alpha = 0.45 * (1 - t * 0.78);
    const shadowX = hx - 6 - t * 18;
    g.ellipse(shadowX, GROUND_Y + 4, rx * 1.70, ry * 1.70).fill({ color: 0x000000, alpha: alpha * 0.12 });
    g.ellipse(shadowX, GROUND_Y + 3, rx * 1.35, ry * 1.35).fill({ color: 0x040808, alpha: alpha * 0.22 });
    g.ellipse(shadowX, GROUND_Y + 2, rx, ry).fill({ color: 0x0a1408, alpha: alpha * 0.55 });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // DAY BIRDS
  // ══════════════════════════════════════════════════════════════════════════════

  private _drawDayBirds(): void {
    const g = this.bgCityGfx; g.clear();
    const now = Date.now();
    for (const b of this.dayBirds) {
      const wing = Math.sin(b.phase) * 4, sc = 0.7 + b.speed * 0.8;
      g.moveTo(b.x, b.y).lineTo(b.x - 8 * sc, b.y + wing)
       .moveTo(b.x, b.y).lineTo(b.x + 8 * sc, b.y + wing)
       .stroke({ width: 1.2, color: 0x1a2a40, alpha: 0.55 + 0.1 * Math.sin(now * 0.002 + b.phase) });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // NIGHT MODE — unchanged
  // ══════════════════════════════════════════════════════════════════════════════

  private _drawStaticSky(): void {
    const g = this.skyGfx; g.clear();
    const bands = [
      { y: 0,   h: 60,             color: COL_SKY_DEEP    },
      { y: 60,  h: 60,             color: 0x07101e        },
      { y: 120, h: 80,             color: COL_SKY_MID     },
      { y: 200, h: 80,             color: 0x101e32        },
      { y: 280, h: 80,             color: 0x131f33        },
      { y: 360, h: GROUND_Y - 360, color: COL_SKY_HORIZON },
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
    g.circle(mx - 9,  my - 9,  11  ).fill({ color: 0xf8f4e8, alpha: 0.28 });
    g.circle(mx - 11, my - 11,  5  ).fill({ color: 0xfffcf0, alpha: 0.22 });
    g.circle(mx + 7,  my + 5,   6  ).fill({ color: 0xb8b0a0, alpha: 0.65 });
    g.circle(mx - 4,  my + 9,   4  ).fill({ color: 0xb8b0a0, alpha: 0.55 });
    g.circle(mx + 11, my - 8,  4.5 ).fill({ color: 0xb8b0a0, alpha: 0.60 });
    g.circle(mx - 9,  my - 2,   3  ).fill({ color: 0xb8b0a0, alpha: 0.50 });
  }

  private _drawStars(): void {
    const g = this.starGfx; g.clear(); this._drawMoon();
    const now = Date.now(); const scrollSpeeds = [0, 0.015, 0.04];
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
    return amp * (0.40 * Math.sin(wx * freq         + seed      )
                + 0.28 * Math.sin(wx * freq * 2.30  + seed * 1.7)
                + 0.20 * Math.sin(wx * freq * 0.61  + seed * 0.5)
                + 0.12 * Math.sin(wx * freq * 5.10  + seed * 3.2));
  }

  private _drawMountainRange(
    g: PIXI.Graphics, scroll: number,
    baseY: number, amp: number, freq: number, seed: number,
    color: number, alpha: number,
  ): void {
    const offset = this.bgScrollX * scroll;
    const step   = 5;
    const pts: number[] = [0, baseY];
    for (let sx = 0; sx <= W + step; sx += step)
      pts.push(sx, Math.max(14, baseY - amp * 0.55 - Math.max(0, this._mtnH(sx + offset, amp, freq, seed))));
    pts.push(W, baseY);
    g.poly(pts).fill({ color, alpha });
  }

  private _drawMountains(): void {
    const g = this.mountainGfx; g.clear();
    this._drawMountainRange(g, 0.06, GROUND_Y - 20, 100, 0.0028, 1.42, 0x060c14, 0.9);
    this._drawMountainRange(g, 0.06, GROUND_Y - 20, 100, 0.0028, 1.42, 0x101e2c, 0.2);
    this._drawMountainRange(g, 0.14, GROUND_Y - 10,  70, 0.0048, 2.88, 0x090f18, 0.95);
    this._drawMountainRange(g, 0.14, GROUND_Y - 10,  70, 0.0048, 2.88, 0x1a2840, 0.14);
  }

  private _drawClouds(): void {
    const g = this.cloudGfx; g.clear();
    for (const cl of this.clouds) {
      g.ellipse(cl.x,              cl.y,                cl.w * 0.5,  cl.h * 0.5 ).fill({ color: 0x8090a8, alpha: cl.alpha });
      g.ellipse(cl.x + cl.w * 0.2, cl.y - cl.h * 0.15, cl.w * 0.38, cl.h * 0.45).fill({ color: 0x8090a8, alpha: cl.alpha * 0.75 });
      g.ellipse(cl.x - cl.w * 0.2, cl.y - cl.h * 0.1,  cl.w * 0.33, cl.h * 0.42).fill({ color: 0x8090a8, alpha: cl.alpha * 0.6  });
    }
  }

  private _drawBgCity(): void {
    const g = this.bgCityGfx; g.clear();
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
    g.rect(0, GROUND_Y - 8,  W,  8).fill({ color: 0x14182a, alpha: 0.28 });
  }

  private _drawGround(): void {
    const g = this.groundGfx; g.clear();
    g.rect(0, GROUND_Y, W, H - GROUND_Y).fill(COL_GROUND_DARK);
    g.rect(0, GROUND_Y, W, 6).fill({ color: 0x101a0a, alpha: 0.85 });
    for (let y = GROUND_Y + 14; y < H; y += 12)
      g.moveTo(0, y).lineTo(W, y).stroke({ width: 0.5, color: 0x0a1006, alpha: 0.6 });
    g.moveTo(0, GROUND_Y).lineTo(W, GROUND_Y).stroke({ width: 1.5, color: COL_GROUND_EDGE, alpha: 0.9 });
    g.moveTo(0, GROUND_Y - 1).lineTo(W, GROUND_Y - 1).stroke({ width: 3, color: COL_GROUND_EDGE, alpha: 0.18 });
    g.rect(0, GROUND_Y - 6, W, 6).fill({ color: COL_GROUND_EDGE, alpha: 0.04 });
  }

  private _drawSea(waterPhase = 0): void {
    const g = this.groundGfx; g.clear();
    const seaH = H - GROUND_Y;
    g.rect(0, GROUND_Y,              W, seaH * 0.5).fill(0x002244);
    g.rect(0, GROUND_Y + seaH * 0.5, W, seaH * 0.5).fill(0x001828);
    const now = Date.now() * 0.0004;
    for (let x = 0; x < W; x += 28) {
      const shimA = 0.05 + 0.04 * Math.sin(now + x * 0.04);
      g.rect(x, GROUND_Y, 14, seaH).fill({ color: 0x80ccff, alpha: shimA });
    }
    for (let row = 0; row < 5; row++) {
      const y    = GROUND_Y + 5 + row * 9;
      const pts: number[] = [];
      for (let x = 0; x <= W; x += 10)
        pts.push(x, y + Math.sin((x + waterPhase * 42 + row * 28) * 0.045) * 2.2);
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
