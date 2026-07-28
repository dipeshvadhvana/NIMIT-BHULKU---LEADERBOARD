let teams = [];
let yuvaks = [];

const $ = sel => document.querySelector(sel);

async function api(url, opts = {}){
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...opts,
  });
  if(res.status === 401){
    showLogin();
    throw new Error('Not authenticated');
  }
  const data = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function showLogin(){
  $('#loginView').style.display = '';
  $('#dashboardView').style.display = 'none';
}
function showDashboard(){
  $('#loginView').style.display = 'none';
  $('#dashboardView').style.display = '';
  loadTeams();
  loadEventSettings();
}

async function checkAuth(){
  const me = await fetch('/api/me').then(r => r.json());
  if(me.authenticated) showDashboard(); else showLogin();
}

$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  $('#loginError').textContent = '';
  try{
    await api('/api/login', { method:'POST', body: JSON.stringify({
      username: $('#loginUser').value, password: $('#loginPass').value,
    })});
    showDashboard();
  }catch(err){
    $('#loginError').textContent = err.message;
  }
});

$('#logoutBtn').addEventListener('click', async () => {
  await api('/api/logout', { method:'POST' });
  showLogin();
});

// ---------- Tabs ----------
document.querySelectorAll('.admin-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    ['teams','yuvaks','rulebook','report','settings'].forEach(t => {
      $('#' + t + 'Tab').style.display = (t === tab) ? '' : 'none';
    });
    if(tab === 'yuvaks') loadYuvaks();
    if(tab === 'rulebook') loadRulebookAdmin();
    if(tab === 'report') loadReportAdmin();
  });
});

