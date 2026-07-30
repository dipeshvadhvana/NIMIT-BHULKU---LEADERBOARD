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

## Deploying (split frontend/backend — Vercel + Render)

This project can run as **one deployment** (a single Node server serving both the API and the
static frontend), or **split across two hosts** — frontend on Vercel (static), backend on Render
(Node) — which is how `nimit-bhulku-leaderboard.vercel.app` +
`nimit-bhulku-leaderboard.onrender.com` are wired up:

1. **Backend on Render**: deploy the whole repo as a Node web service (`npm install`, `npm start`).
   Render automatically sets an env var (`RENDER`) that this app uses to detect production mode —
   no extra config needed, though setting `NODE_ENV=production` explicitly in Render's dashboard
   is a good belt-and-suspenders move.
2. **Frontend on Vercel**: deploy just the `public/` folder as a static site.
3. **Connecting them**: `public/js/app.js` and `public/js/admin.js` each have an `API_BASE`
   constant near the top, hardcoded to the Render URL:
   ```js
   const API_BASE = 'https://nimit-bhulku-leaderboard.onrender.com';
   ```
   If your Render URL is different, update `API_BASE` in both files.
4. **CORS**: `server.js` only allows requests from a small allow-list of origins (so random sites
   can't hit your API with a logged-in admin's cookies). It defaults to the Vercel URL above plus
   `localhost` for local dev. If your frontend lives elsewhere, either edit `defaultOrigins` in
   `server.js`, or set an `ALLOWED_ORIGINS` env var on Render (comma-separated list of origins) —
   no code change needed for that path.
5. **Cross-site cookies**: admin login uses a session cookie. Because the frontend and backend
   are on different domains, that cookie is set with `SameSite=None; Secure`, which only works
   over HTTPS — both Vercel and Render serve HTTPS by default, so this works out of the box.
6. **Render free tier note**: free Render services spin down after inactivity, so the first
   request after idle time can take 20–50 seconds to wake up. That's normal, not a bug.

If you'd rather keep everything on one host (simpler, no CORS/cookie complexity), deploy this
whole project as a single Node service (Render, Railway, a VPS, etc.) and skip Vercel entirely —
the server already serves `public/` itself. In that case, set `API_BASE = ''` in both
`app.js` and `admin.js` so requests go back to relative `/api/...` paths.

Note: the JSON-file database (`db.js`) needs persistent disk, so it works on Render/Railway/a VPS
but not on Vercel's serverless functions. If you outgrow it, swap `db.js` for a real database —
the rest of the app only talks to its `load()`/`save()` functions, so the swap is isolated there.

## Customizing branding

- Header logo initials ("NB") and title are in `public/index.html` / `public/admin.html`.
- Colors, fonts, and layout are in `public/css/style.css` and `public/css/admin.css`.
- Team color swatches are set per-team in the admin portal (used for avatar circles and the
  podium bars).
