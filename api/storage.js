import { Redis } from '@upstash/redis';

// Works with either the Vercel-injected names (KV_REST_API_URL / KV_REST_API_TOKEN)
// or the raw Upstash names (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN),
// depending on how the integration named your env vars.
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
  automaticDeserialization: false, // keep values as plain strings, same as before
});

export default async function handler(req, res) {
  try {
    if (!redis.opts?.url && !process.env.KV_REST_API_URL && !process.env.UPSTASH_REDIS_REST_URL) {
      return res.status(500).json({
        error: 'No Redis database connected. Add the "Upstash for Redis" integration to this project in the Vercel dashboard (Storage tab), then redeploy.',
      });
    }

    if (req.method === 'GET') {
      const { key, prefix } = req.query;

      if (typeof prefix === 'string') {
        const keys = await redis.keys(`${prefix}*`);
        return res.status(200).json({ keys, prefix });
      }

      if (!key) return res.status(400).json({ error: 'key is required' });
      const value = await redis.get(key);
      if (value === null || value === undefined) {
        return res.status(404).json({ error: 'not found' });
      }
      return res.status(200).json({ key, value });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { key, value } = body || {};
      if (!key) return res.status(400).json({ error: 'key is required' });
      await redis.set(key, value);
      return res.status(200).json({ key, value });
    }

    if (req.method === 'DELETE') {
      const { key } = req.query;
      if (!key) return res.status(400).json({ error: 'key is required' });
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
