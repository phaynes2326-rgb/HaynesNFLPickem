# Family NFL Pick'em

Same app as before, but built to run as a real website instead of a Claude
artifact. The one thing that had to change: Claude's `window.storage` API
only exists inside Claude.ai, so picks and results are now saved through
`/api/storage.js`, a small serverless function backed by a Redis database.

## Deploy it

1. **Push this folder to a GitHub repo**, then import that repo into Vercel
   (vercel.com → New Project → select the repo).

2. **Add a database.** In your new Vercel project, go to the **Storage**
   tab → **Marketplace** → install **"Upstash for Redis"** (this is the
   current path — Vercel's old built-in "KV" product was retired and folded
   into this Upstash integration). Create a database and connect it to the
   project. Vercel will automatically inject the connection details as
   environment variables (`KV_REST_API_URL` / `KV_REST_API_TOKEN`, or
   `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — `api/storage.js`
   checks for either name).

3. **Redeploy** the project (Vercel usually does this automatically once the
   integration is connected; if not, trigger a redeploy from the dashboard
   so the function picks up the new environment variables).

4. Visit your `*.vercel.app` URL — the app works the same as before.

## Giving everyone their own link

Open the "Get personal links for everyone" toggle under "Who's picking?" —
it lists a direct link per family member (`yoursite.vercel.app?user=Name`)
with a one-tap copy button. Send each person their own link and it'll open
straight to their picks, no need to find their name in the list first.

## Local development

```
npm install
vercel dev
```

`vercel dev` needs the same environment variables locally — run
`vercel env pull` after linking the project to pull them into a `.env.local`
file.

## Notes

- All picks/results live in one shared Redis database — there's no login,
  so anyone with a link to the site can technically see or change anyone
  else's picks. Fine for a family group; don't reuse this for anything that
  needs real access control.
- The season schedule lives in the `WEEKS` object near the top of the
  `<script>` in `index.html` — add a new week's games there each week.
- The "Download season backup (.csv)" button on the Standings tab still
  works exactly as before, pulling from the live database.
