import * as PIXI from 'pixi.js';
import { W, GROUND_Y, COL_GREEN, BALLOON_COUNT, BIRD_COUNT } from '../utils/constants';
import type { FwdMissileData } from './Missile';
import { dist } from '../utils/math';

export interface BalloonData {
  x: number; y: number;
  vy: number;
  r: number;
  phase: number;
  alive: boolean;
}

export interface BirdData {
  x: number; y: number;
  vx: number;
  phase: number;
  flap: number;
  size: number;
}

function mkBalloon(): BalloonData {
  return {
    x: W + 60 + Math.random() * 300,
    y: 60 + Math.random() * (GROUND_Y - 140),
    vy: (Math.random() - 0.5) * 0.5,
    r: 22 + Math.random() * 14 | 0,
    phase: Math.random() * Math.PI * 2,
    alive: true,
  };
}

function mkBird(): BirdData {
  return {
    x: W + 40 + Math.random() * 180,
    y: 70 + Math.random() * (GROUND_Y - 180),
    vx: -(2.2 + Math.random() * 1.6),
    phase: Math.random() * Math.PI * 2,
    flap: 0,
    size: 0.9 + Math.random() * 0.5,
  };
}

export function seedBalloons(): { balloons: BalloonData[]; birds: BirdData[] } {
  const balloons: BalloonData[] = [];
  for (let i = 0; i < BALLOON_COUNT; i++) {
    const b = mkBalloon();
    b.x = 120 + (i / BALLOON_COUNT) * (W * 1.8);
    balloons.push(b);
  }
  const birds: BirdData[] = Array.from({ length: BIRD_COUNT }, mkBird);
  return { balloons, birds };
}

export function updateBalloons(
  balloons: BalloonData[], birds: BirdData[], spd: number,
): { balloons: BalloonData[]; birds: BirdData[] } {
  for (const b of balloons) {
    b.x -= spd * 0.6;
    b.phase += 0.025;
    b.y += Math.sin(b.phase) * 0.4;
  }
  const aliveBalloons = balloons.filter(b => b.x + b.r > -20 && b.alive);
  while (aliveBalloons.length < BALLOON_COUNT) aliveBalloons.push(mkBalloon());

  for (const bird of birds) {
    bird.x += bird.vx;
    bird.phase += 0.08;
    bird.flap++;
    bird.y += Math.sin(bird.phase) * 0.3;
  }
  const alivebirds = birds.filter(b => b.x + 20 > -10);
  while (alivebirds.length < BIRD_COUNT) {
    const nb = mkBird();
    nb.x = W + 40;
    alivebirds.push(nb);
  }

  return { balloons: aliveBalloons, birds: alivebirds };
}

/** Check if a forward missile hits any balloon. Returns index or -1. */
export function checkBalloonHit(balloons: BalloonData[], m: FwdMissileData): number {
  for (let i = 0; i < balloons.length; i++) {
    const b = balloons[i];
    if (!b.alive) continue;
    if (dist(m.x, m.y, b.x, b.y) < b.r + 6) return i;
  }
  return -1;
}

/** Check if player heli collides with a bird (invincible obstacle). */
export function checkBirdCollision(
  birds: BirdData[], heliX: number, heliY: number, hitMult: number,
): boolean {
  for (const bird of birds) {
    if (dist(bird.x, bird.y, heliX, heliY) < 18 * hitMult) return true;
  }
  return false;
}

export class BalloonRenderer {
  readonly container: PIXI.Container;
  private readonly gfx: PIXI.Graphics;

  constructor() {
    this.container = new PIXI.Container();
    this.gfx = new PIXI.Graphics();
    this.container.addChild(this.gfx);
  }

  draw(balloons: BalloonData[], birds: BirdData[]): void {
    const g = this.gfx;
    g.clear();

    for (const b of balloons) {
      // Balloon circle
      g.circle(b.x, b.y, b.r).fill({ color: COL_GREEN, alpha: 0.9 })
       .stroke({ width: 1.5, color: 0xaaffcc });
      // Highlight
      g.circle(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.25).fill({ color: 0xffffff, alpha: 0.3 });
      // String
      g.moveTo(b.x, b.y + b.r).lineTo(b.x + Math.sin(b.phase) * 6, b.y + b.r + 20)
       .stroke({ width: 1, color: 0x005a18 });
      // Forward missile indicator dot (center)
      g.circle(b.x, b.y, 3).fill(0xffffff);
    }

    for (const bird of birds) {
      const flap = Math.sin(bird.flap * 0.25) * 8;
      const s = bird.size;
      // Wings
      g.moveTo(bird.x - 12 * s, bird.y - flap * s).lineTo(bird.x, bird.y)
       .stroke({ width: 1.5, color: 0xff6600 });
      g.moveTo(bird.x + 12 * s, bird.y - flap * s).lineTo(bird.x, bird.y)
       .stroke({ width: 1.5, color: 0xff6600 });
      // Body
      g.ellipse(bird.x, bird.y, 5 * s, 3 * s).fill(0x884400);
    }
  }
}
