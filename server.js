const express = require('express');
const cors = require('cors');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const { parse } = require('csv-parse/sync');
const path = require('path');
const { load, save, PALETTE } = require('./db');
const app = express();
app.use(cors({
  origin: "https://nimit-bhulku-leaderboard.vercel.app",
  credentials: true
}));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'nimit-bhulku-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 8 },
}));

function requireAuth(req, res, next) {
  if (req.session && req.session.adminId) return next();
  return res.status(401).json({ error: 'Not authenticated' });
}

// Standard competition ranking (ties share a rank; next distinct value skips ahead)
function withRank(items) {
  const sorted = [...items].sort((a, b) => b.points - a.points);
  return sorted.map(item => ({
    ...item,
    rank: sorted.filter(x => x.points > item.points).length + 1,
  }));
}

function teamsWithPoints(data) {
  return data.teams.map(t => {
    const members = data.yuvaks.filter(y => y.team_id === t.id);
    const points = members.reduce((sum, y) => sum + (Number(y.points) || 0), 0);
    return { ...t, points, memberCount: members.length };
  });
}

// ---------- Public / Auth ----------

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const data = load();
  const admin = data.admins.find(a => a.username === username);
  if (!admin || !bcrypt.compareSync(password || '', admin.passwordHash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  req.session.adminId = admin.id;
  req.session.username = admin.username;
  res.json({ ok: true, username: admin.username });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => {
  if (req.session && req.session.adminId) {
    return res.json({ authenticated: true, username: req.session.username });
  }
  res.json({ authenticated: false });
});

// ---------- Event meta ----------

app.get('/api/event', (req, res) => {
  const data = load();
  res.json({ ...data.event, teamCount: data.teams.length, yuvakCount: data.yuvaks.length });
});

app.put('/api/event', requireAuth, (req, res) => {
  const data = load();
  data.event = { ...data.event, ...req.body };
  save(data);
  res.json(data.event);
});

// ---------- Teams ----------
// Team points are always computed as the sum of their yuvaks' points — never stored directly.

app.get('/api/teams', (req, res) => {
  const data = load();
  res.json(withRank(teamsWithPoints(data)));
});

app.post('/api/teams', requireAuth, (req, res) => {
  const data = load();
  const { name, mentor_name, initials, color } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Team name is required' });
  const team = {
    id: data.nextTeamId++,
    name,
    mentor_name: mentor_name || '',
    initials: (initials || name.slice(0, 2)).toUpperCase(),
    color: color || PALETTE[data.teams.length % PALETTE.length],
  };
  data.teams.push(team);
  save(data);
  res.status(201).json(team);
});

app.put('/api/teams/:id', requireAuth, (req, res) => {
  const data = load();
  const id = Number(req.params.id);
  const team = data.teams.find(t => t.id === id);
  if (!team) return res.status(404).json({ error: 'Team not found' });
  const { name, mentor_name, initials, color } = req.body || {};
  if (name !== undefined) team.name = name;
  if (mentor_name !== undefined) team.mentor_name = mentor_name;
  if (initials !== undefined) team.initials = initials.toUpperCase();
  if (color !== undefined) team.color = color;
  save(data);
  res.json(team);
});

app.delete('/api/teams/:id', requireAuth, (req, res) => {
  const data = load();
  const id = Number(req.params.id);
  const before = data.teams.length;
  data.teams = data.teams.filter(t => t.id !== id);
  data.yuvaks = data.yuvaks.filter(y => y.team_id !== id);
  if (data.teams.length === before) return res.status(404).json({ error: 'Team not found' });
  if (data.spotlightTeamId === id) data.spotlightTeamId = null;
  save(data);
  res.json({ ok: true });
});

// CSV columns: name, mentor_name, initials, color  (points are derived from yuvaks, not imported)
app.post('/api/teams/import', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  let records;
  try {
    records = parse(req.file.buffer.toString('utf-8'), { columns: true, skip_empty_lines: true, trim: true });
  } catch (e) {
    return res.status(400).json({ error: 'Could not parse CSV: ' + e.message });
  }
  const data = load();
  let created = 0, updated = 0;
  for (const row of records) {
    const name = row.name || row.team || row.Name;
    if (!name) continue;
    const existing = data.teams.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      existing.mentor_name = row.mentor_name || row.mentor || existing.mentor_name;
      existing.initials = (row.initials || existing.initials).toUpperCase();
      existing.color = row.color || existing.color;
      updated++;
    } else {
      data.teams.push({
        id: data.nextTeamId++,
        name,
        mentor_name: row.mentor_name || row.mentor || '',
        initials: (row.initials || name.slice(0, 2)).toUpperCase(),
        color: row.color || PALETTE[data.teams.length % PALETTE.length],
      });
      created++;
    }
  }
  save(data);
  res.json({ ok: true, created, updated });
});

