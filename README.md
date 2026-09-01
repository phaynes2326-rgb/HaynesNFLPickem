# Family NFL Pick'em

Same app as before, built to run as a real website instead of a Claude
artifact. Each person's picks are private *while the week is still open*,
PIN-protected, and lock in permanently once submitted — after that,
everyone can see everyone's picks for that week.

## How storage works

- Picks and results are saved through `/api/storage.js`, a small serverless
  function backed by a Redis database (not Claude's artifact-only storage).
- **Picks are PIN-protected.** Each family member has a short PIN. The
  server checks it on every read/write of that person's picks — it's a real
  server-side check, not just something hidden in the page.
- **Picks lock in when submitted.** While someone still has games left to
  pick, they can save and change their picks freely. Once they've picked
  every game and confirm the "Submit Picks" prompt, the server marks their
  picks locked (`locked:week{n}:{name}`) and rejects any further changes to
  them — even a direct API call, not just the button in the UI.
- **Picks become visible after you submit yours.** Once a person has
  locked in their own picks for a week, the server will show them everyone
  else's picks for that same week — but only for people who have *also*
  locked theirs in; anyone still mid-week stays hidden until they submit
  too. This still requires that person's own PIN to prove it's really them
  asking.
- Standings and the CSV backup use the server-computed weekly **scores**
  (a count of correct picks), not the raw picks, so historical data stays
  compact either way.

## Deploy it

1. **Push this folder to a GitHub repo**, then import that repo into Vercel
   (vercel.com → New Project → select the repo).

2. **Add a database.** In your project, open **Storage** in the sidebar →
   **Create Database** / **Browse Marketplace** → install **"Upstash for
   Redis"**. Create a database and connect it to this project, for all
   three environments (Production, Preview, Development). Vercel injects
   `KV_REST_API_URL` / `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL` /
   `UPSTASH_REDIS_REST_TOKEN`) automatically — `api/storage.js` checks for
   either name.

3. **Set everyone's PINs.** In the project's **Settings → Environment
   Variables**, add a variable named `PICK_PINS` with a JSON value mapping
   each name to a short PIN, e.g.:

   ```
   {"Ace":"4821","Cisco":"1093","Dad":"5567","Lena":"2245","Mom":"8830","Tonio":"3391"}
   ```

   Pick your own numbers — these are just examples. Add this for
   Production (and Preview/Development if you use those). Tell each family
   member their own PIN separately from the link you send them (e.g. text
   it, don't put it in the link).

   Also add a second variable, `COMMISSIONER_PIN`, with a single PIN of your
   own choosing (e.g. `7412`). This gates the "enter final results" panel —
   only whoever knows this PIN can open it and record game outcomes.

4. **Redeploy** so the build picks up the new environment variables.

5. Visit your `*.vercel.app` URL.

## Giving everyone their own link

Each family member's link is `yoursite.vercel.app?user=Name` (e.g.
`?user=Dad`). Build each one yourself and send it to that person — there's
no in-app list of everyone's links. Send each person their link *and*,
separately, their PIN. The first time they open their link they'll be
asked for the PIN; after that it's remembered on their device (stored in
that browser only), so they won't need to re-enter it every visit.

If someone's PIN is ever compromised (e.g., a shared family device), just
change it in `PICK_PINS`, redeploy, and their old saved PIN on every device
stops working — they'll be asked to enter the new one next time.

## Local development

```
npm install
vercel dev
```

`vercel dev` needs the same environment variables locally, including
`PICK_PINS` — run `vercel env pull` after linking the project to pull them
into a `.env.local` file.

## Notes on privacy

- This is a lightweight PIN gate, not enterprise-grade authentication —
  PINs are short and stored in plaintext in an environment variable. It's
  a real, server-enforced barrier that stops family members from casually
  looking at (or editing) each other's picks before they've submitted, but
  don't reuse this pattern for anything more sensitive than a family
  pick'em pool.
- Game results (`results:week{n}`), progress counts, and lock status
  (`locked:week{n}:{name}`) are intentionally public — everyone needs to
  see final results and who's submitted. Only the *specific teams* someone
  picked stay gated, and only until that person submits.
- The season schedule lives in the `WEEKS` object near the top of the
  `<script>` in `index.html` — add a new week's games there each week and
  redeploy.
- The "enter final results" panel is locked behind `COMMISSIONER_PIN`,
  entered once per device the same way the personal pick PINs work.
