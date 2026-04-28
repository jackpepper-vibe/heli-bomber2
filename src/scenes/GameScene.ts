import * as PIXI from 'pixi.js';
import {
  W, H, GROUND_Y,
  HELI_MODELS, BOMBS_PER_LEVEL, TOTAL_LEVELS,
  COMBO_WINDOW, COL_LT_GREEN,
  LEVEL_DIST, SCROLL_BASE,
  OBS_W, OBS_GAP, OBS_SPD,
} from '../utils/constants';
import { decayShake } from '../utils/math';
import type { AudioSystem } from '../core/AudioSystem';
import type { InputSystem } from '../core/InputSystem';
import type { HUD } from '../ui/HUD';
import type { LevelTransition } from '../ui/LevelTransition';

import { Helicopter }          from '../entities/Helicopter';
import { BuildingRenderer, mkBuilding, checkBombHit, seedBuildings } from '../entities/Building';
import type { BuildingData }   from '../entities/Building';
import { BombRenderer, spawnBomb } from '../entities/Bomb';
import type { BombData }       from '../entities/Bomb';
import { PowerUpRenderer, maybeSpawnPowerUp, updatePowerUps, checkPowerUpCollect, applyPowerUp } from '../entities/PowerUp';
import type { PowerUpData, ActivePowers } from '../entities/PowerUp';
import { MissileRenderer, makeLaunchers, resetLaunchers, updateMissiles, fireFwdMissile, updateFwdMissiles, fireStormMissile, updateStormMissiles } from '../entities/Missile';
import type { MissileData, FwdMissileData, Launcher } from '../entities/Missile';
import { EnemyHeliRenderer, seedEnemyHelis, updateEnemyHelis, updateEnemyMissiles, checkFwdMissileHit } from '../entities/EnemyHelicopter';
import type { EnemyHeliData, EnemyMissileData } from '../entities/EnemyHelicopter';
import { BalloonRenderer, seedBalloons, updateBalloons, checkBalloonHit, checkBirdCollision } from '../entities/Balloon';
import type { BalloonData, BirdData } from '../entities/Balloon';
import { MineRenderer, seedMines, updateMines, checkBombHitMine, checkHeliHitMine } from '../entities/Mine';
import type { MineData } from '../entities/Mine';
import { ShipRenderer, seedShips, updateShips, updateSeaMissiles, fireSeaMissile, checkBombHitShip } from '../entities/Ship';
import type { ShipData, SeaMissileData } from '../entities/Ship';

import { ParticleSystem }    from '../systems/ParticleSystem';
import { BackgroundSystem }  from '../systems/BackgroundSystem';
import { CaveSystem }        from '../systems/CaveSystem';
import { StormSystem }       from '../systems/StormSystem';

// ── Obstacle (Level 2) ─────────────────────────────────────────────────────────
interface ObstacleData { x: number; gapTop: number; }

export class GameScene {
  readonly container: PIXI.Container;
  private readonly worldContainer: PIXI.Container;
  private readonly uiContainer: PIXI.Container;

  // Core refs
  private readonly audio: AudioSystem;
  private readonly input: InputSystem;
  private readonly hud: HUD;
  private readonly transition: LevelTransition;

  // Entities + systems
  private readonly heli: Helicopter;
  private readonly bg: BackgroundSystem;
  private readonly particles: ParticleSystem;
  private readonly cave: CaveSystem;
  private readonly storm: StormSystem;
  private readonly buildingRenderer: BuildingRenderer;
  private readonly bombRenderer: BombRenderer;
  private readonly powerUpRenderer: PowerUpRenderer;
  private readonly missileRenderer: MissileRenderer;
  private readonly enemyHeliRenderer: EnemyHeliRenderer;
  private readonly balloonRenderer: BalloonRenderer;
  private readonly mineRenderer: MineRenderer;
  private readonly shipRenderer: ShipRenderer;

  // Overlay text for crash/fanfare
  private readonly overlayText: PIXI.Text;

  // Game state
  private score = 0;
  private currentLevel = 1;
  private levelStartScore = 0;
  private gameRunning = false;
  private levelDone = false;

  private finishLineX = W + LEVEL_DIST;
  private bombsLeft = 0;
  private outOfBombsTriggered = false;
  private outOfBombsFlash = 0;
  private fanfareFlash = 0;

  // Combo
  private comboCount = 0;
  private comboTimer = 0;

  // Active powers
  private powers: ActivePowers = { shield: 0, score2x: 0 };

  // Screen shake
  private shakeX = 0;
  private shakeY = 0;
  private shakeMag = 0;

  // Water phase (Level 9)
  private waterPhase = 0;

