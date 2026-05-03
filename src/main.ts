import * as PIXI from 'pixi.js';
import { W, H, COL_SKY_DEEP } from './utils/constants';
import { AudioSystem } from './core/AudioSystem';
import { InputSystem } from './core/InputSystem';
import { LeaderboardService } from './core/LeaderboardService';
import { GameStateMachine, AppState } from './core/GameStateMachine';
import { HUD } from './ui/HUD';
import { LevelTransition } from './ui/LevelTransition';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { loadTexture, loadTransparentTexture, sliceTexture } from './utils/textureUtils';

function createVignetteTexture(): PIXI.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.78);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.60)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);
  return PIXI.Texture.from(canvas);
}

async function main(): Promise<void> {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

  const app = new PIXI.Application();
  await app.init({
    canvas,
    width:           W,
    height:          H,
    antialias:       true,
    backgroundColor: COL_SKY_DEEP,
    resolution:      1,
  });

  const fsm        = new GameStateMachine();
  const audio      = new AudioSystem();
  const input      = new InputSystem();
  const leaderboard = new LeaderboardService();
  const hud        = new HUD();
  const transition = new LevelTransition();

  input.bindTouch();

  const menu = new MenuScene(leaderboard);
  await menu.init();

  // Load four separate background layers and the helicopter sprite sheet
  const [skyTex, mountainsTex, forestTex, groundTex, heliTex] = await Promise.all([
    loadTexture('backgrounds/sky.png').catch(() => null),
    loadTexture('backgrounds/mountains.png').catch(() => null),
    loadTexture('backgrounds/forest.png').catch(() => null),
    loadTexture('backgrounds/ground.png').catch(() => null),
    loadTransparentTexture('sprites/sprite-sheet1.png').catch(() => null),
  ]);

  // Helicopter frame sub-textures: 3 frames across the top row of sprite-sheet1.png
  const heliFrames: PIXI.Texture[] = heliTex ? [
    sliceTexture(heliTex,   0, 0, 360, 310),
    sliceTexture(heliTex, 380, 0, 280, 310),
    sliceTexture(heliTex, 700, 0, 300, 310),
  ] : [];

  // Post-processing — subtle contrast + saturation boost on game world
  const colorFilter = new PIXI.ColorMatrixFilter();
  colorFilter.contrast(0.12, false);
  colorFilter.saturate(0.18, false);

  // Vignette overlay — always on top
  const vignetteSprite = new PIXI.Sprite(createVignetteTexture());
  vignetteSprite.width  = W;
  vignetteSprite.height = H;
  vignetteSprite.eventMode = 'none';

  let game: GameScene | null = null;

  const returnToMenu = async (score: number) => {
    fsm.to(AppState.Menu);
    if (game) {
      game.destroy();
      app.stage.removeChild(game.container);
      game = null;
    }
    hud.hide();
    await menu.refreshAfterGame(score);
    menu.showGameOver(score, menu.playerName);
    app.stage.addChild(menu.container);
  };

  menu.onLaunch(() => {
    fsm.to(AppState.Playing);
    app.stage.removeChild(menu.container);
    menu.hide();

    game = new GameScene(audio, input, hud, transition, menu.selectedModelId);
    game.setOnGameOver(returnToMenu);
    game.container.filters = [colorFilter];
    app.stage.addChild(game.container);

    if (skyTex && mountainsTex && forestTex && groundTex)
      game.initParallax(skyTex, mountainsTex, forestTex, groundTex);
    if (heliFrames.length) game.initHeliSprites(heliFrames);

    hud.show();
    game.start(menu.playerName);
  });

  app.stage.addChild(menu.container);
  // Vignette sits above everything
  app.stage.addChild(vignetteSprite);
  menu.showSplash();
  fsm.to(AppState.Menu);

  app.ticker.add((ticker) => {
    const dt = ticker.deltaTime;   // normalised: 1.0 = 60 fps
    menu.update(dt);
    if (game) {
      game.update(dt);
      game.draw();
    }
    // Keep vignette on top after any dynamic addChild calls
    app.stage.setChildIndex(vignetteSprite, app.stage.children.length - 1);
  });
}

main().catch(console.error);
