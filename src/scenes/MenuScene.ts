import * as PIXI from 'pixi.js';
import { HELI_MODELS } from '../utils/constants';
import { LeaderboardService } from '../core/LeaderboardService';
import { Helicopter } from '../entities/Helicopter';

type SelectedModelId = 0 | 1 | 2;

export class MenuScene {
  readonly container: PIXI.Container;
  private readonly leaderboard: LeaderboardService;

  playerName = 'ACE';
  selectedModelId: SelectedModelId = 1;

  private readonly splashEl   = document.getElementById('splash')!;
  private readonly heliSelEl  = document.getElementById('heli-select')!;
  private readonly gameoverEl = document.getElementById('gameover')!;

  constructor(leaderboard: LeaderboardService) {
    this.container = new PIXI.Container();
    this.leaderboard = leaderboard;
  }

  async init(): Promise<void> {
    await this.leaderboard.init();
    this._renderSplashScores();
    this._buildHeliCards();
    this._wireButtons();
  }

  update(_dt: number): void { /* static menu */ }

  destroy(): void {
    this.hide();
  }

  showSplash(): void {
    this.splashEl.style.display  = 'flex';
    this.heliSelEl.style.display = 'none';
    this.gameoverEl.style.display = 'none';
    this._renderSplashScores();
    (document.getElementById('player-name') as HTMLInputElement).focus();
  }

  showHeliSelect(): void {
    this.splashEl.style.display   = 'none';
    this.heliSelEl.style.display  = 'flex';
    this.gameoverEl.style.display = 'none';
  }

  showGameOver(score: number, playerName: string): void {
    this.splashEl.style.display   = 'none';
    this.heliSelEl.style.display  = 'none';
    this.gameoverEl.style.display = 'flex';
    document.getElementById('go-score-val')!.textContent = score.toLocaleString();
    this._renderScores('go-scores-list', playerName);
  }

  hide(): void {
    this.splashEl.style.display   = 'none';
    this.heliSelEl.style.display  = 'none';
    this.gameoverEl.style.display = 'none';
  }

  private _renderSplashScores(): void {
    this._renderScores('splash-scores-list');
  }

  private _renderScores(elId: string, highlightName?: string): void {
    const el = document.getElementById(elId);
    if (!el) return;
    const list = this.leaderboard.getScores();
    if (!list.length) {
      el.innerHTML = '<div class="no-scores">-- NO RECORDS YET --</div>';
      return;
    }
    const hn = (highlightName ?? this.playerName).toUpperCase().trim() || 'ACE';
    const rows = list.map((s, i) => {
      const hi = s.name === hn ? ' hi' : '';
      return `<div class="score-row${hi}">
        <span class="rk">${String(i + 1).padStart(2, '0')}.</span>
        <span class="nm">${s.name}</span>
        <span class="pts">${s.score.toLocaleString()}</span>
      </div>`;
    });
    const left = rows.slice(0, 5).join('');
    const right = rows.slice(5, 10).join('');
    el.innerHTML = `<div class="scores-grid"><div>${left}</div><div>${right}</div></div>`;
  }

  private _buildHeliCards(): void {
    const container = document.getElementById('heli-cards')!;
    container.innerHTML = '';
    for (const model of HELI_MODELS) {
      const card = document.createElement('div');
      card.className = `heli-card${model.id === this.selectedModelId ? ' selected' : ''}`;
      card.dataset['id'] = String(model.id);

      const previewCanvas = document.createElement('canvas');
      previewCanvas.width = 180; previewCanvas.height = 80;
      Helicopter.drawPreview(previewCanvas, model);

      card.innerHTML = `
        <div class="heli-card-name">${model.name}</div>
        <div class="heli-card-stat">SPEED: ${model.speedMult >= 1.2 ? '★★★' : model.speedMult >= 1.0 ? '★★☆' : '★☆☆'}</div>
        <div class="heli-card-stat">ARMOUR: ${model.hitMult >= 1.3 ? '★★★' : model.hitMult >= 1.0 ? '★★☆' : '★☆☆'}</div>
        <div class="heli-card-stat">${model.desc}</div>
      `;
      card.prepend(previewCanvas);

      card.addEventListener('click', () => {
        this.selectedModelId = model.id as SelectedModelId;
        container.querySelectorAll('.heli-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      });

      container.appendChild(card);
    }
  }

  private _wireButtons(): void {
    const startBtn   = document.getElementById('start-btn')!;
    const nameInput  = document.getElementById('player-name') as HTMLInputElement;
    const launchBtn  = document.getElementById('launch-btn')!;
    const restartBtn = document.getElementById('restart-btn')!;

    startBtn.onclick = () => {
      const raw = nameInput.value.trim();
      this.playerName = (raw || 'ACE').toUpperCase().slice(0, 12);
      this.showHeliSelect();
    };

    nameInput.onkeydown = (e) => {
      if (e.key === 'Enter') startBtn.click();
    };

    launchBtn.onclick = () => {
      this._onLaunch();
    };

    restartBtn.onclick = () => {
      this.showSplash();
    };
  }

  private _onLaunch: () => void = () => { /* overridden externally */ };

  /** Called by main to wire in the "start game" callback. */
  onLaunch(cb: () => void): void {
    this._onLaunch = cb;
  }

  /** Refresh leaderboard with updated scores after a game. */
  async refreshAfterGame(score: number): Promise<void> {
    await this.leaderboard.saveScore(this.playerName, score);
    const scores = this.leaderboard.getScores();
    const rank = scores.findIndex(s => s.name === this.playerName && s.score === score);
    const rankEl = document.getElementById('go-rank-msg')!;
    if (rank === 0)     rankEl.textContent = '★  NEW HIGH SCORE!  ★';
    else if (rank >= 0) rankEl.textContent = `LEADERBOARD RANK:  #${rank + 1}`;
    else                rankEl.textContent = '';
    this._renderScores('go-scores-list', this.playerName);
  }
}