  // Entity arrays
  private buildings: BuildingData[] = [];
  private bombs: BombData[] = [];
  private obstacles: ObstacleData[] = [];
  private missiles: MissileData[] = [];
  private launchers: Launcher[] = [];
  private fwdMissiles: FwdMissileData[] = [];
  private enemyHelis: EnemyHeliData[] = [];
  private enemyMissiles: EnemyMissileData[] = [];
  private balloons: BalloonData[] = [];
  private birds: BirdData[] = [];
  private powerUps: PowerUpData[] = [];
  private mines: MineData[] = [];
  private ships: ShipData[] = [];
  private seaMissiles: SeaMissileData[] = [];
  private seaMissileTimer = 140;
  private stormMissiles: MissileData[] = [];
  private stormMissileTimer = 100;

  private onGameOver: ((score: number) => void) = () => undefined;

  constructor(
    audio: AudioSystem, input: InputSystem,
    hud: HUD, transition: LevelTransition,
    modelId: number,
  ) {
    this.audio = audio;
    this.input = input;
    this.hud = hud;
    this.transition = transition;

    this.container      = new PIXI.Container();
    this.worldContainer = new PIXI.Container();
    this.uiContainer    = new PIXI.Container();
    this.container.addChild(this.worldContainer, this.uiContainer);

    const model = HELI_MODELS[modelId] ?? HELI_MODELS[1];
    this.heli = new Helicopter(model);

    this.bg              = new BackgroundSystem();
    this.particles       = new ParticleSystem();
    this.cave            = new CaveSystem();
    this.storm           = new StormSystem();
    this.buildingRenderer = new BuildingRenderer();
    this.bombRenderer    = new BombRenderer();
    this.powerUpRenderer = new PowerUpRenderer();
    this.missileRenderer = new MissileRenderer();
    this.enemyHeliRenderer = new EnemyHeliRenderer();
    this.balloonRenderer = new BalloonRenderer();
    this.mineRenderer    = new MineRenderer();
    this.shipRenderer    = new ShipRenderer();

    this.overlayText = new PIXI.Text({
      text: '',
      style: { fontFamily: 'Courier New', fontSize: 40, fontWeight: 'bold', fill: 0xff4400 },
    });
    this.overlayText.anchor.set(0.5, 0.5);
    this.overlayText.x = W / 2; this.overlayText.y = H / 2 - 10;
    this.overlayText.visible = false;

    // Layer order
    this.worldContainer.addChild(
      this.bg.container,
      this.buildingRenderer.container,
      this.shipRenderer.container,
      this.mineRenderer.container,
      this.missileRenderer.container,
      this.enemyHeliRenderer.container,
      this.balloonRenderer.container,
      this.bombRenderer.container,
      this.powerUpRenderer.container,
      this.cave.container,
      this.particles.container,
      this.heli.gfx,
    );
    this.uiContainer.addChild(this.storm.container, this.overlayText);
  }

  async init(): Promise<void> { /* initialisation done in start() */ }

  start(playerName: string): void {
    this.score = 0;
    this.currentLevel = 1;
    this.levelStartScore = 0;
    this.comboCount = 0; this.comboTimer = 0;
    this.powers = { shield: 0, score2x: 0 };
    this.shakeX = 0; this.shakeY = 0; this.shakeMag = 0;
    this.fanfareFlash = 0;
    this.waterPhase = 0;

    this.heli.x = 210; this.heli.y = 230;
    this.input.clearAll();

    this.bg.init();
    this.particles.clear();

    this.hud.setName(playerName);
    this.hud.setScore(0);
    this.hud.setLevel(1);
    this.hud.show();

    this.launchers = makeLaunchers();
    this._startLevel();
    this._showTransition(1, false).catch(() => undefined);
  }

  setOnGameOver(cb: (score: number) => void): void {
    this.onGameOver = cb;
  }

