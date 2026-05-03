import * as PIXI from 'pixi.js';
import { W, H } from '../utils/constants';

interface Layer {
  a:     PIXI.Sprite;
  b:     PIXI.Sprite;
  speed: number;
}

export class ParallaxBackground {
  readonly container: PIXI.Container;

  private readonly layers: Layer[] = [];
  private scrollX = 0;
  private ready   = false;

  constructor() {
    this.container = new PIXI.Container();
  }

  /**
   * Call once after all four layer textures have been loaded.
   * Each image is drawn at full canvas width (W), height scales proportionally.
   * Draw order: sky (back) → mountains → forest → ground (front).
   */
  init(sky: PIXI.Texture, mountains: PIXI.Texture, forest: PIXI.Texture, ground: PIXI.Texture): void {
    const add = (tex: PIXI.Texture, y: number, speed: number) => {
      const sc = W / tex.width;      // uniform scale: stretch to canvas width
      const a  = new PIXI.Sprite(tex);
      const b  = new PIXI.Sprite(tex);
      a.scale.set(sc);
      b.scale.set(sc);
      a.y = b.y = y;
      a.x = 0;
      b.x = W;                       // second tile starts just off the right edge
      this.container.addChild(a, b);
      this.layers.push({ a, b, speed });
    };

    // Sky — static, anchored at top
    add(sky, 0, 0.00);

    // Mountains
    add(mountains, 150, 0.10);

    // Forest
    add(forest, 350, 0.50);

    // Ground — bottom-aligned: y = H − displayed height
    const groundScale  = W / ground.width;
    const groundDispH  = ground.height * groundScale;
    add(ground, H - groundDispH, 1.00);

    this.ready = true;
  }

  /** Called every game frame with the per-frame scroll increment (px). */
  update(spd: number): void {
    this.scrollX += spd;
    if (!this.ready) return;

    for (const layer of this.layers) {
      if (layer.speed === 0) continue;       // sky never moves

      const offset = (this.scrollX * layer.speed) % W;
      layer.a.x = -offset;
      layer.b.x = W - offset;
    }
  }
}
