import * as PIXI from 'pixi.js';

/**
 * Load a PNG that uses a baked checkered transparency pattern (the kind image
 * editors render for transparent regions), strip those checker squares to
 * alpha=0, and return a PIXI Texture backed by a processed canvas.
 *
 * The checker alternates between ~185 and ~224 neutral gray. Any pixel that is
 * near-achromatic AND falls in either of those luminance bands is removed.
 */
export async function loadTransparentTexture(url: string): Promise<PIXI.Texture> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload  = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load texture: ${url}`));
    img.src     = url;
  });

  const canvas = document.createElement('canvas');
  canvas.width  = img.naturalWidth;
  canvas.height = img.naturalHeight;

  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d  = id.data;

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const avg = (r + g + b) / 3;
    const mx  = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
    // Neutrally gray (not saturated) AND matching either checker luminance band
    if (mx < 16 && ((avg >= 179 && avg <= 203) || (avg >= 213 && avg <= 233))) {
      d[i + 3] = 0;
    }
  }

  ctx.putImageData(id, 0, 0);
  return PIXI.Texture.from(canvas);
}

/** Create a sub-texture crop from an existing texture (zero-copy, just UV rect). */
export function sliceTexture(
  base: PIXI.Texture,
  x: number, y: number, w: number, h: number,
): PIXI.Texture {
  return new PIXI.Texture({
    source: base.source,
    frame:  new PIXI.Rectangle(x, y, w, h),
  });
}
