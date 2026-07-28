let allTeams = [];
let allYuvaks = [];

const CATEGORY_COLORS = ['#4C6EF5', '#20A39E', '#F0B429', '#2F9E44', '#A24DBF', '#E0392E', '#C77B4E', '#8B92A0'];

function fmtPoints(n){
  return Number(n || 0).toLocaleString('en-IN');
}
function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function initialsOf(name){
  return String(name || '?').trim().split(/\s+/).slice(0,2).map(w => w[0]).join('').toUpperCase();
}

async function loadEvent(){
  const res = await fetch('https://nimit-bhulku-leaderboard.onrender.com/api/event')
  const ev = await res.json();
  document.getElementById('eventMeta').innerHTML =
    `<span>🕐 ${ev.date || ''}</span><span>${ev.teamCount} teams</span><span>${ev.yuvakCount} yuvaks</span>`;
}

// ---------- Teams ----------

async function loadTeams(){
  const res = await fetch('https://nimit-bhulku-leaderboard.onrender.com/api/teams')
  allTeams = await res.json();
  renderTeams(allTeams);
  populateTeamFilter();
}

function renderTeams(teams){
  const sorted = [...teams].sort((a,b)=>b.points-a.points);
  const top3 = sorted.slice(0,3);
  const rest = sorted.slice(3);

  const podium = document.getElementById('podium');
  const order = [top3[1], top3[0], top3[2]];
  podium.innerHTML = order.map(t => {
    if(!t) return '<div></div>';
    return `
      <div class="podium-card rank-${t.rank}">
        <div class="podium-top">
          ${t.rank===1 ? '<div class="crown">👑</div>' : ''}
          <div class="avatar-wrap">
            <div class="avatar" style="background:${t.color}">${t.initials}</div>
            <div class="rank-badge">${t.rank}</div>
          </div>
          <div class="team-name">${escapeHtml(t.name)}</div>
          <div class="mentor-name">${escapeHtml(t.mentor_name||'')}</div>
        </div>
        <div class="points-bar">${fmtPoints(t.points)}</div>
      </div>`;
  }).join('');

  const list = document.getElementById('teamList');
  if(rest.length === 0){
    list.innerHTML = '<div class="empty">No more teams to show.</div>';
  } else {
    list.innerHTML = rest.map(t => `
      <div class="list-row">
        <div class="list-rank">${t.rank}</div>
        <div class="list-avatar" style="background:${t.color}">${t.initials}</div>
        <div class="list-info">
          <div class="list-name">${escapeHtml(t.name)}</div>
          <div class="list-sub">${escapeHtml(t.mentor_name||'')}</div>
        </div>
        <div class="list-points">${fmtPoints(t.points)}</div>
      </div>`).join('');
  }
}

document.getElementById('searchInput').addEventListener('input', e => {
  const q = e.target.value.toLowerCase();
  const filtered = allTeams.filter(t =>
    t.name.toLowerCase().includes(q) || (t.mentor_name||'').toLowerCase().includes(q));
  renderTeams(filtered);
});

// ---------- Yuvaks ----------

function populateTeamFilter(){
  const sel = document.getElementById('yuvakTeamFilter');
  const current = sel.value;
  sel.innerHTML = '<option value="">All teams</option>' +
    allTeams.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
  sel.value = current;
}

async function loadYuvaks(){
  const res = await fetch('https://nimit-bhulku-leaderboard.onrender.com/api/yuvaks')
  allYuvaks = await res.json();
  applyYuvakFilters();
}

function applyYuvakFilters(){
  const q = document.getElementById('yuvakSearchInput').value.toLowerCase();
  const teamId = document.getElementById('yuvakTeamFilter').value;
  const filtered = allYuvaks.filter(y => {
    const matchesQuery = y.name.toLowerCase().includes(q) || (y.team_name||'').toLowerCase().includes(q);
    const matchesTeam = !teamId || String(y.team_id) === String(teamId);
    return matchesQuery && matchesTeam;
  });
  renderYuvaks(filtered);
}

