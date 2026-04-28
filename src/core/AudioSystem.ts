interface ToneParams {
  freq?: number;
  type?: OscillatorType;
  gain?: number;
  dur?: number;
  freqEnd?: number | null;
  attack?: number;
  decay?: number;
  detune?: number;
  distortion?: boolean;
}

interface NoiseParams {
  gain?: number;
  dur?: number;
  filterFreq?: number;
  attack?: number;
}

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private unlocked = false;

  constructor() {
    const events: string[] = ['touchstart', 'touchend', 'mousedown', 'click', 'keydown'];
    const unlock = () => this._unlock();
    for (const ev of events) {
      document.addEventListener(ev, unlock, { passive: true, capture: true });
    }
  }

  private _unlock(): void {
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
      }
      if (this.ctx.state !== 'running') {
        this.ctx.resume().catch(() => undefined);
      }
      if (!this.unlocked) {
        const buf = this.ctx.createBuffer(1, 1, 22050);
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.connect(this.ctx.destination);
        src.start(0);
        this.unlocked = true;
      }
    } catch {
      // ignore
    }
  }

  private get ac(): AudioContext | null {
    if (this.ctx && this.ctx.state === 'running') return this.ctx;
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => undefined);
    }
    return this.ctx;
  }

  playTone({
    freq = 440, type = 'sine' as OscillatorType, gain = 0.4, dur = 0.3,
    freqEnd = null, attack = 0.01, decay = 0.05, detune = 0, distortion = false,
  }: ToneParams = {}): void {
    try {
      const ac = this.ac;
      if (!ac) return;
      const now = ac.currentTime;

      const osc = ac.createOscillator();
      const env = ac.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(freqEnd, now + dur);
      if (detune) osc.detune.setValueAtTime(detune, now);

      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(gain, now + attack);
      env.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay + dur);

      if (distortion) {
        const dist = ac.createWaveShaper();
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
          const x = (i * 2) / 256 - 1;
          curve[i] = (Math.PI + 200) * x / (Math.PI + 200 * Math.abs(x));
        }
        dist.curve = curve;
        osc.connect(dist);
        dist.connect(env);
      } else {
        osc.connect(env);
      }

      env.connect(ac.destination);
      osc.start(now);
      osc.stop(now + attack + decay + dur + 0.05);
    } catch {
      // ignore
    }
  }

  playNoise({ gain = 0.3, dur = 0.2, filterFreq = 800, attack = 0.005 }: NoiseParams = {}): void {
    try {
      const ac = this.ac;
      if (!ac) return;
      const now = ac.currentTime;
      const buf = ac.createBuffer(1, ac.sampleRate * (dur + 0.1), ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

      const src = ac.createBufferSource();
      src.buffer = buf;

      const filt = ac.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.value = filterFreq;
      filt.Q.value = 1.2;

      const env = ac.createGain();
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(gain, now + attack);
      env.gain.exponentialRampToValueAtTime(0.0001, now + attack + dur);

      src.connect(filt);
      filt.connect(env);
      env.connect(ac.destination);
      src.start(now);
    } catch {
      // ignore
    }
  }

  bombDrop(): void {
    this.playTone({ freq: 900, freqEnd: 280, type: 'sine', gain: 0.25, dur: 0.18, attack: 0.005, decay: 0.01 });
  }

  bombHit(): void {
    this.playNoise({ gain: 0.55, dur: 0.22, filterFreq: 320, attack: 0.003 });
    this.playTone({ freq: 120, freqEnd: 40, type: 'triangle', gain: 0.5, dur: 0.25, attack: 0.003, decay: 0.02 });
  }

  heliHit(): void {
    this.playNoise({ gain: 0.7, dur: 0.35, filterFreq: 1800, attack: 0.002 });
    this.playTone({ freq: 220, freqEnd: 80, type: 'sawtooth', gain: 0.45, dur: 0.3, attack: 0.002, decay: 0.02, distortion: true });
  }

  missileLaunch(): void {
    this.playNoise({ gain: 0.35, dur: 0.28, filterFreq: 2400, attack: 0.01 });
    this.playTone({ freq: 180, freqEnd: 520, type: 'sawtooth', gain: 0.2, dur: 0.28, attack: 0.01, decay: 0.01 });
  }

  powerUp(): void {
    this.playTone({ freq: 520, freqEnd: 880, type: 'triangle', gain: 0.35, dur: 0.14, attack: 0.003, decay: 0.02 });
    setTimeout(() => this.playTone({ freq: 880, freqEnd: 1320, type: 'triangle', gain: 0.3, dur: 0.18, attack: 0.003, decay: 0.02 }), 90);
  }

  crash(): void {
    this.playNoise({ gain: 1.0, dur: 0.8, filterFreq: 180, attack: 0.001 });
    this.playNoise({ gain: 0.75, dur: 0.5, filterFreq: 900, attack: 0.002 });
    this.playTone({ freq: 240, freqEnd: 18, type: 'sawtooth', gain: 0.85, dur: 0.9, attack: 0.001, decay: 0.05, distortion: true });
    this.playTone({ freq: 880, freqEnd: 110, type: 'square', gain: 0.5, dur: 0.55, attack: 0.002, decay: 0.03, distortion: true });
    this.playTone({ freq: 55, freqEnd: 20, type: 'sine', gain: 0.9, dur: 1.1, attack: 0.002, decay: 0.08 });
  }

  gameOver(): void {
    const notes = [
      { f: 440, t: 0 }, { f: 370, t: 320 }, { f: 311, t: 620 },
      { f: 277, t: 900 }, { f: 220, t: 1220 }, { f: 185, t: 1600 },
    ];
    for (const n of notes) {
      setTimeout(() => {
        this.playTone({ freq: n.f, freqEnd: n.f * 0.92, type: 'square', gain: 0.28, dur: 0.38, attack: 0.01, decay: 0.05 });
        this.playTone({ freq: n.f * 0.5, type: 'sine', gain: 0.18, dur: 0.42, attack: 0.02, decay: 0.06 });
      }, n.t);
    }
  }

  caveBonus(): void {
    const fanfare = [
      { f: 330, t: 0, dur: 0.12 }, { f: 330, t: 130, dur: 0.12 }, { f: 330, t: 260, dur: 0.12 },
      { f: 262, t: 390, dur: 0.18 }, { f: 440, t: 520, dur: 0.28 }, { f: 392, t: 820, dur: 0.12 },
      { f: 440, t: 960, dur: 0.12 }, { f: 523, t: 1100, dur: 0.12 }, { f: 659, t: 1280, dur: 0.55 },
    ];
    for (const n of fanfare) {
      setTimeout(() => {
        this.playTone({ freq: n.f, type: 'square', gain: 0.30, dur: n.dur, attack: 0.008, decay: 0.06 });
        this.playTone({ freq: n.f * 0.5, type: 'sine', gain: 0.20, dur: n.dur + 0.05, attack: 0.01, decay: 0.08 });
      }, n.t);
    }
    setTimeout(() => {
      this.playTone({ freq: 880, type: 'sine', gain: 0.18, dur: 0.7, attack: 0.08, decay: 0.3, freqEnd: 1100 });
      this.playNoise({ gain: 0.12, dur: 0.5, filterFreq: 3500, attack: 0.06 });
    }, 1850);
  }

  levelStart(level: number): void {
    const base = 220 * Math.pow(1.12, level - 1);
    const notes = [base, base * 1.25, base * 1.5, base * 2];
    notes.forEach((f, i) => {
      setTimeout(() => {
        this.playTone({ freq: f, type: 'square', gain: 0.22, dur: 0.12, attack: 0.01, decay: 0.08 });
      }, i * 110);
    });
  }
}
