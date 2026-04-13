// Global leaderboard — stores top 10 scores in Upstash Redis
// Env vars required: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN

const REDIS_URL   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const SCORE_KEY   = 'heli-bomber-scores';

async function redisGet(key) {
  const r = await fetch(`${REDIS_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
  const data = await r.json();
  return data.result;
}

async function redisSet(key, value) {
  await fetch(REDIS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(['SET', key, JSON.stringify(value)]),
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  if (!REDIS_URL || !REDIS_TOKEN) {
    return res.status(503).json({ error: 'Leaderboard not configured' });
  }

  if (req.method === 'GET') {
    const raw = await redisGet(SCORE_KEY);
    return res.json(raw ? JSON.parse(raw) : []);
  }

  if (req.method === 'POST') {
    const { name, score } = req.body || {};
    if (!name || typeof score !== 'number' || isNaN(score)) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    const raw = await redisGet(SCORE_KEY);
    const scores = raw ? JSON.parse(raw) : [];
    scores.push({
      name:  String(name).toUpperCase().trim().slice(0, 12),
      score: Math.max(0, Math.floor(score)),
    });
    scores.sort((a, b) => b.score - a.score);
    const top10 = scores.slice(0, 10);

    await redisSet(SCORE_KEY, top10);
    return res.json(top10);
  }

  res.status(405).json({ error: 'Method not allowed' });
};
