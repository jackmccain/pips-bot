# 🎲 Pips bot

A dead-simple group leaderboard bot for [NYT Pips](https://www.nytimes.com/games/pips). Friends
text their daily Pips results to your [Linq](https://docs.linqapp.com) number; the bot parses the
shared scores, keeps a leaderboard, and answers a few commands.

```
You → Pips #3 Easy 🟢
      0:32
      Pips #3 Medium 🟡
      0:40

Bot → Thanks Jack! Pips #3
      Logged Easy 🟢 0:32
      Logged Medium 🟡 0:40

      🏆 Pips #3 standings
      🟢 Easy
      1. Jack 0:32
      🟡 Medium
      1. Jack 0:40
```

## Commands

| Text this   | Bot does                          |
| ----------- | --------------------------------- |
| _(a result)_ | logs your score + shows standings |
| `BOARD`     | today's standings                 |
| `ME`        | your scores                       |
| `NAME Jack` | set your display name             |
| `HELP`      | list commands                     |

## Setup

1. **Install**
   ```bash
   npm install
   ```

2. **Configure** — copy `.env.example` to `.env` and fill it in. Check your number/auth:
   ```bash
   npm run numbers
   ```

3. **Run the server**
   ```bash
   npm start        # or: npm run dev  (auto-restart)
   ```

4. **Expose it publicly** so Linq can deliver webhooks. In another terminal:
   ```bash
   ngrok http 3000
   ```
   Put `<ngrok-url>/webhooks/linq` into `PUBLIC_WEBHOOK_URL` in `.env`.

5. **Register the webhook** (returns a signing secret — paste it into `LINQ_WEBHOOK_SECRET`, then restart):
   ```bash
   npm run register-webhook
   ```

6. **Try it** — text your Linq number a Pips result, or send yourself a hello:
   ```bash
   node scripts/send-test.js +1XXXXXXXXXX "hi"
   ```

## Deploy online (Render free + Upstash Redis)

The bot needs to stay reachable, and Render's free filesystem resets on every
restart — so scores live in a free **Upstash Redis** database instead of the
local file. (Locally, with no Upstash vars set, it still uses `data/scores.json`.)

1. **Create the database** — at [console.upstash.com](https://console.upstash.com),
   create a Redis database. Copy its **REST URL** and **REST token**.

2. **Push this repo to GitHub.**

3. **Deploy on Render** — at [dashboard.render.com](https://dashboard.render.com):
   New + → **Blueprint** → connect the repo. Render reads `render.yaml`. When
   prompted, fill in the secret env vars:
   - `LINQ_API_KEY`
   - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
   - (`LINQ_FROM_NUMBER` is already set in the blueprint)

4. **Point the webhook at Render** — once you have the live URL
   (e.g. `https://pips-bot.onrender.com`), set `PUBLIC_WEBHOOK_URL` to
   `<that URL>/webhooks/linq` and run `npm run register-webhook`. Put the
   returned `signing_secret` into Render's `LINQ_WEBHOOK_SECRET` env var and
   let it redeploy.

> Render free spins the service down after ~15 min idle; the first text after
> idle wakes it (Linq retries delivery for ~25 min, so nothing is lost).

## How it works

```
inbound text ──▶ POST /webhooks/linq ──▶ verify signature ──▶ handleMessage()
                                                                 │
                                  parse Pips blocks / command ◀──┘
                                                                 │
                                          reply ──▶ POST /chats/{id}/messages
```

- `src/parse.js` — turns share text into `{puzzle, difficulty, seconds}`
- `src/store.js` — JSON file at `data/scores.json` (keeps each player's best time per puzzle/difficulty)
- `src/handler.js` — message → reply logic (scores + commands)
- `src/server.js` — Express webhook server
- `src/linq.js` — Linq Partner API client

Run the offline parser tests with `npm run test:parse`.

## Notes

- Storage: a plain JSON file locally, or Upstash Redis when its env vars are set (see Deploy). Both keep the same `{names, scores}` shape.
- The bot keeps your **best** time per puzzle + difficulty (re-sending a slower time won't overwrite).
- No streaks, no cookie tracking — just times and standings.
