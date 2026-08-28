# ♞ Chess Analysis

A web app that replays chess games and teaches you to analyse them. Drop in a game, step through the moves, and get engine analysis with move-by-move coaching commentary — what each move does, what was better, and why.

**Just want to analyse a game?** Use the live site: **[chess.moosha.org](https://chess.moosha.org)** — free, nothing to install. This repository is for people who want to run their own instance.

## Features

- **Import anything** — drag-and-drop a `.pgn` file, paste PGN or a bare move list, or paste a lichess game URL
- **In-browser Stockfish analysis** — a fast whole-game sweep gives every move a verdict (best / good / inaccuracy / mistake / blunder) within seconds, then deepens around whichever move you're viewing; runs entirely in your browser via WebAssembly, no server compute
- **Readable analysis** — arrows on the board for the played and best moves, worded evaluations ("White slightly better"), and click-to-play previews of suggested lines
- **AI coaching (optional)** — an "Explain this move" button that sends the position and engine analysis to the Claude API and returns plain-language coaching; gated to paid-tier accounts, cached per position
- **Accounts & tiers** — guests analyse without signing up (nothing stored); registered users save games; a paid flag (toggled by the admin) unlocks AI explanations; admins curate content
- **Famous games** — an admin-curated gallery (a 34-game starter pack from Anderssen to AlphaZero ships in `scripts/famous-games.json`) with per-move hand annotations
- **Dark mode, mobile-friendly, keyboard navigation**

## Stack

Next.js 15 (App Router, TypeScript) · Postgres + Drizzle ORM · Tailwind CSS v4 · chess.js + react-chessboard · Stockfish WASM (single-threaded lite build) · Anthropic SDK (`claude-opus-5`) for coaching · cookie sessions (argon2, hashed tokens at rest) · Vitest + Playwright

## Self-hosting

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- An [Anthropic API key](https://console.anthropic.com/) — only needed for the AI "Explain this move" feature; everything else works without it

### Setup

```bash
git clone https://github.com/hriday/chess.git
cd chess
npm ci                      # also copies the Stockfish WASM into public/ (postinstall)

# Database
createuser --pwprompt chess
createdb -O chess chess

# Environment — copy and fill in
cp .env.example .env
#   DATABASE_URL=postgres://chess:<password>@localhost:5432/chess
#   ANTHROPIC_API_KEY=sk-ant-...   (yours; never commit it)
#   SESSION_SECRET=<openssl rand -hex 32>

npm run db:migrate          # apply schema
npm run dev                 # http://localhost:3000
```

### Make yourself admin, seed famous games

```bash
# after signing up through the UI:
npx tsx scripts/make-admin.ts you@example.com

# optional: load the 34-game famous-games starter pack (idempotent)
npx tsx scripts/seed-famous.ts
```

Admins can publish famous games, write per-move annotations (open a famous game with `?annotate=1`), and toggle users' paid flags at `/admin`. Admins get AI explanations without the paid flag.

### Production

```bash
npm run build && npm run start -- --port 3001
```

- A hardened systemd unit lives at `deploy/chess.service` (sandboxed: `ProtectSystem=strict`, `NoNewPrivileges`, etc.) — adjust paths, then `systemctl enable --now chess`
- A Caddy reverse-proxy snippet is at `deploy/Caddyfile.snippet`
- `deploy.sh` is a simple rsync-based deploy: `DEPLOY_SERVER=root@your.server ./deploy.sh` (runs tests locally first, stops the service during the remote build — helpful on small VPSes)
- Rate limiting is in-process; it assumes a single Node instance behind a proxy that sets `X-Forwarded-For`

### Tests

```bash
npm test        # unit tests (Vitest)
npm run e2e     # browser tests (Playwright; needs `npx playwright install chromium`)
```

## License

MIT — see [LICENSE](LICENSE).