// ---------- Teams ----------
async function loadTeams(){
  teams = await api('/api/teams');
  const tbody = $('#teamTableBody');
  tbody.innerHTML = teams.sort((a,b)=>b.points-a.points).map(t => `
    <tr>
      <td>${t.rank}</td>
      <td>${esc(t.name)}</td>
      <td>${esc(t.mentor_name||'')}</td>
      <td>${esc(t.initials)}</td>
      <td><span class="swatch" style="background:${t.color}"></span></td>
      <td>${Number(t.points).toLocaleString('en-IN')}</td>
      <td class="row-actions">
        <button class="btn btn-ghost" onclick="editTeam(${t.id})">Edit</button>
        <button class="btn btn-danger" onclick="deleteTeam(${t.id})">Delete</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="7">No teams yet.</td></tr>';
}

function openTeamModal(team){
  $('#teamModalTitle').textContent = team ? 'Edit team' : 'Add team';
  $('#teamId').value = team ? team.id : '';
  $('#teamName').value = team ? team.name : '';
  $('#teamMentor').value = team ? team.mentor_name : '';
  $('#teamInitials').value = team ? team.initials : '';
  $('#teamColor').value = team ? team.color : '#E0392E';
  $('#teamModal').style.display = 'flex';
}
$('#addTeamBtn').addEventListener('click', () => openTeamModal(null));
$('#teamCancelBtn').addEventListener('click', () => $('#teamModal').style.display = 'none');

window.editTeam = id => openTeamModal(teams.find(t => t.id === id));

window.deleteTeam = async id => {
  if(!confirm('Delete this team? This also removes its yuvaks.')) return;
  await api(`/api/teams/${id}`, { method:'DELETE' });
  loadTeams();
};

$('#teamSaveBtn').addEventListener('click', async () => {
  const id = $('#teamId').value;
  const payload = {
    name: $('#teamName').value.trim(),
    mentor_name: $('#teamMentor').value.trim(),
    initials: $('#teamInitials').value.trim(),
    color: $('#teamColor').value,
  };
  if(!payload.name){ alert('Team name is required'); return; }
  try{
    if(id) await api(`/api/teams/${id}`, { method:'PUT', body: JSON.stringify(payload) });
    else await api('/api/teams', { method:'POST', body: JSON.stringify(payload) });
    $('#teamModal').style.display = 'none';
    loadTeams();
  }catch(err){ alert(err.message); }
});

$('#teamCsvInput').addEventListener('change', async e => {
  const file = e.target.files[0];
  if(!file) return;
  const fd = new FormData();
  fd.append('file', file);
  const msg = $('#teamImportMsg');
  try{
    const res = await fetch('/api/teams/import', { method:'POST', body: fd, credentials:'same-origin' });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error);
    msg.textContent = `Imported: ${data.created} created, ${data.updated} updated.`;
    msg.className = 'msg ok';
    loadTeams();
  }catch(err){
    msg.textContent = err.message;
    msg.className = 'msg err';
  }
  e.target.value = '';
});

// ---------- Yuvaks ----------
async function loadYuvaks(){
  yuvaks = await api('/api/yuvaks');
  const teamOptions = ['<option value="">No team</option>']
    .concat(teams.map(t => `<option value="${t.id}">${esc(t.name)}</option>`)).join('');
  $('#yuvakTeam').innerHTML = teamOptions;

  const tbody = $('#yuvakTableBody');
  tbody.innerHTML = yuvaks.sort((a,b)=>b.points-a.points).map(y => `
    <tr>
      <td>${esc(y.name)}</td>
      <td>${esc(y.team_name || '—')}</td>
      <td>${Number(y.points).toLocaleString('en-IN')}</td>
      <td class="row-actions">
        <button class="btn btn-ghost" onclick="editYuvak(${y.id})">Edit</button>
        <button class="btn btn-danger" onclick="deleteYuvak(${y.id})">Delete</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="4">No yuvaks yet.</td></tr>';
}

function openYuvakModal(y){
  $('#yuvakModalTitle').textContent = y ? 'Edit yuvak' : 'Add yuvak';
  $('#yuvakId').value = y ? y.id : '';
  $('#yuvakName').value = y ? y.name : '';
  $('#yuvakTeam').value = y && y.team_id ? y.team_id : '';
  $('#yuvakPoints').value = y ? y.points : 0;
  $('#yuvakModal').style.display = 'flex';
}
$('#addYuvakBtn').addEventListener('click', () => openYuvakModal(null));
$('#yuvakCancelBtn').addEventListener('click', () => $('#yuvakModal').style.display = 'none');

window.editYuvak = id => openYuvakModal(yuvaks.find(y => y.id === id));

window.deleteYuvak = async id => {
  if(!confirm('Delete this yuvak?')) return;
  await api(`/api/yuvaks/${id}`, { method:'DELETE' });
  loadYuvaks();
};

$('#yuvakSaveBtn').addEventListener('click', async () => {
  const id = $('#yuvakId').value;
  const payload = {
    name: $('#yuvakName').value.trim(),
    team_id: $('#yuvakTeam').value || null,
    points: Number($('#yuvakPoints').value) || 0,
  };
  if(!payload.name){ alert('Name is required'); return; }
  try{
    if(id) await api(`/api/yuvaks/${id}`, { method:'PUT', body: JSON.stringify(payload) });
    else await api('/api/yuvaks', { method:'POST', body: JSON.stringify(payload) });
    $('#yuvakModal').style.display = 'none';
    loadYuvaks();
  }catch(err){ alert(err.message); }
});

$('#yuvakCsvInput').addEventListener('change', async e => {
  const file = e.target.files[0];
  if(!file) return;
  const fd = new FormData();
  fd.append('file', file);
  const msg = $('#yuvakImportMsg');
  try{
    const res = await fetch('/api/yuvaks/import', { method:'POST', body: fd, credentials:'same-origin' });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error);
    msg.textContent = `Imported: ${data.created} yuvaks created.`;
    msg.className = 'msg ok';
    loadYuvaks();
  }catch(err){
    msg.textContent = err.message;
    msg.className = 'msg err';
  }
  e.target.value = '';
});