function teamColorFor(teamId){
  const t = allTeams.find(t => t.id === teamId);
  return t ? t.color : '#8B92A0';
}

function renderYuvaks(yuvaks){
  const sorted = [...yuvaks].sort((a,b)=>b.points-a.points);
  const top3 = sorted.slice(0,3);
  const rest = sorted.slice(3);

  const podium = document.getElementById('yuvakPodium');
  const order = [top3[1], top3[0], top3[2]];
  podium.innerHTML = order.map(y => {
    if(!y) return '<div></div>';
    return `
      <div class="podium-card rank-${y.rank}">
        <div class="podium-top">
          ${y.rank===1 ? '<div class="crown">👑</div>' : ''}
          <div class="avatar-wrap">
            <div class="avatar" style="background:${teamColorFor(y.team_id)}">${initialsOf(y.name)}</div>
            <div class="rank-badge">${y.rank}</div>
          </div>
          <div class="team-name">${escapeHtml(y.name)}</div>
          <div class="mentor-name">${escapeHtml(y.team_name || 'No team')}</div>
        </div>
        <div class="points-bar">${fmtPoints(y.points)}</div>
      </div>`;
  }).join('');

  const container = document.getElementById('yuvakGroupedList');
  if(rest.length === 0){
    container.innerHTML = '<div class="list"><div class="empty">No more yuvaks to show.</div></div>';
    return;
  }

  // Group consecutive rest items by rank (ties share a rank, like the original)
  const groups = [];
  for(const y of rest){
    const last = groups[groups.length - 1];
    if(last && last.rank === y.rank) last.items.push(y);
    else groups.push({ rank: y.rank, points: y.points, items: [y] });
  }

  container.innerHTML = groups.map(g => `
    <div class="rank-group-header">
      <span>Rank ${g.rank}</span>
      <span class="rgh-count">· ${g.items.length} yuvak${g.items.length>1?'s':''} · ${fmtPoints(g.points)} pts</span>
    </div>
    <div class="list">
      ${g.items.map(y => `
        <div class="list-row">
          <div class="list-rank">${y.rank}</div>
          <div class="list-avatar" style="background:${teamColorFor(y.team_id)}">${initialsOf(y.name)}</div>
          <div class="list-info">
            <div class="list-name">${escapeHtml(y.name)}</div>
            <div class="list-sub">👥 ${escapeHtml(y.team_name || 'No team')}${y.team_mentor ? ' · ' + escapeHtml(y.team_mentor) : ''}</div>
          </div>
          <div class="list-points">${fmtPoints(y.points)}</div>
        </div>`).join('')}
    </div>
  `).join('');
}

document.getElementById('yuvakSearchInput').addEventListener('input', applyYuvakFilters);
document.getElementById('yuvakTeamFilter').addEventListener('change', applyYuvakFilters);

// ---------- Report ----------

async function loadReport(){
  const res = await fetch('https://nimit-bhulku-leaderboard.onrender.com/api/report')
  const r = await res.json();

  const stats = [
    { label: 'Teams', value: r.teamCount },
    { label: 'Yuvaks', value: r.yuvakCount },
    { label: 'Total team points', value: fmtPoints(r.totalTeamPoints) },
    { label: 'Avg points per yuvak', value: fmtPoints(r.avgPointsPerYuvak) },
    { label: 'Yuvaks scoring', value: `${r.yuvaksScoring} / ${r.yuvakCount}` },
  ];
  if(r.spotlightTeam){
    stats.push({
      label: `${r.spotlightTeam.initials} members · their points`,
      value: `${r.spotlightTeam.memberCount} · ${fmtPoints(r.spotlightTeam.points)}`,
    });
  }
  document.getElementById('statGrid').innerHTML = stats.map(s => `
    <div class="stat-card">
      <div class="stat-label">${escapeHtml(s.label)}</div>
      <div class="stat-value">${s.value}</div>
    </div>`).join('');

  const maxTeamPoints = Math.max(1, ...r.teamPointsRanked.map(t => t.points));
  document.getElementById('teamPointsBars').innerHTML = r.teamPointsRanked.map(t => `
    <div>
      <div class="bar-row-label"><span>${escapeHtml(t.name)}</span><span>${fmtPoints(t.points)}</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${(t.points/maxTeamPoints*100).toFixed(1)}%;background:${t.color}"></div></div>
    </div>`).join('') || '<div class="empty">No teams yet.</div>';

  renderShare('pointsShareStrip', 'pointsShareLegend', r.pointsShare);

  const categories = r.pointCategories.map((c,i) => ({...c, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length]}));
  renderShare('categoryStrip', 'categoryLegend', categories);
}