// ---------- Yuvaks (members) ----------

app.get('/api/yuvaks', (req, res) => {
  const data = load();
  const teamMap = Object.fromEntries(data.teams.map(t => [t.id, { name: t.name, mentor_name: t.mentor_name }]));
  const enriched = data.yuvaks.map(y => ({
    ...y,
    team_name: teamMap[y.team_id]?.name || null,
    team_mentor: teamMap[y.team_id]?.mentor_name || null,
  }));
  res.json(withRank(enriched));
});

app.post('/api/yuvaks', requireAuth, (req, res) => {
  const data = load();
  const { name, team_id, points } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const yuvak = { id: data.nextYuvakId++, name, team_id: team_id ? Number(team_id) : null, points: Number(points) || 0 };
  data.yuvaks.push(yuvak);
  save(data);
  res.status(201).json(yuvak);
});

app.put('/api/yuvaks/:id', requireAuth, (req, res) => {
  const data = load();
  const id = Number(req.params.id);
  const y = data.yuvaks.find(y => y.id === id);
  if (!y) return res.status(404).json({ error: 'Yuvak not found' });
  const { name, team_id, points } = req.body || {};
  if (name !== undefined) y.name = name;
  if (team_id !== undefined) y.team_id = team_id ? Number(team_id) : null;
  if (points !== undefined) y.points = Number(points) || 0;
  save(data);
  res.json(y);
});

app.delete('/api/yuvaks/:id', requireAuth, (req, res) => {
  const data = load();
  const id = Number(req.params.id);
  const before = data.yuvaks.length;
  data.yuvaks = data.yuvaks.filter(y => y.id !== id);
  if (data.yuvaks.length === before) return res.status(404).json({ error: 'Yuvak not found' });
  save(data);
  res.json({ ok: true });
});

// CSV columns: name, team_name, points
app.post('/api/yuvaks/import', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  let records;
  try {
    records = parse(req.file.buffer.toString('utf-8'), { columns: true, skip_empty_lines: true, trim: true });
  } catch (e) {
    return res.status(400).json({ error: 'Could not parse CSV: ' + e.message });
  }
  const data = load();
  let created = 0;
  for (const row of records) {
    const name = row.name || row.Name;
    if (!name) continue;
    const teamName = row.team_name || row.team || '';
    const team = data.teams.find(t => t.name.toLowerCase() === teamName.toLowerCase());
    data.yuvaks.push({
      id: data.nextYuvakId++,
      name,
      team_id: team ? team.id : null,
      points: Number(row.points || row.Points || 0) || 0,
    });
    created++;
  }
  save(data);
  res.json({ ok: true, created });
});

// ---------- Rulebook ----------

app.get('/api/rulebook', (req, res) => {
  const data = load();
  res.json(data.rulebook);
});

app.put('/api/rulebook/intro', requireAuth, (req, res) => {
  const data = load();
  data.rulebook.intro = (req.body && req.body.intro) || '';
  save(data);
  res.json({ ok: true });
});

app.post('/api/rulebook/points-table', requireAuth, (req, res) => {
  const data = load();
  const { activity, description, points } = req.body || {};
  if (!activity) return res.status(400).json({ error: 'Activity name is required' });
  const row = { id: data.nextRuleId++, activity, description: description || '', points: Number(points) || 0 };
  data.rulebook.pointsTable.push(row);
  save(data);
  res.status(201).json(row);
});

app.put('/api/rulebook/points-table/:id', requireAuth, (req, res) => {
  const data = load();
  const id = Number(req.params.id);
  const row = data.rulebook.pointsTable.find(r => r.id === id);
  if (!row) return res.status(404).json({ error: 'Row not found' });
  const { activity, description, points } = req.body || {};
  if (activity !== undefined) row.activity = activity;
  if (description !== undefined) row.description = description;
  if (points !== undefined) row.points = Number(points) || 0;
  save(data);
  res.json(row);
});

app.delete('/api/rulebook/points-table/:id', requireAuth, (req, res) => {
  const data = load();
  const id = Number(req.params.id);
  const before = data.rulebook.pointsTable.length;
  data.rulebook.pointsTable = data.rulebook.pointsTable.filter(r => r.id !== id);
  if (data.rulebook.pointsTable.length === before) return res.status(404).json({ error: 'Row not found' });
  save(data);
  res.json({ ok: true });
});