// ---------- Settings ----------
async function loadEventSettings(){
  const ev = await api('/api/event');
  $('#eventNameInput').value = ev.name || '';
  $('#eventDateInput').value = ev.date || '';
}

$('#saveEventBtn').addEventListener('click', async () => {
  const msg = $('#eventSaveMsg');
  try{
    await api('/api/event', { method:'PUT', body: JSON.stringify({
      name: $('#eventNameInput').value.trim(),
      date: $('#eventDateInput').value,
    })});
    msg.textContent = 'Saved.';
    msg.className = 'msg ok';
  }catch(err){
    msg.textContent = err.message;
    msg.className = 'msg err';
  }
});

$('#changePassBtn').addEventListener('click', async () => {
  const msg = $('#passMsg');
  try{
    await api('/api/admin/password', { method:'PUT', body: JSON.stringify({
      currentPassword: $('#curPassInput').value,
      newPassword: $('#newPassInput').value,
    })});
    msg.textContent = 'Password updated.';
    msg.className = 'msg ok';
    $('#curPassInput').value = '';
    $('#newPassInput').value = '';
  }catch(err){
    msg.textContent = err.message;
    msg.className = 'msg err';
  }
});

function esc(str){
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ---------- Rulebook ----------
let rulebookRules = [];

async function loadRulebookAdmin(){
  const rb = await api('/api/rulebook');
  $('#rulebookIntroInput').value = rb.intro || '';
  rulebookRules = rb.pointsTable;
  $('#ruleTableBody').innerHTML = rulebookRules.map(r => `
    <tr>
      <td>${esc(r.activity)}</td>
      <td>${esc(r.description||'')}</td>
      <td>${Number(r.points).toLocaleString('en-IN')}</td>
      <td class="row-actions">
        <button class="btn btn-ghost" onclick="editRule(${r.id})">Edit</button>
        <button class="btn btn-danger" onclick="deleteRule(${r.id})">Delete</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="4">No rows yet.</td></tr>';
  $('#getTogetherTextarea').value = (rb.getTogetherRules || []).join('\n');
  $('#notesTextarea').value = (rb.importantNotes || []).join('\n');
}

$('#saveIntroBtn').addEventListener('click', async () => {
  const msg = $('#introMsg');
  try{
    await api('/api/rulebook/intro', { method:'PUT', body: JSON.stringify({ intro: $('#rulebookIntroInput').value.trim() }) });
    msg.textContent = 'Saved.'; msg.className = 'msg ok';
  }catch(err){ msg.textContent = err.message; msg.className = 'msg err'; }
});

function openRuleModal(rule){
  $('#ruleModalTitle').textContent = rule ? 'Edit row' : 'Add row';
  $('#ruleId').value = rule ? rule.id : '';
  $('#ruleActivity').value = rule ? rule.activity : '';
  $('#ruleDescription').value = rule ? rule.description : '';
  $('#rulePoints').value = rule ? rule.points : 0;
  $('#ruleModal').style.display = 'flex';
}
$('#addRuleBtn').addEventListener('click', () => openRuleModal(null));
$('#ruleCancelBtn').addEventListener('click', () => $('#ruleModal').style.display = 'none');

window.editRule = id => openRuleModal(rulebookRules.find(r => r.id === id));

window.deleteRule = async id => {
  if(!confirm('Delete this row?')) return;
  await api(`/api/rulebook/points-table/${id}`, { method:'DELETE' });
  loadRulebookAdmin();
};

$('#ruleSaveBtn').addEventListener('click', async () => {
  const id = $('#ruleId').value;
  const payload = {
    activity: $('#ruleActivity').value.trim(),
    description: $('#ruleDescription').value.trim(),
    points: Number($('#rulePoints').value) || 0,
  };
  if(!payload.activity){ alert('Activity name is required'); return; }
  try{
    if(id) await api(`/api/rulebook/points-table/${id}`, { method:'PUT', body: JSON.stringify(payload) });
    else await api('/api/rulebook/points-table', { method:'POST', body: JSON.stringify(payload) });
    $('#ruleModal').style.display = 'none';
    loadRulebookAdmin();
  }catch(err){ alert(err.message); }
});

$('#saveRulesBtn').addEventListener('click', async () => {
  const msg = $('#rulesMsg');
  const rules = $('#getTogetherTextarea').value.split('\n').map(s => s.trim()).filter(Boolean);
  try{
    await api('/api/rulebook/rules', { method:'PUT', body: JSON.stringify({ rules }) });
    msg.textContent = 'Saved.'; msg.className = 'msg ok';
  }catch(err){ msg.textContent = err.message; msg.className = 'msg err'; }
});

$('#saveNotesBtn').addEventListener('click', async () => {
  const msg = $('#notesMsg');
  const notes = $('#notesTextarea').value.split('\n').map(s => s.trim()).filter(Boolean);
  try{
    await api('/api/rulebook/notes', { method:'PUT', body: JSON.stringify({ notes }) });
    msg.textContent = 'Saved.'; msg.className = 'msg ok';
  }catch(err){ msg.textContent = err.message; msg.className = 'msg err'; }
});

// ---------- Report settings ----------
let categories = [];

async function loadReportAdmin(){
  const settings = await api('/api/report/settings');
  const teamOptions = ['<option value="">Auto (top team)</option>']
    .concat(teams.map(t => `<option value="${t.id}">${esc(t.name)}</option>`)).join('');
  $('#spotlightTeamSelect').innerHTML = teamOptions;
  $('#spotlightTeamSelect').value = settings.spotlightTeamId || '';

  categories = settings.pointCategories;
  $('#categoryTableBody').innerHTML = categories.map(c => `
    <tr>
      <td>${esc(c.name)}</td>
      <td>${Number(c.amount).toLocaleString('en-IN')}</td>
      <td class="row-actions">
        <button class="btn btn-ghost" onclick="editCategory(${c.id})">Edit</button>
        <button class="btn btn-danger" onclick="deleteCategory(${c.id})">Delete</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="3">No categories yet.</td></tr>';
}

$('#saveSpotlightBtn').addEventListener('click', async () => {
  const msg = $('#spotlightMsg');
  try{
    await api('/api/report/spotlight', { method:'PUT', body: JSON.stringify({ teamId: $('#spotlightTeamSelect').value || null }) });
    msg.textContent = 'Saved.'; msg.className = 'msg ok';
  }catch(err){ msg.textContent = err.message; msg.className = 'msg err'; }
});

function openCategoryModal(cat){
  $('#categoryModalTitle').textContent = cat ? 'Edit category' : 'Add category';
  $('#categoryId').value = cat ? cat.id : '';
  $('#categoryName').value = cat ? cat.name : '';
  $('#categoryAmount').value = cat ? cat.amount : 0;
  $('#categoryModal').style.display = 'flex';
}
$('#addCategoryBtn').addEventListener('click', () => openCategoryModal(null));
$('#categoryCancelBtn').addEventListener('click', () => $('#categoryModal').style.display = 'none');

window.editCategory = id => openCategoryModal(categories.find(c => c.id === id));

window.deleteCategory = async id => {
  if(!confirm('Delete this category?')) return;
  await api(`/api/report/categories/${id}`, { method:'DELETE' });
  loadReportAdmin();
};

$('#categorySaveBtn').addEventListener('click', async () => {
  const id = $('#categoryId').value;
  const payload = {
    name: $('#categoryName').value.trim(),
    amount: Number($('#categoryAmount').value) || 0,
  };
  if(!payload.name){ alert('Category name is required'); return; }
  try{
    if(id) await api(`/api/report/categories/${id}`, { method:'PUT', body: JSON.stringify(payload) });
    else await api('/api/report/categories', { method:'POST', body: JSON.stringify(payload) });
    $('#categoryModal').style.display = 'none';
    loadReportAdmin();
  }catch(err){ alert(err.message); }
});

checkAuth();
