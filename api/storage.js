import { Redis } from '@upstash/redis';

// Works with either the Vercel-injected names (KV_REST_API_URL / KV_REST_API_TOKEN)
// or the raw Upstash names (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN).
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
  automaticDeserialization: false, // keep values as plain strings
});

// Keep this in sync with the FAMILY array in index.html.
const FAMILY = ["Ace", "Cisco", "Dad", "Lena", "Mom", "Tonio"];

function getPins() {
  try {
    return JSON.parse(process.env.PICK_PINS || '{}');
  } catch (e) {
    return {};
  }
}

// picks:week{n}:{name} -> {name}
function nameFromPicksKey(key) {
  const parts = key.split(':');
  if (parts.length !== 3 || parts[0] !== 'picks') return null;
  return parts[2];
}

function isProtectedKey(key) {
  return typeof key === 'string' && key.startsWith('picks:');
}

// picks:week{n}:{name} -> {n}
function weekFromPicksKey(key) {
  const parts = key.split(':');
  if (parts.length !== 3 || parts[0] !== 'picks') return null;
  const wk = parts[1];
  return wk.startsWith('week') ? wk.slice(4) : null;
}

function pinIsValid(key, suppliedPin) {
  const name = nameFromPicksKey(key);
  if (!name) return false;
  const expected = getPins()[name];
  return !!expected && String(suppliedPin || '') === String(expected);
}

function commissionerPinValid(suppliedPin) {
  const expected = process.env.COMMISSIONER_PIN;
  return !!expected && String(suppliedPin || '') === String(expected);
}

// Server-side only: reads a person's raw picks directly, without a PIN.
// Only ever called internally to compute a score, never returned to a client.
async function computeCorrectCount(name, week, weekResults) {
  const raw = await redis.get(`picks:week${week}:${name}`);
  const picks = raw ? JSON.parse(raw) : {};
  let correct = 0;
  Object.keys(weekResults).forEach((gameId) => {
    if (picks[gameId] && picks[gameId] === weekResults[gameId]) correct += 1;
  });
  return correct;
}

export default async function handler(req, res) {
  try {
    if (!process.env.KV_REST_API_URL && !process.env.UPSTASH_REDIS_REST_URL) {
      return res.status(500).json({
        error:
          'No Redis database connected. Add the "Upstash for Redis" integration in the Vercel dashboard (Storage tab), then redeploy.',
      });
    }

    if (req.method === 'GET') {
      const { key, prefix, pin } = req.query;

      if (typeof prefix === 'string') {
        const keys = await redis.keys(`${prefix}*`);
        return res.status(200).json({ keys, prefix });
      }

      if (!key) return res.status(400).json({ error: 'key is required' });

      if (isProtectedKey(key) && !pinIsValid(key, pin)) {
        return res.status(401).json({ error: 'wrong or missing PIN' });
      }

      const value = await redis.get(key);
      if (value === null || value === undefined) {
        return res.status(404).json({ error: 'not found' });
      }
      return res.status(200).json({ key, value });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      // Lets the client verify a commissioner PIN before opening the results
      // panel, without doing anything else yet.
      if (body && body.action === 'verifyCommissionerPin') {
        if (!commissionerPinValid(body.pin)) {
          return res.status(401).json({ error: 'wrong PIN' });
        }
        return res.status(200).json({ ok: true });
      }

      // Commissioner sets a game result. Recomputes everyone's score for that
      // week server-side, so raw picks never have to be sent back to any client.
      if (body && body.action === 'setResult') {
        if (!commissionerPinValid(body.pin)) {
          return res.status(401).json({ error: 'wrong PIN' });
        }
        const { week, gameId, team } = body;
        if (!week || !gameId || !team) {
          return res.status(400).json({ error: 'week, gameId, team are required' });
        }
        const resultsKey = `results:week${week}`;
        const existingRaw = await redis.get(resultsKey);
        const weekResults = existingRaw ? JSON.parse(existingRaw) : {};
        weekResults[gameId] = team;
        await redis.set(resultsKey, JSON.stringify(weekResults));

        const scores = {};
        for (const name of FAMILY) {
          const correct = await computeCorrectCount(name, week, weekResults);
          scores[name] = correct;
          await redis.set(`score:week${week}:${name}`, String(correct));
        }

        return res.status(200).json({ results: weekResults, scores });
      }

      // Once someone has submitted their own picks for a week, they can see
      // everyone else's picks for that week — but only other people who have
      // also actually submitted (locked) theirs. Requires the requester's own
      // PIN, same as any other read of their picks.
      if (body && body.action === 'getWeekPicks') {
        const { week, name, pin } = body;
        if (!week || !name) {
          return res.status(400).json({ error: 'week and name are required' });
        }
        const requesterKey = `picks:week${week}:${name}`;
        if (!pinIsValid(requesterKey, pin)) {
          return res.status(401).json({ error: 'wrong or missing PIN' });
        }
        const requesterLocked = await redis.get(`locked:week${week}:${name}`);
        if (!requesterLocked) {
          return res.status(403).json({ error: 'submit your own picks first' });
        }

        const allPicks = {};
        for (const person of FAMILY) {
          const locked = await redis.get(`locked:week${week}:${person}`);
          if (locked) {
            const raw = await redis.get(`picks:week${week}:${person}`);
            allPicks[person] = raw ? JSON.parse(raw) : {};
          }
        }
        return res.status(200).json({ picks: allPicks });
      }

      const { key, value, pin, lock } = body || {};
      if (!key) return res.status(400).json({ error: 'key is required' });

      if (isProtectedKey(key)) {
        if (!pinIsValid(key, pin)) {
          return res.status(401).json({ error: 'wrong or missing PIN' });
        }
        const name = nameFromPicksKey(key);
        const week = weekFromPicksKey(key);
        const alreadyLocked = week && (await redis.get(`locked:week${week}:${name}`));
        if (alreadyLocked) {
          return res.status(403).json({ error: 'picks already submitted and locked' });
        }
      }

      await redis.set(key, value);

      if (isProtectedKey(key) && lock) {
        const name = nameFromPicksKey(key);
        const week = weekFromPicksKey(key);
        if (week) await redis.set(`locked:week${week}:${name}`, '1');
      }

      return res.status(200).json({ key, value, locked: !!lock });
    }

    if (req.method === 'DELETE') {
      const { key, pin } = req.query;
      if (!key) return res.status(400).json({ error: 'key is required' });

      if (isProtectedKey(key) && !pinIsValid(key, pin)) {
        return res.status(401).json({ error: 'wrong or missing PIN' });
      }

      await redis.del(key);
      return res.status(200).json({ key, deleted: true });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    console.error('storage api error:', err);
    return res.status(500).json({ error: 'storage error' });
  }
}
