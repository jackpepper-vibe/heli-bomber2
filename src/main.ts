import * as PIXI from 'pixi.js';
import { W, H } from './utils/constants';
import { AudioSystem } from './core/AudioSystem';
import { InputSystem } from './core/InputSystem';
import { LeaderboardService } from './core/LeaderboardService';
import { HUD } from './ui/HUD';
import { LevelTransition } from './ui/LevelTransition';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';

async function main(): Promise<void> {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

  const app = new PIXI.Application();
  await app.init({
    canvas,
    width: W,
    height: H,
    antialias: true,
    backgroundColor: 0x000a00,
    resolution: 1,
  });

  const audio       = new AudioSystem();
  const input       = new InputSystem();
  const leaderboard = new LeaderboardService();
  const hud         = new HUD();
  const transition  = new LevelTransition();

  input.bindTouch();

  const menu = new MenuScene(leaderboard);
  await menu.init();

  let game: GameScene | null = null;

  const returnToMenu = async (score: number) => {
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
    app.stage.removeChild(menu.container);
    menu.hide();

    game = new GameScene(audio, input, hud, transition, menu.selectedModelId);
    game.setOnGameOver(returnToMenu);
    app.stage.addChild(game.container);

    hud.show();
    game.start(menu.playerName);
  });

  app.stage.addChild(menu.container);
  menu.showSplash();

  app.ticker.add((ticker) => {
    const dt = ticker.deltaTime;
    menu.update(dt);
    if (game) {
      game.update(dt);
      game.draw();
    }
  });
}

main().catch(console.error);
