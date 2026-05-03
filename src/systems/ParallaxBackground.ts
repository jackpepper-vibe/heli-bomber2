import * as PIXI from 'pixi.js';
import { H, GROUND_Y } from '../utils/constants';
import { sliceTexture } from '../utils/textureUtils';

// ── Source crop rectangles in backgrounds.png (1384 × 752) ───────────────────
//
//  Coordinates measured directly on the 752 px file.
//  Each crop window sits between the label strips to avoid reference text.
//
//    Layer 1 – Sky:          y =  35 → 210   (sh = 175)
//    Layer 2 – Mountains:    y = 245 → 420   (sh = 175)
//    Layer 3 – Hills/Forest: y = 455 → 630   (sh = 175)
//    Layer 4 – Ground:       y = 665 → 752   (sh =  87)

const SRC_W = 1384;

interface LayerCfg {
  sy:    number;  // source Y start
  sh:    number;  // source height (pixels to crop)
  dispH: number;  // display height in game pixels
  dispY: number;  // display Y (top edge) in game pixels
  speed: number;  // fraction of cumulative scroll (0 = static)
  tiles: number;  // sprite copies for seamless horizontal tiling
}

// tileW is derived in init() as ceil(SRC_W * dispH / sh) + 1, which preserves
// the source aspect ratio so the layers are never squashed or smeared.
const LAYERS: readonly LayerCfg[] = [
  // Sky — static; fills full sky viewport y=0..GROUND_Y
  { sy:  35, sh: 175, dispH: GROUND_Y,          dispY: 0,            speed: 0.00, tiles: 1 },
  // Mountains — 10% speed; peaks sit from y=260 downward, leaving open sky above
  { sy: 245, sh: 175, dispH: GROUND_Y - 260,    dispY: 260,          speed: 0.10, tiles: 2 },
  // Hills/Forest — 40% speed; low horizon band from y=360
  { sy: 455, sh: 175, dispH: GROUND_Y - 360,    dispY: 360,          speed: 0.40, tiles: 3 },
  // Ground — 100% speed; earth floor strip below GROUND_Y
  { sy: 665, sh:  87, dispH: H - GROUND_Y + 4,  dispY: GROUND_Y - 2, speed: 1.00, tiles: 4 },
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
