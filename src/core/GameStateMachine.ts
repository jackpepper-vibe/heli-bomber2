export const enum AppState {
  Loading  = 'loading',
  Menu     = 'menu',
  Playing  = 'playing',
  Paused   = 'paused',
  GameOver = 'game-over',
}

export class GameStateMachine {
  private _state: AppState = AppState.Loading;

  get state(): AppState  { return this._state; }
  is(s: AppState): boolean { return this._state === s; }
  to(s: AppState): void  { this._state = s; }

  get inMenu():    boolean { return this._state === AppState.Menu; }
  get inGame():    boolean { return this._state === AppState.Playing; }
  get isGameOver(): boolean { return this._state === AppState.GameOver; }
}

// ── Scene-level phase enum (used inside GameScene) ────────────────────────────

export const enum SceneState {
  Idle       = 'idle',
  Active     = 'active',
  LevelDone  = 'level-done',
  Transition = 'transition',
  Over       = 'over',
}
