import * as PIXI from 'pixi.js';
import { H, GROUND_Y } from '../utils/constants';
import { sliceTexture } from '../utils/textureUtils';

// ── Source crop rectangles in backgrounds.png (1384 × 752) ───────────────────
//
//  Each section has a label row (checker-stripped to transparent) above it,
//  identified by decoding actual PNG pixel values.
//
//  Label rows (neutral grays, stripped to transparent, must be excluded):
//    y=  0– 45  Sky label
//    y=295–344  Mountain label
//    y=601–630  Hills label
//
//  Content rows (fully opaque, real scene art):
//    y= 46–294  Sky   — blue gradient with sun and atmosphere
//    y=345–600  Mountains — dark distant peaks and foothills
//    y=631–710  Hills/Forest — green rolling hills and trees
//    y=710–742  Ground strip — dark earth and grass floor

const SRC_W = 1384;

interface LayerCfg {
  sy:    number;  // source Y start  (first content row, labels excluded)
  sh:    number;  // source height   (content rows only)
  dispH: number;  // display height in game pixels
  dispY: number;  // display Y (top edge) in game pixels
  speed: number;  // fraction of cumulative scroll (0 = static)
  tiles: number;  // sprite copies for seamless horizontal tiling
}

const LAYERS: readonly LayerCfg[] = [
  // Sky — static; fills entire sky viewport (y=0..GROUND_Y)
  { sy:  46, sh: 248, dispH: GROUND_Y,          dispY: 0,            speed: 0.00, tiles: 1 },
  // Mountains — 10% parallax; peaks start at y=260 leaving clear sky above
  { sy: 345, sh: 255, dispH: GROUND_Y - 260,    dispY: 260,          speed: 0.10, tiles: 2 },
  // Hills/Forest — 40% parallax; low horizon band starting at y=360
  { sy: 631, sh:  80, dispH: GROUND_Y - 360,    dispY: 360,          speed: 0.40, tiles: 3 },
  // Ground strip — 100% parallax; tight earth floor beneath GROUND_Y
  { sy: 710, sh:  32, dispH: H - GROUND_Y + 4,  dispY: GROUND_Y - 2, speed: 1.00, tiles: 4 },
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

  /** Call once after the texture has been loaded. */
  init(tex: PIXI.Texture): void {
    for (const cfg of LAYERS) {
      const sub    = sliceTexture(tex, 0, cfg.sy, SRC_W, cfg.sh);
      const scaleH = cfg.dispH / cfg.sh;
      const tileW  = Math.ceil(SRC_W * scaleH) + 1;  // +1 closes sub-pixel seams

      const sprites: PIXI.Sprite[] = [];
      for (let t = 0; t < cfg.tiles; t++) {
        const s = new PIXI.Sprite(sub);
        s.width  = tileW;
        s.height = cfg.dispH;
        s.y      = cfg.dispY;
        s.x      = t * tileW;
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
      const cfg = LAYERS[li];
      if (cfg.speed === 0) continue;   // sky layer is static

      const tileW   = this.tilePx[li];
      const offset  = (this.scrollX * cfg.speed) % tileW;
      const sprites = this.layerSprites[li];

      for (let t = 0; t < sprites.length; t++) {
        sprites[t].x = t * tileW - offset;
      }
    }
  }
}