  update(_dt: number): void {
    if (!this.gameRunning) return;

    this.input.tick();
    const intent = this.input.intent;

    // Heli movement
    this.heli.applyIntent(intent);
    this.heli.update();

    // Cave-specific constraint
    if (this.currentLevel === 5) {
      const { ceil, floor } = this.cave.getProfile(this.heli.x);
      this.heli.clampToCave(ceil, floor);
    }

    // Storm wind
    if (this.currentLevel === 7) {
      const pos = this.storm.applyWind(this.heli.x, this.heli.y);
      this.heli.x = pos.x; this.heli.y = pos.y;
    }

    // World scroll speed
    let spd = SCROLL_BASE + (this.currentLevel - 1) * 0.5;
    if (intent.right) spd += 1.8;
    if (intent.left)  spd = Math.max(0.4, spd - 1.2);

    // Background
    this.bg.update(spd);

    // Finish line (non-cave levels)
    if (this.currentLevel !== 5 && !this.levelDone) {
      this.finishLineX -= spd;
      const distLeft = Math.max(0, Math.floor(this.finishLineX - this.heli.x));
      this.hud.setDist(distLeft);

      if (this.finishLineX < this.heli.x) {
        this.levelDone = true;
        this.fanfareFlash = 18;
        this.particles.spawnSparks(this.heli.x, this.heli.y, 60);
        setTimeout(() => this._completeLevelOrEnd(), 400);
        return;
      }
    }

    // Fire intent
    if (intent.fire) {
      this.input.consumeFire();
      this._handleFire();
    }

    // Level-specific update
    this._updateLevel(spd);

    // Global updates
    this._updateBombs();
    this._updatePowerUps(spd);
    this._updateCombo();
    this.particles.update();

    // Screen shake decay
    this.shakeMag = decayShake(this.shakeMag);
    this.shakeX = (Math.random() - 0.5) * this.shakeMag * 2;
    this.shakeY = (Math.random() - 0.5) * this.shakeMag * 2;
    this.worldContainer.x = this.shakeX;
    this.worldContainer.y = this.shakeY;

    if (this.fanfareFlash > 0) this.fanfareFlash--;
    if (this.outOfBombsFlash > 0) this.outOfBombsFlash++;
  }

  destroy(): void {
    this.gameRunning = false;
    this.hud.hide();
  }

  // ── Fire ──────────────────────────────────────────────────────────────────────

  private _handleFire(): void {
    if (this.currentLevel === 4 || this.currentLevel === 6) {
      this.fwdMissiles.push(fireFwdMissile(this.heli.x, this.heli.y));
      this.audio.missileLaunch();
    } else if (this.currentLevel === 5) {
      this.fwdMissiles.push(fireFwdMissile(this.heli.x, this.heli.y));
      this.audio.missileLaunch();
    } else {
      this._dropBomb();
    }
  }

  private _dropBomb(): void {
    if (this.bombsLeft <= 0) return;
    const s = this.heli.model.scale;
    this.bombs.push(spawnBomb(this.heli.x + 6, this.heli.y + 13 * s));
    if (this.heli.model.id === 2) {
      this.bombs.push(spawnBomb(this.heli.x - 18 * s, this.heli.y + 13 * s));
    }
    this.bombsLeft--;
    this.audio.bombDrop();
    this.hud.setBombs(this.bombsLeft, this.currentLevel);
    if (this.bombsLeft === 0 && !this.outOfBombsTriggered && !this.levelDone) {
      this.outOfBombsTriggered = true;
      this.outOfBombsFlash = 1;
      setTimeout(() => { if (this.gameRunning) this._completeLevelOrEnd(); }, 2000);
    }
  }

  // ── Level-specific update ─────────────────────────────────────────────────────

  private _updateLevel(spd: number): void {
    const lv = this.currentLevel;

    if (lv !== 9) {
      // Buildings scroll (all non-sea levels)
      for (const b of this.buildings) b.x -= spd;
      this.buildings = this.buildings.filter(b => b.x + b.baseW > -10);
      const last = this.buildings[this.buildings.length - 1];
      if (!last || last.x + last.baseW < W + 120) {
        const nx = (last ? last.x + last.baseW : W + 60) + 80 + (Math.random() * 80 | 0);
        this.buildings.push(mkBuilding(nx));
      }
    }

    switch (lv) {
      case 2: this._updateObstacles(spd); break;
      case 3: this._updateMissiles3(); break;
      case 4: this._updateBalloons(spd); this._updateFwdMissiles4(); break;
      case 5: this._updateCave(); break;
      case 6: this._updateEnemyHelis(); this._updateFwdMissiles6(); break;
      case 7: this._updateStorm(); break;
      case 8: this._updateMines(spd); break;
      case 9: this._updateSea(spd); break;
    }
  }