function renderShare(stripId, legendId, items){
  const strip = document.getElementById(stripId);
  const legend = document.getElementById(legendId);
  if(!items.length){
    strip.innerHTML = '';
    legend.innerHTML = '<div class="empty">No data yet.</div>';
    return;
  }
  strip.innerHTML = items.map(i => `<div style="width:${i.pct}%;background:${i.color}"></div>`).join('');
  legend.innerHTML = items.map(i => `
    <div class="share-legend-row">
      <span class="share-dot" style="background:${i.color}"></span>
      <span class="name">${escapeHtml(i.name)}</span>
      <span class="val">${fmtPoints(i.points !== undefined ? i.points : i.amount)}</span>
      <span class="pct">${i.pct}%</span>
    </div>`).join('');
}

// ---------- Rulebook ----------

async function loadRulebook(){
  const res = await fetch('https://nimit-bhulku-leaderboard.onrender.com/api/rulebook')
  const rb = await res.json();

  document.getElementById('rulebookIntro').textContent = rb.intro || '';

  document.getElementById('pointsTableBody').innerHTML = rb.pointsTable.map(row => `
    <tr>
      <td>
        <div class="pt-activity">${escapeHtml(row.activity)}</div>
        ${row.description ? `<div class="pt-desc">${escapeHtml(row.description)}</div>` : ''}
      </td>
      <td class="pt-points">${fmtPoints(row.points)}</td>
    </tr>`).join('') || '<tr><td colspan="2">No rules added yet.</td></tr>';

  document.getElementById('getTogetherList').innerHTML =
    rb.getTogetherRules.map(rule => `<li>${escapeHtml(rule)}</li>`).join('') || '<li>No rules added yet.</li>';

  document.getElementById('importantNotesList').innerHTML =
    rb.importantNotes.map(note => `<li>${escapeHtml(note)}</li>`).join('') || '<li>No notes added yet.</li>';
}

// ---------- Tabs ----------

document.getElementById('mainNav').addEventListener('click', e => {
  const a = e.target.closest('a');
  if(!a) return;
  e.preventDefault();
  document.querySelectorAll('#mainNav a').forEach(x => x.classList.remove('active'));
  a.classList.add('active');
  const tab = a.dataset.tab;
  ['teams','yuvaks','report','rulebook'].forEach(t => {
    document.getElementById(t+'View').style.display = (t === tab) ? '' : 'none';
  });
  if(tab === 'yuvaks') loadYuvaks();
  if(tab === 'report') loadReport();
  if(tab === 'rulebook') loadRulebook();
});

// ---------- Settings gear -> admin login modal ----------

const loginModal = document.getElementById('loginModalOverlay');
document.getElementById('settingsBtn').addEventListener('click', () => {
  document.getElementById('gearLoginError').textContent = '';
  document.getElementById('gearUser').value = '';
  document.getElementById('gearPass').value = '';
  loginModal.style.display = 'flex';
  document.getElementById('gearUser').focus();
});
document.getElementById('gearCancelBtn').addEventListener('click', () => {
  loginModal.style.display = 'none';
});
document.getElementById('gearLoginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const errEl = document.getElementById('gearLoginError');
  errEl.textContent = '';
  try{
    const res = await fetch('https://nimit-bhulku-leaderboard.onrender.com/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        username: document.getElementById('gearUser').value,
        password: document.getElementById('gearPass').value,
      }),
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || 'Login failed');
    window.location.href = '/admin.html';
  }catch(err){
    errEl.textContent = err.message;
  }
});

loadEvent();
loadTeams();
