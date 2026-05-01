import gsap from 'gsap';
import { LEVEL_HINTS } from '../utils/constants';

export class LevelTransition {
  private readonly el:      HTMLElement;
  private readonly numEl:   HTMLElement;
  private readonly labelEl: HTMLElement;
  private readonly subEl:   HTMLElement;

  constructor() {
    this.el      = document.getElementById('level-transition')!;
    this.numEl   = document.getElementById('lt-num')!;
    this.labelEl = document.getElementById('lt-label')!;
    this.subEl   = document.getElementById('lt-sub')!;

    // Start hidden
    gsap.set(this.el, { autoAlpha: 0, y: -30 });
  }

  show(level: number, isNext: boolean, levelEarned = 0): Promise<void> {
    this.numEl.textContent   = String(level);
    this.labelEl.textContent = 'LEVEL';

    const hint      = LEVEL_HINTS[level] ?? 'GET READY';
    const earnedStr = isNext && levelEarned > 0 ? `  [ +${levelEarned.toLocaleString()} PTS ]` : '';
    this.subEl.textContent   = isNext
      ? hint + earnedStr
      : 'MISSION START — GO GO GO';

    return new Promise<void>(resolve => {
      gsap.timeline({ onComplete: resolve })
        .set(this.el, { display: 'flex' })
        .fromTo(this.el,
          { autoAlpha: 0, y: -30 },
          { autoAlpha: 1, y: 0,  duration: 0.38, ease: 'power2.out' })
        .to(this.el,
          { autoAlpha: 0, y: 22, duration: 0.42, ease: 'power2.in', delay: 1.3 })
        .set(this.el, { display: 'none' });
    });
  }

  hide(): void {
    gsap.killTweensOf(this.el);
    gsap.set(this.el, { autoAlpha: 0, display: 'none' });
  }
}