  // Level 2: Barriers
  private _updateObstacles(_spd: number): void {
    const playH = GROUND_Y - 36;
    const last = this.obstacles[this.obstacles.length - 1];
    if (!last || last.x < W - (280 + Math.random() * 100 | 0)) {
      const gapTop = 36 + Math.random() * (playH - OBS_GAP);
      this.obstacles.push({ x: W + OBS_W, gapTop });
    }

    const hm = this.heli.model.hitMult;
    this.obstacles = this.obstacles.filter(ob => {
      ob.x -= OBS_SPD;
      const gapBot = ob.gapTop + OBS_GAP;
      const hx1 = this.heli.x - 38 * hm, hx2 = this.heli.x + 32 * hm;
      const hy1 = this.heli.y - 22 * hm, hy2 = this.heli.y + 24 * hm;
      const overlapX = hx2 > ob.x && hx1 < ob.x + OBS_W;
      if (overlapX && (hy1 < ob.gapTop || hy2 > gapBot)) {
        this.particles.spawnSparks(this.heli.x, this.heli.y);
        this._addScore(-200);
        this.audio.heliHit();
        this.heli.x = 120; this.heli.y = GROUND_Y / 2;
        this.shakeMag = Math.max(this.shakeMag, 8);
      }
      return ob.x + OBS_W > -10;
    });
  }

  // Level 3: Ground missiles
  private _updateMissiles3(): void {
    this.missiles = updateMissiles(
      this.missiles, this.launchers,
      this.heli.x, this.heli.y, this.heli.model.hitMult,
      (m) => {
        if (this.powers.shield > 0) {
          this.powers.shield = Math.max(0, this.powers.shield - 60 * 3);
          this.particles.spawnSparks(m.x, m.y);
          return 'absorb';
        }
        this._addScore(-200);
        this.particles.spawnSparks(m.x, m.y);
        this.audio.heliHit();
        this.shakeMag = Math.max(this.shakeMag, 6);
        return 'kill';
      },
      () => this.audio.missileLaunch(),
    );
  }

  // Level 4: Balloons + fwd missiles
  private _updateBalloons(spd: number): void {
    const { balloons, birds } = updateBalloons(this.balloons, this.birds, spd);
    this.balloons = balloons; this.birds = birds;

    // Bird collision (-500 pts)
    if (!this.levelDone && checkBirdCollision(this.birds, this.heli.x, this.heli.y, this.heli.model.hitMult)) {
      this.particles.spawnSparks(this.heli.x, this.heli.y);
      this._addScore(-500);
      this.audio.heliHit();
      this.shakeMag = Math.max(this.shakeMag, 8);
    }
  }

  private _updateFwdMissiles4(): void {
    this.fwdMissiles = updateFwdMissiles(this.fwdMissiles, (m) => {
      const idx = checkBalloonHit(this.balloons, m);
      if (idx >= 0) {
        const b = this.balloons[idx];
        this.balloons.splice(idx, 1);
        this.particles.spawnExplosion(b.x, b.y, 0.8);
        const pts = this._calcComboScore(200);
        this._addScore(pts);
        this.particles.spawnComboPopup(b.x, b.y, this.comboCount, pts, this.powers.score2x > 0);
        this.audio.bombHit();
        this.shakeMag = Math.max(this.shakeMag, 4);
        return true;
      }
      return false;
    });
  }

  // Level 5: Cave
  private _updateCave(): void {
    this.cave.update(
      this.heli.x, this.heli.y, this.heli.model.hitMult,
      (x, y) => fireFwdMissile(x, y),
      () => {
        this.particles.spawnExplosion(this.heli.x, this.heli.y, 2.2);
        this.audio.crash();
        this.shakeMag = 20;
        setTimeout(() => {
          if (this.currentLevel < TOTAL_LEVELS) {
            this._advanceLevel();
          } else {
            this._endGame();
          }
        }, 2600);
      },
    );
    // Forward missiles destroy rocks, formations, and cave missiles on contact
    this.fwdMissiles = updateFwdMissiles(this.fwdMissiles, (m) => this.cave.checkObstacleHit(m));
    // Update cave HUD distance via scrollX
    this.hud.setDist(Math.max(0, LEVEL_DIST - Math.floor(this.cave.currentScroll)));
    if (this.cave.currentScroll >= LEVEL_DIST && !this.levelDone) {
      this.levelDone = true;
      setTimeout(() => this._completeLevelOrEnd(), 500);
    }
  }

  // Level 6: Enemy helis + fwd missiles
  private _updateEnemyHelis(): void {
    this.enemyHelis = updateEnemyHelis(
      this.enemyHelis, this.enemyMissiles,
      this.heli.x, this.heli.y,
      () => this.audio.missileLaunch(),
    );

    this.enemyMissiles = updateEnemyMissiles(
      this.enemyMissiles, this.heli.x, this.heli.y, this.heli.model.hitMult,
      (m) => {
        if (this.powers.shield > 0) {
          this.powers.shield = Math.max(0, this.powers.shield - 60 * 3);
          this.particles.spawnSparks(m.x, m.y);
          return 'absorb';
        }
        this._addScore(-200);
        this.particles.spawnSparks(m.x, m.y);
        this.audio.heliHit();
        this.shakeMag = Math.max(this.shakeMag, 6);
        return 'kill';
      },
    );
  }

