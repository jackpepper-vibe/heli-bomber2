import * as PIXI from 'pixi.js';
import { W, H, GROUND_Y, COL_GREEN, COL_MID_GREEN } from '../utils/constants';
import { blinkMs } from '../utils/math';

interface Star { x: number; y: number; r: number; phase: number; }
interface Cloud { x: number; y: number; w: number; h: number; alpha: number; }
interface BgBuilding { x: number; w: number; h: number; }
interface GroundDetail { x: number; type: 'tree' | 'lamp' | 'antenna'; h: number; }

export class BackgroundSystem {
  readonly container: PIXI.Container;
  private readonly bgGfx: PIXI.Graphics;
  private readonly groundGfx: PIXI.Graphics;
  private readonly detailGfx: PIXI.Graphics;

  private stars: Star[] = [];
  private clouds: Cloud[] = [];
  private bgCity: BgBuilding[] = [];
  private groundDetails: GroundDetail[] = [];
  private bgScrollX = 0;

  constructor() {
    this.container = new PIXI.Container();
    this.bgGfx = new PIXI.Graphics();
    this.groundGfx = new PIXI.Graphics();
    this.detailGfx = new PIXI.Graphics();
    this.container.addChild(this.bgGfx, this.groundGfx, this.detailGfx);
  }

  init(): void {
    this.bgScrollX = 0;
    this._initStars();
    this._initClouds();
    this._initBgCity();
    this._seedGroundDetails();
  }

