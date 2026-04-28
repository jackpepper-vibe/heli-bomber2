export interface Intent {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  fire: boolean; // space — dropped this frame
}

export class InputSystem {
  private readonly _keys: Set<string> = new Set();
  private _firePressed = false;
  private _fireConsumed = false;

  constructor() {
    document.addEventListener('keydown', (e) => {
      if (this._keys.has(e.code)) return;
      this._keys.add(e.code);
      if (e.code === 'Space') {
        e.preventDefault();
        this._firePressed = true;
      }
    });

    document.addEventListener('keyup', (e) => {
      this._keys.delete(e.code);
    });
  }

  get intent(): Intent {
    const fire = this._firePressed && !this._fireConsumed;
    return {
      up:    this._keys.has('ArrowUp')    || this._keys.has('KeyW'),
      down:  this._keys.has('ArrowDown')  || this._keys.has('KeyS'),
      left:  this._keys.has('ArrowLeft')  || this._keys.has('KeyA'),
      right: this._keys.has('ArrowRight') || this._keys.has('KeyD'),
      fire,
    };
  }

  /** Call immediately after handling the fire intent to clear it */
  consumeFire(): void {
    this._firePressed = false;
    this._fireConsumed = false;
  }

  /** Call at start of each frame — only resets the consumed guard */
  tick(): void {
    this._fireConsumed = false;
  }

  /** Bind touch controls — call once after DOM is ready */
  bindTouch(): void {
    const dir = (id: string, code: string) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('touchstart', (e) => { e.preventDefault(); this._keys.add(code); }, { passive: false });
      const up = (e: Event) => { e.preventDefault(); this._keys.delete(code); };
      el.addEventListener('touchend', up, { passive: false });
      el.addEventListener('touchcancel', () => this._keys.delete(code));
    };
    dir('dp-up',    'ArrowUp');
    dir('dp-down',  'ArrowDown');
    dir('dp-left',  'ArrowLeft');
    dir('dp-right', 'ArrowRight');

    const fireBtn = document.getElementById('fire-btn');
    if (fireBtn) {
      fireBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this._firePressed = true;
      }, { passive: false });
      fireBtn.addEventListener('touchend', (e) => e.preventDefault(), { passive: false });
    }
  }

  clearAll(): void {
    this._keys.clear();
    this._firePressed = false;
    this._fireConsumed = false;
  }
}