  private _updateFwdMissiles6(): void {
    this.fwdMissiles = updateFwdMissiles(this.fwdMissiles, (m) => {
      for (let i = this.enemyHelis.length - 1; i >= 0; i--) {
        const e = this.enemyHelis[i];
        if (checkFwdMissileHit(e, m.x, m.y)) {
          e.hp--;
          this.particles.spawnExplosion(e.x, e.y, 1.2);
          this.audio.bombHit();
          this.shakeMag = Math.max(this.shakeMag, 5);
          if (e.hp <= 0) {
            this.particles.spawnExplosion(e.x, e.y, 2.0);
            const pts = this._calcComboScore(e.points);
            this._addScore(pts);
            this.particles.spawnComboPopup(e.x, e.y, this.comboCount, pts, this.powers.score2x > 0);
            const pu = maybeSpawnPowerUp(e.x, e.y);
            if (pu) this.powerUps.push(pu);
            this.enemyHelis.splice(i, 1);
          }
          return true;
        }
      }
      return false;
    });
  }

  // Level 7: Storm
  private _updateStorm(): void {
    this.storm.update();
    if (--this.stormMissileTimer <= 0) {
      this.stormMissileTimer = 140 + Math.floor(Math.random() * 100);
      this.stormMissiles.push(fireStormMissile(this.heli.x, this.heli.y));
      this.audio.missileLaunch();
    }
    this.stormMissiles = updateStormMissiles(
      this.stormMissiles, this.heli.x, this.heli.y, this.heli.model.hitMult,
      (m) => {
        if (this.powers.shield > 0) {
          this.powers.shield = Math.max(0, this.powers.shield - 60 * 3);
          this.particles.spawnSparks(m.x, m.y);
          return 'absorb';
        }
        this._addScore(-200);
        this.particles.spawnSparks(m.x, m.y);
        this.audio.heliHit();
        this.shakeMag = Math.max(this.shakeMag, 6);
        return 'kill';
      },
    );
  }

  // Level 8: Mines
  private _updateMines(spd: number): void {
    const { mines, spawnNew } = updateMines(this.mines, spd);
    this.mines = mines;
    if (spawnNew) {
      const last = this.mines[this.mines.length - 1];
      const x = (last ? last.x : W) + 80 + Math.random() * 60;
      const y = GROUND_Y - 20 - Math.random() * (GROUND_Y * 0.45);
      this.mines.push({ x, y, phase: Math.random() * Math.PI * 2, hp: 1, active: true });
    }

    // Heli-mine collision
    for (const mine of this.mines) {
      if (checkHeliHitMine(mine, this.heli.x, this.heli.y, this.heli.model.hitMult)) {
        if (this.powers.shield > 0) {
          this.powers.shield = Math.max(0, this.powers.shield - 60 * 3);
          this.particles.spawnSparks(mine.x, mine.y);
          mine.active = false;
        } else {
          this.particles.spawnExplosion(mine.x, mine.y, 1.6);
          this._addScore(-500);
          this.audio.crash();
          this.shakeMag = 15;
          mine.active = false;
        }
      }
    }
  }

  // Level 9: Sea
  private _updateSea(spd: number): void {
    this.waterPhase += 0.04;
    this.ships = updateShips(this.ships, spd);

    this.seaMissiles = updateSeaMissiles(
      this.seaMissiles, this.ships,
      this.heli.x, this.heli.y, this.heli.model.hitMult,
      (m) => {
        if (this.powers.shield > 0) {
          this.powers.shield = Math.max(0, this.powers.shield - 60 * 3);
          this.particles.spawnSparks(m.x, m.y);
          return 'absorb';
        }
        this.particles.spawnExplosion(this.heli.x, this.heli.y, 2.2);
        this.audio.crash();
        this.shakeMag = 20;
        setTimeout(() => {
          if (this.currentLevel < TOTAL_LEVELS) this._advanceLevel();
          else this._endGame();
        }, 2600);
        return 'kill';
      },
      () => {
        // Timer-based fire from a ship
        if (--this.seaMissileTimer > 0) return null;
        this.seaMissileTimer = 220 + Math.floor(Math.random() * 180);
        const eligible = this.ships.filter(s => s.def.launcher && s.x > 40 && s.x + s.w < W - 40 && s.hp > 0);
        if (!eligible.length) return null;
        const ship = eligible[Math.floor(Math.random() * eligible.length)];
        this.audio.missileLaunch();
        return fireSeaMissile(ship, this.heli.x, this.heli.y);
      },
    );
  }

