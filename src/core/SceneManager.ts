import * as PIXI from 'pixi.js';

export interface Scene {
  container: PIXI.Container;
  init(): Promise<void>;
  update(dt: number): void;
  destroy(): void;
}

export class SceneManager {
  private current: Scene | null = null;
  private readonly stage: PIXI.Container;

  constructor(stage: PIXI.Container) {
    this.stage = stage;
  }

  async switchTo(scene: Scene): Promise<void> {
    if (this.current) {
      this.stage.removeChild(this.current.container);
      this.current.destroy();
    }
    this.current = scene;
    this.stage.addChild(scene.container);
    await scene.init();
  }

  update(dt: number): void {
    this.current?.update(dt);
  }
}
