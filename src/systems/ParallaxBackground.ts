import * as PIXI from 'pixi.js';
import { H, GROUND_Y } from '../utils/constants';
import { sliceTexture } from '../utils/textureUtils';

// ── backgrounds2.png — 4 equal horizontal strips of 256 px each ──────────────
//
//   Strip 0 – Sky:          y =   0 → 256
//   Strip 1 – Mountains:    y = 256 → 512
//   Strip 2 – Hills/Forest: y = 512 → 768
//   Strip 3 – Ground:       y = 768 → 1024

const SRC_SH = 256;  // source height per strip (constant for all layers)

interface LayerCfg {
  sy:    number;  // source Y start
  dispH: number;  // display height in game pixels
  dispY: number;  // display Y (top edge) in game pixels
  speed: number;  // fraction of cumulative scroll (0 = static)
}

const LAYERS: readonly LayerCfg[] = [
  // Sky — static; fills full sky viewport y=0..GROUND_Y
  { sy:   0, dispH: GROUND_Y,          dispY: 0,            speed: 0.00 },
  // Mountains — 10% speed; peaks sit from y=260 downward
  { sy: 256, dispH: GROUND_Y - 260,    dispY: 260,          speed: 0.10 },
  // Hills/Forest — 50% speed; low horizon band from y=360
  { sy: 512, dispH: GROUND_Y - 360,    dispY: 360,          speed: 0.50 },
  // Ground — 100% speed; earth floor strip below GROUND_Y
  { sy: 768, dispH: H - GROUND_Y + 4,  dispY: GROUND_Y - 2, speed: 1.00 },
];

export class ParallaxBackground {
  readonly container: PIXI.Container;

  private readonly layerSprites: Array<[PIXI.Sprite, PIXI.Sprite]> = [];
  private readonly tilePx:       number[]                          = [];
  private scrollX = 0;
  private ready   = false;

  constructor() {
    this.container = new PIXI.Container();
  }

  /** Call once after the texture has been loaded. */
  init(tex: PIXI.Texture): void {
    const srcW = tex.width;  // full image width, whatever the asset provides

    for (const cfg of LAYERS) {
      const sub    = sliceTexture(tex, 0, cfg.sy, srcW, SRC_SH);
      const scaleH = cfg.dispH / SRC_SH;
      const tileW  = Math.ceil(srcW * scaleH) + 1;  // aspect-ratio-preserving; +1 closes sub-pixel seams

      const a = new PIXI.Sprite(sub);
      const b = new PIXI.Sprite(sub);
      for (const s of [a, b]) {
        s.width  = tileW;
        s.height = cfg.dispH;
        s.y      = cfg.dispY;
      }
      a.x = 0;
      b.x = tileW;
      this.container.addChild(a, b);
      this.layerSprites.push([a, b]);
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

      const tileW  = this.tilePx[li];
      const offset = (this.scrollX * cfg.speed) % tileW;
      const [a, b] = this.layerSprites[li];

      a.x = -offset;
      b.x = tileW - offset;
    }
  }
}
