const LS_KEY = 'heliBomberScores';

export interface ScoreEntry {
  name: string;
  score: number;
}

export class LeaderboardService {
  private cache: ScoreEntry[] = [];

  async init(): Promise<void> {
    try {
      const r = await fetch('/api/scores');
      if (r.ok) { this.cache = await r.json() as ScoreEntry[]; return; }
    } catch {
      // fall through to localStorage
    }
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) this.cache = JSON.parse(raw) as ScoreEntry[];
    } catch {
      // ignore
    }
  }

  getScores(): ScoreEntry[] {
    return this.cache.slice();
  }

  async saveScore(name: string, pts: number): Promise<ScoreEntry[]> {
    const entry: ScoreEntry = {
      name: (name.toUpperCase().trim() || 'ACE').slice(0, 12),
      score: Math.floor(pts),
    };
    try {
      const r = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
      if (r.ok) {
        this.cache = await r.json() as ScoreEntry[];
        localStorage.setItem(LS_KEY, JSON.stringify(this.cache));
        return this.cache;
      }
    } catch {
      // fall through
    }
    const list = [...this.cache, entry].sort((a, b) => b.score - a.score).slice(0, 10);
    this.cache = list;
    localStorage.setItem(LS_KEY, JSON.stringify(list));
    return list;
  }
}
