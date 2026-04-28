export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function distSq(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt(distSq(ax, ay, bx, by));
}

export function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function randInt(min: number, max: number): number {
  return Math.floor(randRange(min, max + 1));
}

export function randomSign(): number {
  return Math.random() < 0.5 ? -1 : 1;
}

/** Decay screen shake magnitude each frame */
export function decayShake(mag: number, decay = 0.88): number {
  return mag < 0.5 ? 0 : mag * decay;
}

/** Integer blink: returns true every `interval` frames */
export function blink(frame: number, interval: number): boolean {
  return Math.floor(frame / interval) % 2 === 0;
}

/** Time-based blink using Date.now() */
export function blinkMs(intervalMs: number): boolean {
  return Math.floor(Date.now() / intervalMs) % 2 === 0;
}

export function angleTo(x1: number, y1: number, x2: number, y2: number): number {
  return Math.atan2(y2 - y1, x2 - x1);
}
