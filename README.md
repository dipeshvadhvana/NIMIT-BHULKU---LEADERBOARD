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
- **Backend** — Express API with session-based auth (`express-session`), storing data in
  MongoDB Atlas (free tier) so it persists reliably across restarts and redeploys.

### A note on "Where Points Come From"

This chart is driven by manually-managed categories (Admin → Report), not by a per-yuvak point
history — it's a simple way to show a category breakdown without building a full point-entry
ledger. If you want it fully automatic (each point a yuvak earns tagged with a category, summed
up automatically), that's a bigger data-model change — let me know if you want that built out.

## Running it locally

```bash
npm install
cp .env.example .env   # then fill in MONGODB_URI (see "Setting up MongoDB Atlas" below)
npm start
```

Without `MONGODB_URI` set, the app still runs — using in-memory storage only, so it works for
quick local testing but resets every time you restart it. Fill in `.env` to persist data locally
against the same Atlas database used in production, or point it at a separate free Atlas cluster
for local dev.

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

## Data storage: MongoDB Atlas

All data (teams, yuvaks, rulebook, report categories, admin accounts) lives in a single MongoDB
document, managed through `db.js`. This survives Render restarts/redeploys/spin-downs, unlike a
local file, since the database lives on Atlas's servers rather than Render's disk.

### Setting up MongoDB Atlas (free, one-time)

1. Go to **[mongodb.com/cloud/atlas/register](https://www.mongodb.com/cloud/atlas/register)** and
   create a free account (no credit card required).
2. Create a new **free (M0) cluster** — pick any cloud provider/region, the defaults are fine.
3. **Create a database user**: Atlas will prompt you during setup, or go to
   *Database Access* → *Add New Database User*. Pick a username/password (save these — you'll
   need them in the connection string). Use "Password" authentication.
4. **Allow network access**: go to *Network Access* → *Add IP Address* → **Allow Access from
   Anywhere** (`0.0.0.0/0`). This is necessary since Render's IP isn't fixed/predictable on the
   free tier.
5. **Get your connection string**: go to your cluster → *Connect* → *Drivers* → copy the URI. It
   looks like:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
   Replace `<username>` and `<password>` with the database user you created (not your Atlas
   account login — the database user).
6. **Add it to Render**: in your Render service → *Environment* → add a variable:
   - Key: `MONGODB_URI`
   - Value: the connection string from step 5
7. Redeploy on Render (or it'll pick it up automatically on the next deploy). Check the Render
   logs — you should see `Connected to MongoDB Atlas` instead of the "not set" warning.

That's it — your data now persists permanently, independent of Render restarts/redeploys.

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

Note: since data now lives in MongoDB Atlas rather than a local file, this backend would even
work as a Vercel serverless function if you wanted to consolidate further — the `load()`/`save()`
functions in `db.js` are the only place that talks to storage, so any such change is isolated
there. That said, the current Express/Render setup works fine as-is.

## Customizing branding

- Header logo initials ("NB") and title are in `public/index.html` / `public/admin.html`.
- Colors, fonts, and layout are in `public/css/style.css` and `public/css/admin.css`.
- Team color swatches are set per-team in the admin portal (used for avatar circles and the
  podium bars).