  // ── Bomb update (all levels) ──────────────────────────────────────────────────

  private _updateBombs(): void {
    const lv = this.currentLevel;
    this.bombs = this.bombs.filter(bm => {
      bm.y += 3.5; // BOMB_SPD

      // Level 9: ship hit or water splash
      if (lv === 9) {
        if (bm.y > GROUND_Y + 8) {
          this.particles.spawnExplosion(bm.x, GROUND_Y - 2, 0.5);
          this.particles.spawnSplash(bm.x);
          return false;
        }
        for (let si = this.ships.length - 1; si >= 0; si--) {
          const s = this.ships[si];
          if (checkBombHitShip(bm, s)) {
            s.hp--;
            this.comboCount++; this.comboTimer = COMBO_WINDOW;
            const mult = this._comboMult();
            const doub = this.powers.score2x > 0 ? 2 : 1;
            if (s.hp <= 0) {
              this.particles.spawnExplosion(s.x + s.w * 0.5, s.y, 2.4);
              this.particles.spawnExplosion(s.x + s.w * 0.3, s.y + s.h * 0.3, 1.5);
              const base = s.def.points;
              const pts = base * mult * doub;
              this._addScore(pts);
              const lbl = `${s.def.label}! ${mult > 1 ? `COMBO x${mult}! ` : ''}+${pts}`;
              this.particles.addScorePopup(bm.x, bm.y, lbl, 0xffff44);
              const pu = maybeSpawnPowerUp(s.x + s.w * 0.5, s.y);
              if (pu) this.powerUps.push(pu);
              this.ships.splice(si, 1);
            } else {
              this.particles.spawnExplosion(bm.x, bm.y, 1.0);
              const pts = 80 * mult * doub;
              this._addScore(pts);
              this.particles.addScorePopup(bm.x, bm.y, `+${pts}`, mult > 1 ? 0xffff44 : COL_LT_GREEN);
            }
            this.audio.bombHit();
            this.shakeMag = Math.max(this.shakeMag, 5);
            return false;
          }
        }
        return true;
      }

      // Level 8: mine hit
      if (lv === 8) {
        for (let i = this.mines.length - 1; i >= 0; i--) {
          if (checkBombHitMine(bm, this.mines[i])) {
            this.mines[i].active = false;
            this.particles.spawnExplosion(bm.x, bm.y, 1.2);
            const pts = this._calcComboScore(400);
            this._addScore(pts);
            this.particles.spawnComboPopup(bm.x, bm.y, this.comboCount, pts, this.powers.score2x > 0);
            this.audio.bombHit();
            this.shakeMag = Math.max(this.shakeMag, 5);
            return false;
          }
        }
      }

      // Ground hit
      if (bm.y > GROUND_Y + 10) {
        this.particles.spawnExplosion(bm.x, GROUND_Y - 4, 0.6);
        return false;
      }

      // Building hit
      for (let bi = this.buildings.length - 1; bi >= 0; bi--) {
        const b = this.buildings[bi];
        const layerIdx = checkBombHit(b, bm.x, bm.y);
        if (layerIdx < 0) continue;

        this.comboCount++; this.comboTimer = COMBO_WINDOW;
        const mult  = this._comboMult();
        const doub  = this.powers.score2x > 0 ? 2 : 1;
        b.hp--;
        if (b.hp <= 0) {
          const collapseBase = b.type === 'fuel' ? 400 : b.type === 'radar' ? 350 :
            b.type === 'bunker' ? 600 : 150 * b.totalLayers;
          const pts = collapseBase * mult * doub;
          if (b.type === 'fuel') {
            const fx = b.x + b.baseW / 2;
            this.particles.spawnExplosion(fx, bm.y, 3.5);
            this.particles.spawnExplosion(fx - 18, bm.y + 8, 2.2);
            this.particles.spawnExplosion(fx + 18, bm.y + 8, 2.2);
            setTimeout(() => this.particles.spawnExplosion(fx, bm.y - 10, 2.0), 120);
          } else {
            this.particles.spawnExplosion(bm.x, bm.y, 1.6);
          }
          this._addScore(pts);
          const label = b.type !== 'building' ? `${b.type.toUpperCase()}! +${pts}`
            : mult > 1 ? `RAZED! COMBO x${mult}! +${pts}` : `RAZED! +${pts}`;
          this.particles.addScorePopup(bm.x, bm.y, label, b.type !== 'building' ? 0xffff44 : 0xff9900);
          if (b.type === 'fuel' || b.type === 'radar' || b.type === 'bunker') {
            const pu = maybeSpawnPowerUp(b.x + b.baseW / 2, bm.y);
            if (pu) this.powerUps.push(pu);
          }
          this.buildings.splice(bi, 1);
        } else {
          b.damaged = true;
          b.layers.splice(layerIdx, 1);
          const pts = (b.type === 'bunker' ? 150 : 80) * mult * doub;
          this._addScore(pts);
          this.particles.spawnExplosion(bm.x, bm.y, 1.0);
          this.particles.addScorePopup(bm.x, bm.y, `+${pts}`, mult > 1 ? 0xffff44 : COL_LT_GREEN);
        }
        this.audio.bombHit();
        this.shakeMag = Math.max(this.shakeMag, 6);
        return false;
      }
      return true;
    });
  }