  private _initStars(): void {
    this.stars = [];
    for (let i = 0; i < 90; i++) {
      this.stars.push({
        x: Math.random() * W,
        y: Math.random() * (GROUND_Y - 40),
        r: Math.random() < 0.12 ? 1.5 : 0.8,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  private _initClouds(): void {
    this.clouds = [];
    for (let i = 0; i < 7; i++) {
      this.clouds.push({
        x: Math.random() * W, y: 25 + Math.random() * 100,
        w: 70 + Math.random() * 120, h: 18 + Math.random() * 28,
        alpha: 0.04 + Math.random() * 0.05,
      });
    }
  }

  private _initBgCity(): void {
    this.bgCity = [];
    let x = 0;
    while (x < W * 4) {
      const h = 18 + Math.random() * 65, w = 14 + Math.random() * 45;
      this.bgCity.push({ x, w, h });
      x += w + 1 + Math.random() * 12;
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

  update(spd: number): void {
    this.bgScrollX += spd;
    for (const cl of this.clouds) {
      cl.x -= spd * 0.3;
      if (cl.x + cl.w / 2 < -10) { cl.x = W + cl.w / 2; cl.y = 25 + Math.random() * 100; }
    }
    for (const d of this.groundDetails) d.x -= spd;
    this.groundDetails = this.groundDetails.filter(d => d.x > -20);
    const last = this.groundDetails[this.groundDetails.length - 1];
    if (!last || last.x < W + 60) {
      const nx = (last ? last.x : W) + 28 + Math.random() * 55 | 0;
      this.groundDetails.push(this._mkDetail(nx));
    }
  }

  draw(showGround: boolean, showSea = false): void {
    this._drawBg();
    if (showGround) {
      this._drawGround();
      this._drawGroundDetails();
    }
    if (showSea) {
      this._drawSea();
    }
  }

  private _drawBg(): void {
    const g = this.bgGfx;
    g.clear();
    const now = Date.now();
    for (const st of this.stars) {
      const flicker = 0.6 + 0.4 * Math.sin(st.phase + now * 0.0009);
      g.circle(st.x, st.y, st.r).fill({ color: COL_GREEN, alpha: flicker * 0.55 });
    }
    for (const bg of this.bgCity) {
      const sx = ((bg.x - this.bgScrollX * 0.15) % (W * 3) + W * 3) % (W * 3) - 60;
      if (sx > W + 50) continue;
      g.rect(sx, GROUND_Y - bg.h, bg.w, bg.h).fill({ color: 0x001a00, alpha: 0.09 });
    }
    for (const cl of this.clouds) {
      g.ellipse(cl.x, cl.y, cl.w / 2, cl.h / 2).fill({ color: COL_GREEN, alpha: cl.alpha });
    }
  }

  private _drawGround(): void {
    const g = this.groundGfx;
    g.clear();
    g.rect(0, GROUND_Y, W, H - GROUND_Y).fill(COL_MID_GREEN);
    g.moveTo(0, GROUND_Y).lineTo(W, GROUND_Y).stroke({ width: 1, color: COL_GREEN });
  }

  private _drawSea(waterPhase = 0): void {
    const g = this.groundGfx;
    g.clear();
    // Water gradient approximated with two fills
    g.rect(0, GROUND_Y, W, H - GROUND_Y).fill(0x002a4a);
    g.rect(0, GROUND_Y + (H - GROUND_Y) * 0.5, W, (H - GROUND_Y) * 0.5).fill({ color: 0x001020, alpha: 0.5 });
    // Wave lines
    for (let row = 0; row < 4; row++) {
      const y = GROUND_Y + 6 + row * 8;
      const pts: number[] = [];
      for (let x = 0; x <= W; x += 12) {
        const dy = Math.sin((x + waterPhase * 40 + row * 25) * 0.05) * 1.6;
        pts.push(x, y + dy);
      }
      // Draw wave as polyline
      if (pts.length >= 4) {
        g.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
        g.stroke({ width: 1, color: 0x64c8ff, alpha: 0.22 });
      }
    }
    g.moveTo(0, GROUND_Y).lineTo(W, GROUND_Y).stroke({ width: 1, color: 0x2a6a9a });
  }

  drawSea(waterPhase: number): void {
    this._drawSea(waterPhase);
  }

  private _drawGroundDetails(): void {
    const g = this.detailGfx;
    g.clear();
    const now = Date.now();
    for (const d of this.groundDetails) {
      const bx = d.x, by = GROUND_Y;
      if (d.type === 'tree') {
        g.moveTo(bx, by).lineTo(bx, by - d.h * 0.35).stroke({ width: 2, color: 0x003a10 });
        for (let i = 0; i < 3; i++) {
          const ty = by - d.h * 0.3 - i * d.h * 0.2;
          const tw = d.h * 0.42 - i * 3;
          g.poly([bx - tw, ty, bx, ty - d.h * 0.26, bx + tw, ty]).fill(0x002200).stroke({ width: 1, color: 0x009a28 });
        }
      } else if (d.type === 'lamp') {
        g.moveTo(bx, by).lineTo(bx, by - d.h).moveTo(bx, by - d.h).lineTo(bx + 10, by - d.h + 4)
         .stroke({ width: 1.5, color: 0x005a18 });
        const la = 0.3 + 0.1 * Math.sin(now * 0.002 + bx);
        g.circle(bx + 10, by - d.h + 4, 3).fill({ color: COL_GREEN, alpha: la });
      } else {
        g.moveTo(bx, by).lineTo(bx, by - d.h).stroke({ width: 1, color: 0x004a10 });
        for (let i = 0.3; i < 1; i += 0.22) {
          const bary = by - d.h * i, barw = d.h * 0.16 * (1 - i * 0.5);
          g.moveTo(bx - barw, bary).lineTo(bx + barw, bary).stroke({ width: 1, color: 0x004a10 });
        }
        if (blinkMs(700)) {
          g.circle(bx, by - d.h, 2).fill({ color: 0xff4400, alpha: 0.8 });
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
      g.rect(x - 5, i * sqH, 10, sqH).fill(i % 2 === 0 ? COL_GREEN : 0x003a10);
    }
    g.moveTo(x, 0).lineTo(x, GROUND_Y).stroke({ width: 2, color: COL_GREEN });
  }

  get bgScroll(): number { return this.bgScrollX; }
}
