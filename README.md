# Nimit Bhulku — Leaderboard + Admin Portal

A full-stack recreation of the Uljhan Suljhan leaderboard, rebranded as **Nimit Bhulku**, with a
complete admin portal for managing teams and yuvaks (members).

## What's included

- **Public leaderboard** (`/`) — four tabs:
  - **Teams** — top-3 podium, ranked team list, search.
  - **Yuvaks** — top-3 podium of individual yuvaks, a team filter dropdown, search, and a
    ranked list grouped by rank (ties share a rank, just like the original site).
  - **Report** — stat cards (teams, yuvaks, total points, avg points/yuvak, a "spotlight team"
    stat), a team-points bar chart, a points-share breakdown, and a "where points come from"
    category breakdown.
  - **Rulebook** — points table, get-together rules, and important notes.
  - A settings (⚙️) button in the header opens a login modal — entering the admin password
    takes you to the admin portal. There's no visible link to `/admin.html` otherwise.
- **Admin portal** (`/admin.html`) — password-protected, with tabs for:
  - **Teams** — full CRUD + CSV import. Team points are *not* set manually — they're always
    the sum of that team's yuvaks.
  - **Yuvaks** — full CRUD + CSV import. This is where you set individual points.
  - **Rulebook** — edit the intro text, add/edit/delete points-table rows, and edit the
    get-together rules / important notes (one per line).
  - **Report** — choose a "spotlight team" (or leave it on auto = top-ranked team), and
    manage the point categories that drive the "where points come from" chart.
  - **Settings** — event name/date, and admin password change.
- **Backend** — Express API with session-based auth (`express-session`), storing data in a JSON
  file database (`data/db.json`) so it persists across restarts without needing to install a
  native database engine.

### A note on "Where Points Come From"

This chart is driven by manually-managed categories (Admin → Report), not by a per-yuvak point
history — it's a simple way to show a category breakdown without building a full point-entry
ledger. If you want it fully automatic (each point a yuvak earns tagged with a category, summed
up automatically), that's a bigger data-model change — let me know if you want that built out.

## Running it locally

```bash
npm install
npm start
```

Then open:
- Leaderboard: http://localhost:3000/
- Admin portal: http://localhost:3000/admin.html

**Default admin login:** `admin` / `admin123` — change this immediately from
Admin → Settings → Change password.

## CSV import formats

**Teams** (`/admin.html` → Teams → Import CSV):
```
name,mentor_name,initials,color
Akshar Universe,Atmiya Anil Boricha,AU,#F0B429
```
Matching an existing team name updates it; otherwise a new team is created. Points aren't part
of this import — they're always computed from the team's yuvaks.

**Yuvaks** (`/admin.html` → Yuvaks → Import CSV):
```
name,team_name,points
Ravi Patel,Akshar Universe,45000
```
`team_name` must match an existing team's name exactly (case-insensitive) to link it.

## Data storage

All data lives in `data/db.json`, created automatically on first run with a small seed dataset
(3 sample teams matching the original screenshot). Delete that file to reset to the seed data.

## Deploying

This runs anywhere Node.js runs (Render, Railway, Fly.io, a VPS, etc.). The JSON-file database
works fine for small/medium events, but if you outgrow it or need multiple server instances,
swap `db.js` for a real database (e.g. Postgres via `pg`, or SQLite via a prebuilt binary) —
the rest of the app only talks to `db.js`'s `load()`/`save()` functions, so the swap is isolated
to that one file. Note: this JSON approach won't work on Vercel's serverless functions (no
persistent disk) — use a traditional Node host, or migrate to a hosted database first.

## Customizing branding

- Header logo initials ("NB") and title are in `public/index.html` / `public/admin.html`.
- Colors, fonts, and layout are in `public/css/style.css` and `public/css/admin.css`.
- Team color swatches are set per-team in the admin portal (used for avatar circles and the
  podium bars).
