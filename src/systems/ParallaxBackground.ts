import * as PIXI from 'pixi.js';
import { H, GROUND_Y } from '../utils/constants';
import { sliceTexture } from '../utils/textureUtils';

// ── Source crop rectangles in backgrounds.png (1384 × 752) ───────────────────
//
//  Row 1 (y   0–290): Sky — sun, god rays, clouds
//  Row 2 (y 295–600): Mountains — snow-capped peaks with faint upper atmosphere
//  Row 3 (y 376–750): Hills/Forest — rolling hills, trees, power lines
//  Row 4 (y 700–752): Ground strip — collision floor
//
// All layers span the full source width (1384 px).

const SRC_W = 1384;

interface LayerCfg {
  sy:    number;  // source Y start
  sh:    number;  // source height (pixels)
  dispH: number;  // display height in game pixels
  dispY: number;  // display Y (top edge) in game pixels
  speed: number;  // fraction of cumulative scroll (0 = static)
  tiles: number;  // sprite copies for seamless horizontal tiling
}

// User-specified parallax speeds: sky=static, mountains=10%, hills=40%, ground=100%
const LAYERS: readonly LayerCfg[] = [
  // Sky — static, stretched to fill the full sky area
  { sy: 0,   sh: 290, dispH: GROUND_Y,           dispY: 0,          speed: 0.00, tiles: 1 },
  // Mountains — 10% speed; peaks appear from ~y=80 downward
  { sy: 295, sh: 310, dispH: GROUND_Y - 80,       dispY: 80,         speed: 0.10, tiles: 2 },
  // Hills / Forest — 40% speed; fills the lower skyline
  { sy: 376, sh: 374, dispH: GROUND_Y - 252,      dispY: 252,        speed: 0.40, tiles: 3 },
  // Ground — 100% speed; tight strip beneath GROUND_Y for the collision floor
  { sy: 700, sh: 52,  dispH: H - GROUND_Y + 4,   dispY: GROUND_Y - 2, speed: 1.00, tiles: 3 },
];

export class ParallaxBackground {
  readonly container: PIXI.Container;

  private readonly layerSprites: Array<PIXI.Sprite[]> = [];
  private readonly tilePx:        number[]             = [];
  private scrollX = 0;
  private ready   = false;

  constructor() {
    this.container = new PIXI.Container();
  }

  /** Call once after the transparent texture has been loaded. */
  init(tex: PIXI.Texture): void {
    for (const cfg of LAYERS) {
      const sub    = sliceTexture(tex, 0, cfg.sy, SRC_W, cfg.sh);
      const scaleH = cfg.dispH / cfg.sh;
      // Maintain source aspect ratio: width scales proportionally with height.
      const tileW  = Math.ceil(SRC_W * scaleH) + 1; // +1 closes sub-pixel seams

      const sprites: PIXI.Sprite[] = [];
      for (let t = 0; t < cfg.tiles; t++) {
        const s   = new PIXI.Sprite(sub);
        s.width   = tileW;
        s.height  = cfg.dispH;
        s.y       = cfg.dispY;
        s.x       = t * tileW;
        this.container.addChild(s);
        sprites.push(s);
      }
      this.layerSprites.push(sprites);
      this.tilePx.push(tileW);
    }
    this.ready = true;
  }

  /** Called every game frame with the per-frame scroll increment. */
  update(spd: number): void {
    this.scrollX += spd;
    if (!this.ready) return;

    for (let li = 0; li < LAYERS.length; li++) {
      const cfg     = LAYERS[li];
      if (cfg.speed === 0) continue;   // sky is static

      const tileW   = this.tilePx[li];
      const offset  = (this.scrollX * cfg.speed) % tileW;
      const sprites = this.layerSprites[li];

      for (let t = 0; t < sprites.length; t++) {
        sprites[t].x = t * tileW - offset;
      }
    }
  }
}