  private _updatePowerUps(spd: number): void {
    this.powerUps = updatePowerUps(this.powerUps, spd);
    const { remaining, collected } = checkPowerUpCollect(this.powerUps, this.heli.x, this.heli.y);
    this.powerUps = remaining;
    for (const p of collected) {
      const extra = applyPowerUp(this.powers, p.type);
      if (extra > 0) {
        this.bombsLeft += extra;
        this.hud.setBombs(this.bombsLeft, this.currentLevel);
      }
      this.audio.powerUp();
      this.particles.addScorePopup(p.x, p.y, `${p.type} POWER-UP!`, 0xffff44);
    }
    if (this.powers.shield > 0) this.powers.shield--;
    if (this.powers.score2x > 0) this.powers.score2x--;
  }

  private _updateCombo(): void {
    if (this.comboTimer > 0) {
      if (--this.comboTimer === 0) this.comboCount = 0;
    }
  }

  // ── Draw ──────────────────────────────────────────────────────────────────────

  draw(): void {
    const lv = this.currentLevel;
    const isCityLevel = lv !== 4 && lv !== 5 && lv !== 9;
    const isSeaLevel  = lv === 9;

    // Background
    if (isSeaLevel) {
      this.bg.draw(false, true);
      this.bg.drawSea(this.waterPhase);
    } else {
      this.bg.draw(isCityLevel, false);
    }

    // Finish line
    if (lv !== 5 && !isSeaLevel) {
      this.bg.drawFinishLine(this.finishLineX);
    }

    // Buildings
    if (isCityLevel) this.buildingRenderer.draw(this.buildings);

    // Ships — always call so g.clear() runs; pass empty array when inactive
    this.shipRenderer.draw(isSeaLevel ? this.ships : [], isSeaLevel ? this.seaMissiles : []);

    // Mines — always call so g.clear() runs
    this.mineRenderer.draw(lv === 8 ? this.mines : []);

    // Obstacles (level 2) — drawn inline in gfx
    this._drawObstacles();

    // Missiles + launchers — always call so g.clear() runs
    this.missileRenderer.draw(this.missiles, this.launchers, this.fwdMissiles, lv);
    if (lv === 7) this.missileRenderer.draw(this.stormMissiles, [], [], lv);

    // Enemy helis — always call so g.clear() runs
    this.enemyHeliRenderer.draw(lv === 6 ? this.enemyHelis : [], lv === 6 ? this.enemyMissiles : []);

    // Balloons — always call so g.clear() runs
    this.balloonRenderer.draw(lv === 4 ? this.balloons : [], lv === 4 ? this.birds : []);

    // Bombs (city + mines + ships)
    this.bombRenderer.draw(this.bombs);

    // Power-ups
    this.powerUpRenderer.draw(this.powerUps, this.powers);

    // Cave — hide container entirely when not on level 5 so stale gfx never shows
    this.cave.container.visible = (lv === 5);
    if (lv === 5) this.cave.draw(this.heli.x, this.heli.y);

    // Particles
    this.particles.draw();

    // Shield aura
    if (this.powers.shield > 0) {
      const g = this.heli.gfx;
      const pulse = 0.55 + 0.25 * Math.sin(Date.now() * 0.012);
      g.circle(this.heli.x, this.heli.y, 40 * this.heli.model.scale)
       .stroke({ width: 2, color: 0x66ddff, alpha: pulse });
    }

    // Heli
    this.heli.draw();

    // Storm overlay
    if (lv === 7) this.storm.draw();

    // Fanfare / out-of-bombs overlays handled via uiContainer text
    this._drawOverlays();
  }

