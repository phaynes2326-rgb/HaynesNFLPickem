---
name: pickem-weekly-update
description: Add the next NFL week to the Haynes NFL Pick'em site, with full verification checks and pick-sheet game ordering. Use when adding a week's schedule to the pick'em site.
---

# Weekly pick'em schedule update

This repo is the Haynes NFL Pick'em site, deployed to haynes-nfl-pickem.vercel.app via
Vercel (auto-deploys from `main`).

## Stop if the week is already there

Read the `WEEKS` object in `index.html` first. If the week you would add already exists,
**stop and change nothing** — report that it is already present and exit. Never add a
second entry for a week, and never rewrite an existing one to "refresh" it.

## Never renumber a week that is already open

Picks and results are stored keyed by game id — `picks[g.id]`, `results[g.id]`. Reordering
a week's `games` array renumbers `g1..gN`, which silently reattaches every already-submitted
pick to a different game. There is no error and no visible symptom; the standings just go
wrong.

Adding a **new** week is always safe. Reordering an **existing** week is only safe before
that week's `opensAt` has passed. Past that point, leave it alone and say so — wrong game
order is cosmetic, scrambled picks are not.

## 1. Find the next week

In `index.html` there is a `WEEKS` object near the top of the `<script>` tag. Find the
highest week number present; the next one is what you're adding. Week 18 is the last.

## 2. Get the order and opensAt from the committed reference

`nfl-2026-game-order.md` in the repo root is the canonical source for game order and
`opensAt`, transcribed from the printed pick sheets. Use that week's table exactly: same
sequence, same `time:` strings, same `opensAt`.

Do not substitute NFL.com's listing order — it is close to the pick sheet but not identical.

## 3. Confirm against a live source

Check that week's matchups and kickoff times against a live schedule source (NFL.com, CBS
Sports). The reference was transcribed before the season, so:

- Entries marked `TBD` are flex slots — get the real time from the live source
- Late-season times move; trust the live source on times, the reference on order
- If a matchup itself disagrees, stop and flag it rather than guessing

## 4. Write the entry

Match the existing entries exactly — same field names, same formatting, ids from `g1`:

```js
"N": { label: "Week N", opensAt: "YYYY-MM-DDT10:00:00-04:00", games: [
  {id:"g1", away:"Team Name", home:"Team Name", time:"Day Mon D, H:MM AM/PM ET"}, ...
] }
```

Full team names ("Kansas City Chiefs", not "Chiefs"). The `opensAt` offset is `-04:00` (EDT)
through Week 8 and `-05:00` (EST) from Week 9 on; the reference file already has the correct
value per week.

## 5. Verify before committing

- Extract the `<script>` block and run `node --check` on it — must still parse
- Correct game count for the week (byes reduce it; the reference lists them)
- Every non-bye team appears exactly once
- Game ids sequential `g1`..`gN`
- Order matches the reference file's table for that week
- Exactly one new week was added, and no existing week changed
- `git diff` shows additions only, nothing else in the file touched

Parse the `WEEKS` object back out of the file and assert on it rather than eyeballing the
diff — a transposed pair inside one time slot is invisible by eye.

## 6. Commit and push

Commit as `Add Week N schedule` and open a PR. Paul merges it; Vercel deploys from `main`.

## Emails: drafts only, never send

The five weekly reminder emails (Ace, Dad, Lena, Mom, Tonio) go out only after Paul reviews
them. If Gmail is available, create **drafts** with `create_draft`. Never call
`send_message`. One draft per person, each containing only that person's own `?user=` link —
never combine recipients or expose one person's link to another. Never include PINs.
