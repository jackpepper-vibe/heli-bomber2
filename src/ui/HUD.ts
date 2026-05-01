import { BOMBS_PER_LEVEL } from '../utils/constants';

export class HUD {
  private readonly scoreEl: HTMLElement;
  private readonly levelEl: HTMLElement;
  private readonly nameEl: HTMLElement;
  private readonly timerEl: HTMLElement;
  private readonly bombsWrap: HTMLElement;
  private readonly bombsEl: HTMLElement;
  private readonly hudEl: HTMLElement;

  constructor() {
    this.hudEl     = document.getElementById('hud')!;
    this.scoreEl   = document.getElementById('hud-score')!;
    this.levelEl   = document.getElementById('hud-level-num')!;
    this.nameEl    = document.getElementById('hud-name')!;
    this.timerEl   = document.getElementById('hud-timer')!;
    this.bombsWrap = document.getElementById('hud-bombs-wrap')!;
    this.bombsEl   = document.getElementById('hud-bombs')!;
  }

  show(): void { this.hudEl.classList.add('visible'); }
  hide(): void { this.hudEl.classList.remove('visible'); }

  setName(name: string): void { this.nameEl.textContent = name; }
  setLevel(level: number): void { this.levelEl.textContent = String(level); }
  setScore(score: number): void { this.scoreEl.textContent = score.toLocaleString(); }
  setDist(dist: number): void    { this.timerEl.textContent = `${Math.max(0, dist)}m`; }
  setTimer(secs: number): void   { this.timerEl.textContent = `${Math.max(0, secs)}s`; }

  setBombs(bombsLeft: number, level: number): void {
    const limit = BOMBS_PER_LEVEL[level] ?? 0;
    if (limit === 0) {
      this.bombsWrap.style.display = 'none';
      return;
    }
    this.bombsWrap.style.display = '';
    this.bombsEl.textContent = String(bombsLeft);
    this.bombsWrap.classList.toggle('warn',  bombsLeft > 0 && bombsLeft <= 3);
    this.bombsWrap.classList.toggle('empty', bombsLeft === 0);
  }
}