  private _drawObstacles(): void {
    if (this.currentLevel !== 2 || this.obstacles.length === 0) return;
    // Use particles gfx as a spare graphics context isn't ideal;
    // we use the heli gfx (it's cleared every frame) or a dedicated one
    // For simplicity, draw obstacles into the background gfx reuse
    // (They're drawn into buildingRenderer container via its gfx, which is cleared)
    const g = this.buildingRenderer.container.children[0] as PIXI.Graphics;
    for (const ob of this.obstacles) {
      const gapBot = ob.gapTop + OBS_GAP;
      // Warning glow
      g.rect(ob.x - 28, 0, 28, ob.gapTop).fill({ color: 0xff4400, alpha: 0.18 });
      g.rect(ob.x - 28, gapBot, 28, GROUND_Y - gapBot).fill({ color: 0xff4400, alpha: 0.18 });
      // Barrier fill
      g.rect(ob.x, 0, OBS_W, ob.gapTop).fill(0x1a0000).stroke({ width: 2, color: 0xff4400 });
      g.rect(ob.x, gapBot, OBS_W, GROUND_Y - gapBot).fill(0x1a0000).stroke({ width: 2, color: 0xff4400 });
    }
  }

  private _drawOverlays(): void {
    if (this.fanfareFlash > 0) {
      const alpha = (this.fanfareFlash / 18) * 0.45;
      const g = this.heli.gfx;
      g.rect(0, 0, W, H).fill({ color: 0xaaffcc, alpha });
    }
    // Cave crash overlay handled by CaveSystem itself
    // Sea/mine crash overlays: show via overlayText
  }

  // ── Level flow ────────────────────────────────────────────────────────────────

  private _startLevel(): void {
    this.finishLineX = W + LEVEL_DIST;
    this.levelDone = false;
    this.levelStartScore = this.score;
    this.comboCount = 0; this.comboTimer = 0;
    this.outOfBombsFlash = 0; this.outOfBombsTriggered = false;

    // Always reset ALL entity arrays so nothing bleeds across level boundaries
    this.bombs = [];
    this.obstacles = [];
    this.missiles = [];
    this.fwdMissiles = [];
    this.stormMissiles = [];
    this.balloons = []; this.birds = [];
    this.enemyHelis = []; this.enemyMissiles = [];
    this.mines = [];
    this.ships = []; this.seaMissiles = [];
    this.powerUps = [];

    this.stormMissileTimer = 100;
    this.seaMissileTimer = 140;

    this.bombsLeft = BOMBS_PER_LEVEL[this.currentLevel] ?? 0;
    this.hud.setBombs(this.bombsLeft, this.currentLevel);
    this.hud.setDist(LEVEL_DIST);

    // Level-specific init
    const lv = this.currentLevel;
    if (lv === 4) { const s = seedBalloons(); this.balloons = s.balloons; this.birds = s.birds; }
    if (lv === 5) { this.cave.init(); }
    if (lv === 6) { this.enemyHelis = seedEnemyHelis(); }
    if (lv === 7) { this.storm.init(); }
    if (lv === 8) { this.mines = seedMines(); }
    if (lv === 9) { this.ships = seedShips(); }

    // Buildings for non-sea levels
    if (lv !== 9) this.buildings = seedBuildings();
    else this.buildings = [];

    resetLaunchers(this.launchers);
  }

  private async _showTransition(level: number, isNext: boolean): Promise<void> {
    this.gameRunning = false;
    const earned = isNext ? this.score - this.levelStartScore : 0;
    this.audio.levelStart(level);
    await this.transition.show(level, isNext, earned);
    this._startLevel();
    this.gameRunning = true;
  }

  private _completeLevelOrEnd(): void {
    if (this.currentLevel === TOTAL_LEVELS) {
      this._endGame();
    } else {
      // Cave bonus on completing level 5 without crashing
      if (this.currentLevel === 5 && !this.cave.crashed) {
        this.score += 5000;
        this.hud.setScore(this.score);
        this.audio.caveBonus();
      }
      this._advanceLevel();
    }
  }

  private _advanceLevel(): void {
    this.currentLevel++;
    this.hud.setLevel(this.currentLevel);
    this._showTransition(this.currentLevel, true).catch(() => undefined);
  }

  private _endGame(): void {
    this.gameRunning = false;
    this.hud.hide();
    this.audio.gameOver();
    this.onGameOver(this.score);
  }

  // ── Score helpers ─────────────────────────────────────────────────────────────

  private _addScore(delta: number): void {
    this.score = Math.max(0, this.score + delta);
    this.hud.setScore(this.score);
  }

  private _comboMult(): number {
    const c = this.comboCount;
    return c <= 1 ? 1 : c <= 3 ? 2 : c <= 6 ? 3 : 4;
  }

  private _calcComboScore(base: number): number {
    this.comboCount++; this.comboTimer = COMBO_WINDOW;
    const mult = this._comboMult();
    const doub = this.powers.score2x > 0 ? 2 : 1;
    return base * mult * doub;
  }
}