app.put('/api/rulebook/rules', requireAuth, (req, res) => {
  const data = load();
  data.rulebook.getTogetherRules = Array.isArray(req.body.rules) ? req.body.rules.filter(Boolean) : [];
  save(data);
  res.json(data.rulebook.getTogetherRules);
});

app.put('/api/rulebook/notes', requireAuth, (req, res) => {
  const data = load();
  data.rulebook.importantNotes = Array.isArray(req.body.notes) ? req.body.notes.filter(Boolean) : [];
  save(data);
  res.json(data.rulebook.importantNotes);
});

// ---------- Report ----------

app.get('/api/report', (req, res) => {
  const data = load();
  const teams = withRank(teamsWithPoints(data));
  const yuvaks = data.yuvaks;

  const totalTeamPoints = teams.reduce((s, t) => s + t.points, 0);
  const totalYuvakPoints = yuvaks.reduce((s, y) => s + (Number(y.points) || 0), 0);
  const yuvaksScoring = yuvaks.filter(y => (Number(y.points) || 0) > 0).length;
  const avgPointsPerYuvak = yuvaks.length ? Math.round(totalYuvakPoints / yuvaks.length) : 0;

  let spotlightTeam = data.spotlightTeamId ? teams.find(t => t.id === data.spotlightTeamId) : null;
  if (!spotlightTeam) spotlightTeam = teams.find(t => t.rank === 1) || null;

  const teamPointsRanked = [...teams].sort((a, b) => b.points - a.points)
    .map(t => ({ id: t.id, name: t.name, color: t.color, points: t.points }));

  const pointsShare = teamPointsRanked.map(t => ({
    ...t,
    pct: totalTeamPoints ? +(t.points / totalTeamPoints * 100).toFixed(1) : 0,
  }));

  const categoryTotal = data.pointCategories.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const pointCategories = data.pointCategories.map(c => ({
    ...c,
    pct: categoryTotal ? +(c.amount / categoryTotal * 100).toFixed(1) : 0,
  }));

  res.json({
    teamCount: teams.length,
    yuvakCount: yuvaks.length,
    totalTeamPoints,
    avgPointsPerYuvak,
    yuvaksScoring,
    spotlightTeam: spotlightTeam ? {
      id: spotlightTeam.id,
      name: spotlightTeam.name,
      initials: spotlightTeam.initials,
      memberCount: spotlightTeam.memberCount,
      points: spotlightTeam.points,
    } : null,
    teamPointsRanked,
    pointsShare,
    pointCategories,
  });
});

app.get('/api/report/settings', requireAuth, (req, res) => {
  const data = load();
  res.json({ spotlightTeamId: data.spotlightTeamId, pointCategories: data.pointCategories });
});

app.put('/api/report/spotlight', requireAuth, (req, res) => {
  const data = load();
  const { teamId } = req.body || {};
  data.spotlightTeamId = teamId ? Number(teamId) : null;
  save(data);
  res.json({ ok: true });
});

app.post('/api/report/categories', requireAuth, (req, res) => {
  const data = load();
  const { name, amount } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Category name is required' });
  const cat = { id: data.nextCategoryId++, name, amount: Number(amount) || 0 };
  data.pointCategories.push(cat);
  save(data);
  res.status(201).json(cat);
});

app.put('/api/report/categories/:id', requireAuth, (req, res) => {
  const data = load();
  const id = Number(req.params.id);
  const cat = data.pointCategories.find(c => c.id === id);
  if (!cat) return res.status(404).json({ error: 'Category not found' });
  const { name, amount } = req.body || {};
  if (name !== undefined) cat.name = name;
  if (amount !== undefined) cat.amount = Number(amount) || 0;
  save(data);
  res.json(cat);
});

app.delete('/api/report/categories/:id', requireAuth, (req, res) => {
  const data = load();
  const id = Number(req.params.id);
  const before = data.pointCategories.length;
  data.pointCategories = data.pointCategories.filter(c => c.id !== id);
  if (data.pointCategories.length === before) return res.status(404).json({ error: 'Category not found' });
  save(data);
  res.json({ ok: true });
});

// ---------- Admin account ----------

app.put('/api/admin/password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const data = load();
  const admin = data.admins.find(a => a.id === req.session.adminId);
  if (!admin || !bcrypt.compareSync(currentPassword || '', admin.passwordHash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }
  admin.passwordHash = bcrypt.hashSync(newPassword, 10);
  save(data);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Nimit Bhulku leaderboard running on http://localhost:${PORT}`));
