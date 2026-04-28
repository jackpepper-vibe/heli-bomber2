import { LEVEL_HINTS } from '../utils/constants';

export class LevelTransition {
  private readonly el: HTMLElement;
  private readonly numEl: HTMLElement;
  private readonly labelEl: HTMLElement;
  private readonly subEl: HTMLElement;

  constructor() {
    this.el      = document.getElementById('level-transition')!;
    this.numEl   = document.getElementById('lt-num')!;
    this.labelEl = document.getElementById('lt-label')!;
    this.subEl   = document.getElementById('lt-sub')!;
  }

  show(level: number, isNext: boolean, levelEarned = 0): Promise<void> {
    this.numEl.textContent   = String(level);
    this.labelEl.textContent = 'LEVEL';

    const hint      = LEVEL_HINTS[level] ?? 'GET READY';
    const earnedStr = isNext && levelEarned > 0 ? `  [ +${levelEarned.toLocaleString()} PTS ]` : '';
    this.subEl.textContent = isNext
      ? hint + earnedStr
      : 'MISSION START — GO GO GO';

    this.el.classList.add('show');

    return new Promise<void>(resolve => {
      setTimeout(() => {
        this.el.classList.remove('show');
        resolve();
      }, 2200);
    });
  }

  hide(): void {
    this.el.classList.remove('show');
  }
}
