const DEFAULT_PROGRAMME = [
  {day:'Monday',label:'Push',exercises:[
    {name:'Bench Press',target:'3x5',type:'compound',sets:3},
    {name:'Shoulder Press',target:'3x8',type:'compound',sets:3},
    {name:'Incline Chest Flys',target:'3x12',type:'isolation',sets:3},
    {name:'Skull Crushers',target:'3x10',type:'isolation',sets:3},
  ]},
  {day:'Tuesday',label:'Pull',exercises:[
    {name:'Pull-ups',target:'3x5',type:'compound',sets:3},
    {name:'T-Bar Rows',target:'3x8',type:'compound',sets:3},
    {name:'EZ Bar Curls',target:'3x10',type:'isolation',sets:3},
    {name:'Rear Delt Raises',target:'3x15',type:'isolation',sets:3},
  ]},
  {day:'Thursday',label:'Legs + Core',exercises:[
    {name:'Front Squats',target:'3x5',type:'compound',sets:3},
    {name:'Romanian Deadlifts',target:'3x8',type:'compound',sets:3},
    {name:'Calf Raises',target:'3x20',type:'isolation',sets:3},
    {name:'Plank',target:'3x45s',type:'isolation',sets:3},
    {name:'Dead Bug',target:'3x10/side',type:'isolation',sets:3},
  ]},
  {day:'Friday',label:'Accessory',exercises:[
    {name:'Kettlebell Swings',target:'3x15',type:'compound',sets:3},
    {name:'Lateral Raises',target:'3x15',type:'isolation',sets:3},
    {name:'Hammer Curls',target:'3x12',type:'isolation',sets:3},
    {name:'Single-Leg RDL',target:'3x12/side',type:'isolation',sets:3},
    {name:'Farmers Carries',target:'3x~20m',type:'isolation',sets:3},
  ]},
];

const ALL_DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

let state = {
  cycle: 1, week: 1,
  currentDay: null,
  logData: {},
  currentLift: 'Bench Press',
  currentView: 'log',
  programme: null,
  openEditDay: null,
  renamingDay: null,
  prevView: 'log',
  openNotes: {},
};

/* ── PERSISTENCE ── */
function loadState() {
  try {
    const s = localStorage.getItem('ironlog_v2');
    if (s) Object.assign(state, JSON.parse(s));
  } catch(e) {}
  if (!state.programme) state.programme = JSON.parse(JSON.stringify(DEFAULT_PROGRAMME));
  const today = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
  if (!state.currentDay) {
    const trainingDays = state.programme.map(d => d.day);
    state.currentDay = trainingDays.includes(today) ? today : trainingDays[0];
  }
}

function saveState() {
  try { localStorage.setItem('ironlog_v2', JSON.stringify(state)); } catch(e) {}
}

/* ── HELPERS ── */
function getWeekKey() { return `C${state.cycle}W${state.week}`; }
function getSessionKey(day) { return `${day}_${getWeekKey()}`; }

/* ── INIT ── */
function init() {
  loadState();
  buildDayTabs();
  renderLogView();
  updateCycleButtons();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

/* ── DAY TABS ── */
function buildDayTabs() {
  const c = document.getElementById('dayTabs');
  c.innerHTML = '';
  state.programme.forEach(d => {
    const btn = document.createElement('button');
    btn.className = 'day-tab' + (d.day === state.currentDay ? ' active' : '');
    btn.textContent = d.day.substring(0, 3).toUpperCase();
    btn.onclick = () => { state.currentDay = d.day; buildDayTabs(); renderLogView(); };
    c.appendChild(btn);
  });
}

/* ── LOG VIEW ── */
function parseRepTarget(target) {
  const m = target.match(/\d+$/);
  return m ? parseInt(m[0]) : null;
}

function getExerciseData(key, exName) {
  return (state.logData[key] && state.logData[key][exName]) || [];
}

function renderLogView() {
  const dayObj = state.programme.find(d => d.day === state.currentDay);
  const isDeload = state.week === 4;
  const banner = document.getElementById('deloadBanner');
  if (!dayObj) {
    document.getElementById('sessionDay').textContent = (state.currentDay || '') + ' — Rest';
    document.getElementById('sessionSubtitle').textContent = '';
    document.getElementById('exerciseArea').innerHTML = '<div class="rest-day-msg">Rest day<span>Nothing to log today.</span></div>';
    banner.style.display = 'none';
    return;
  }
  document.getElementById('sessionDay').textContent = dayObj.day + ' — ' + dayObj.label;
  document.getElementById('sessionSubtitle').textContent = dayObj.exercises.map(e => e.name).join(' · ');
  banner.style.display = isDeload ? 'block' : 'none';

  const key = getSessionKey(dayObj.day);
  const saved = state.logData[key] || {};
  const prs = computePRs();
  let html = '';
  let lastType = null;

  dayObj.exercises.forEach((ex, ei) => {
    if (ex.type !== lastType) {
      html += '<div class="section-label" style="padding-top:' + (lastType ? '.75rem' : '0') + '">' + (ex.type === 'compound' ? 'Compound' : 'Isolation / Core') + '</div>';
      lastType = ex.type;
    }
    const setsToShow = isDeload ? Math.min(2, ex.sets) : ex.sets;
    const exSets = saved[ex.name] || [];
    const kg = (exSets[0] && exSets[0].kg) || '';
    const reps = (exSets[0] && exSets[0].reps) || '';
    const feelVal = (exSets.find(function(s) { return s && s.feel; }) || {}).feel || '';
    const repTarget = parseRepTarget(ex.target);
    const isPR = prs[ex.name] && kg && parseFloat(kg) >= prs[ex.name];

    // pass/fail: logged reps < target on any set (use same reps for all sets)
    const repsNum = parseInt(reps);
    const failed = reps !== '' && repTarget !== null && repsNum < repTarget;
    const passed = reps !== '' && repTarget !== null && repsNum >= repTarget;

    const statusBadge = failed
      ? '<div class="fail-badge">fail</div>'
      : passed
        ? '<div class="pass-badge">pass</div>'
        : '';

    const noteKey = 'note_' + ei;
    const savedNote = (saved['__notes__'] && saved['__notes__'][ex.name]) || '';
    const noteOpen = state.openNotes && state.openNotes[getSessionKey(dayObj.day) + '_' + ei];

    html += '<div class="exercise-card ' + ex.type + '" id="excard-' + ei + '">'
      + '<div class="exercise-name-row">'
        + '<div class="exercise-name">' + ex.name + '</div>'
        + '<div style="display:flex;align-items:center;gap:6px">'
          + '<select class="feel-select-ex" data-ex="' + ei + '" onchange="handleFeelEx(this)" style="font-family:var(--fm);font-size:12px;padding:3px 6px;border:0.5px solid var(--border);border-radius:20px;background:var(--bg2);color:var(--text2)">'
            + '<option value="">feel —</option>'
            + '<option value="E"' + (feelVal==='E'?' selected':'') + '>E — Easy</option>'
            + '<option value="M"' + (feelVal==='M'?' selected':'') + '>M — Moderate</option>'
            + '<option value="H"' + (feelVal==='H'?' selected':'') + '>H — Hard</option>'
            + '<option value="F"' + (feelVal==='F'?' selected':'') + '>F — Failed</option>'
          + '</select>'
        + '</div>'
      + '</div>'
      + '<div style="display:flex;align-items:center;gap:6px;padding:0 14px 8px">'
        + '<div class="target-badge" id="targetbadge-' + ei + '">' + ex.target + '</div>'
        + '<div id="statusbadge-' + ei + '">' + (isPR ? '<div class="pr-star">★ PR</div>' : statusBadge) + '</div>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;padding:0 14px 10px;align-items:end">'
        + '<div>'
            + '<div style="font-family:var(--fm);font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px;text-align:center">kg</div>'
            + '<input class="set-input" type="number" inputmode="decimal" min="0" step="0.5" placeholder="—" value="' + kg + '" data-ex="' + ei + '" data-field="kg" oninput="handleExInput(this)">'
        + '</div>'
        + '<div>'
            + '<div style="font-family:var(--fm);font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px;text-align:center">reps</div>'
            + '<input class="set-input" type="number" inputmode="numeric" min="0" step="1" placeholder="—" value="' + reps + '" data-ex="' + ei + '" data-field="reps" oninput="handleExInput(this)">'
        + '</div>'
        + '<div>'
            + '<div style="font-family:var(--fm);font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px;text-align:center">sets</div>'
            + '<div style="font-family:var(--fm);font-size:14px;color:var(--text);text-align:center;padding:8px 0;border:0.5px solid var(--border);border-radius:var(--radius);background:var(--bg2)">' + setsToShow + '</div>'
        + '</div>'
      + '</div>'
      + '<div style="padding:0 14px 10px">'
        + '<button class="notes-btn' + (savedNote ? ' notes-btn-active' : '') + '" onclick="toggleNote(' + ei + ')">'
          + (savedNote ? '✎ Edit note' : '+ Add note')
        + '</button>'
        + (noteOpen ? '<textarea class="note-input" data-ex="' + ei + '" placeholder="How did this go? Form cues, observations…" oninput="handleNote(this)">' + savedNote + '</textarea>' : '')
      + '</div>'
    + '</div>';
  });
  document.getElementById('exerciseArea').innerHTML = html;
}

function handleExInput(el) {
  const dayObj = state.programme.find(d => d.day === state.currentDay);
  if (!dayObj) return;
  const key = getSessionKey(dayObj.day);
  if (!state.logData[key]) state.logData[key] = {};
  const ei = parseInt(el.dataset.ex);
  const ex = dayObj.exercises[ei];
  const isDeload = state.week === 4;
  const setsToShow = isDeload ? Math.min(2, ex.sets) : ex.sets;
  if (!state.logData[key][ex.name]) state.logData[key][ex.name] = [];
  // write same value to all sets
  for (let s = 0; s < setsToShow; s++) {
    if (!state.logData[key][ex.name][s]) state.logData[key][ex.name][s] = {};
    state.logData[key][ex.name][s][el.dataset.field] = el.value;
  }
  // update status badge live
  const exSets = state.logData[key][ex.name];
  const kg = (exSets[0] && exSets[0].kg) || '';
  const reps = (exSets[0] && exSets[0].reps) || '';
  const repTarget = parseRepTarget(ex.target);
  const repsNum = parseInt(reps);
  const prs = computePRs();
  const isPR = prs[ex.name] && kg && parseFloat(kg) >= prs[ex.name];
  const failed = reps !== '' && repTarget !== null && repsNum < repTarget;
  const passed = reps !== '' && repTarget !== null && repsNum >= repTarget;
  const statusSlot = document.getElementById('statusbadge-' + ei);
  if (statusSlot) {
    if (isPR) {
      statusSlot.innerHTML = '<div class="pr-star">★ PR</div>';
    } else if (failed) {
      statusSlot.innerHTML = '<div class="fail-badge">fail</div>';
    } else if (passed) {
      statusSlot.innerHTML = '<div class="pass-badge">pass</div>';
    } else {
      statusSlot.innerHTML = '';
    }
  }
}

function handleFeelEx(el) {
  const dayObj = state.programme.find(d => d.day === state.currentDay);
  if (!dayObj) return;
  const key = getSessionKey(dayObj.day);
  if (!state.logData[key]) state.logData[key] = {};
  const ei = parseInt(el.dataset.ex);
  const ex = dayObj.exercises[ei];
  const setsToShow = state.week === 4 ? Math.min(2, ex.sets) : ex.sets;
  if (!state.logData[key][ex.name]) state.logData[key][ex.name] = [];
  for (let s = 0; s < setsToShow; s++) {
    if (!state.logData[key][ex.name][s]) state.logData[key][ex.name][s] = {};
    state.logData[key][ex.name][s].feel = el.value;
  }
}

function toggleNote(ei) {
  const sessionKey = getSessionKey(state.currentDay);
  const noteKey = sessionKey + '_' + ei;
  if (!state.openNotes) state.openNotes = {};
  state.openNotes[noteKey] = !state.openNotes[noteKey];
  renderLogView();
}

function handleNote(el) {
  const dayObj = state.programme.find(d => d.day === state.currentDay);
  if (!dayObj) return;
  const key = getSessionKey(dayObj.day);
  const ei = parseInt(el.dataset.ex);
  const ex = dayObj.exercises[ei];
  if (!state.logData[key]) state.logData[key] = {};
  if (!state.logData[key]['__notes__']) state.logData[key]['__notes__'] = {};
  state.logData[key]['__notes__'][ex.name] = el.value;
}

function saveSession() { saveState(); showToast('Session logged — ' + getWeekKey()); }

/* ── PR COMPUTATION ── */
function computePRs() {
  const prs = {};
  Object.values(state.logData).forEach(session => {
    Object.entries(session).forEach(([exName, sets]) => {
      sets.forEach(s => {
        if (s && s.kg) {
          const v = parseFloat(s.kg);
          if (!prs[exName] || v > prs[exName]) prs[exName] = v;
        }
      });
    });
  });
  return prs;
}

function findPRWeek(lift, prKg) {
  for (const [key, session] of Object.entries(state.logData)) {
    if (session[lift]) {
      for (const s of session[lift]) {
        if (s && parseFloat(s.kg) === prKg) return key.split('_')[1] || key;
      }
    }
  }
  return '—';
}

/* ── PROGRESS VIEW ── */
function renderProgressView() {
  const prs = computePRs();
  const sessionsLogged = Object.keys(state.logData).length;
  const totalPRs = Object.keys(prs).length;
  const bestBench = prs['Bench Press'] || '—';
  const weekLabel = ['Build', 'Overload', 'Push', 'Deload'][state.week - 1];

  document.getElementById('statsGrid').innerHTML = `
    <div class="stat-card"><div class="stat-label">Position</div><div class="stat-val">C${state.cycle} W${state.week}</div><div class="stat-sub">${weekLabel} phase</div></div>
    <div class="stat-card"><div class="stat-label">Sessions</div><div class="stat-val">${sessionsLogged}</div><div class="stat-sub">logged total</div></div>
    <div class="stat-card"><div class="stat-label">Bench PR</div><div class="stat-val stat-pr">${bestBench}${typeof bestBench === 'number' ? 'kg' : ''}</div><div class="stat-sub">personal record</div></div>
    <div class="stat-card"><div class="stat-label">Lifts tracked</div><div class="stat-val">${totalPRs}</div><div class="stat-sub">with data</div></div>`;

  const allLifts = [];
  state.programme.forEach(d => d.exercises.forEach(ex => { if (!allLifts.includes(ex.name)) allLifts.push(ex.name); }));

  const liftSel = document.getElementById('liftSelector');
  liftSel.innerHTML = '';
  allLifts.forEach(l => {
    const btn = document.createElement('button');
    btn.className = 'lift-btn' + (l === state.currentLift ? ' active' : '');
    btn.textContent = l;
    btn.onclick = () => { state.currentLift = l; renderProgressView(); };
    liftSel.appendChild(btn);
  });

  buildProgressChart();
  buildPRList(prs);
}

let chartInst = null;
function buildProgressChart() {
  const lift = state.currentLift;
  const labels = [], data = [];
  for (let c = 1; c <= state.cycle; c++) {
    for (let w = 1; w <= 4; w++) {
      if (c === state.cycle && w > state.week) break;
      const label = `C${c}W${w}`;
      labels.push(label);
      let best = null;
      Object.entries(state.logData).forEach(([key, session]) => {
        if (key.includes(label)) {
          if (session[lift]) session[lift].forEach(s => {
            if (s && s.kg) { const v = parseFloat(s.kg); if (best === null || v > best) best = v; }
          });
        }
      });
      data.push(best);
    }
  }
  const canvas = document.getElementById('progressChart');
  if (chartInst) { chartInst.destroy(); chartInst = null; }
  chartInst = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: lift, data,
        borderColor: '#1D9E75',
        backgroundColor: 'rgba(29,158,117,0.08)',
        pointBackgroundColor: data.map(function(v){return v ? '#1D9E75' : 'transparent';}),
        pointRadius: data.map(function(v){return v ? 5 : 0;}), tension: .3, fill: true, spanGaps: true,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ctx.parsed.y !== null ? ctx.parsed.y + 'kg' : 'No data' } }
      },
      scales: {
        x: { ticks: { font: { family: 'DM Mono', size: 11 }, maxRotation: 0, autoSkip: true }, grid: { display: false } },
        y: { ticks: { font: { family: 'DM Mono', size: 11 }, callback: v => v + 'kg' }, grid: { color: 'rgba(128,128,128,0.1)' } }
      }
    }
  });
}

function buildPRList(prs) {
  const el = document.getElementById('prList');
  if (!Object.keys(prs).length) {
    el.innerHTML = '<div style="padding:1rem 0;font-family:\'DM Mono\',monospace;font-size:13px;color:var(--text2)">No PRs yet — start logging sessions.</div>';
    return;
  }
  el.innerHTML = Object.entries(prs).map(([lift, kg]) => {
    const wk = findPRWeek(lift, kg);
    return `<div class="pr-row"><div><div class="pr-lift">${lift}</div><div class="pr-week">${wk}</div></div><div class="pr-val">${kg}kg</div></div>`;
  }).join('');
}

/* ── VIEW SWITCHING ── */
function switchView(v) {
  state.currentView = v;
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  document.getElementById('view-' + v).classList.add('active');
  document.querySelectorAll('#mainViewToggle .vt-btn').forEach((btn, i) => {
    btn.classList.toggle('active', (i === 0 && v === 'log') || (i === 1 && v === 'progress'));
  });
  if (v === 'progress') renderProgressView();
  document.getElementById('mainViewToggle').style.display = '';
  document.getElementById('editToggleBtn').textContent = 'Edit plan';
}

function toggleEditView() {
  if (state.currentView === 'edit') { closeEditView(); return; }
  state.prevView = state.currentView;
  state.currentView = 'edit';
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  document.getElementById('view-edit').classList.add('active');
  document.getElementById('mainViewToggle').style.display = 'none';
  document.getElementById('editToggleBtn').textContent = 'Done editing';
  renderEditView();
}

function closeEditView() {
  state.currentView = state.prevView || 'log';
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  document.getElementById('view-' + state.currentView).classList.add('active');
  document.getElementById('mainViewToggle').style.display = '';
  document.getElementById('editToggleBtn').textContent = 'Edit plan';
  saveState();
  buildDayTabs();
  renderLogView();
  if (state.currentView === 'progress') renderProgressView();
}

/* ── EDIT VIEW ── */
function renderEditView() {
  const container = document.getElementById('editDayList');
  container.innerHTML = '';
  state.programme.forEach((dayObj, di) => {
    const isOpen = state.openEditDay === di;
    const isRenaming = state.renamingDay === di;
    const card = document.createElement('div');
    card.className = 'edit-day-card';
    card.innerHTML = `
      <div class="edit-day-header" onclick="toggleEditDay(${di})">
        <div>
          <div class="edit-day-name">${dayObj.day} — ${dayObj.label}</div>
          <div class="edit-day-meta">${dayObj.exercises.length} exercise${dayObj.exercises.length !== 1 ? 's' : ''}</div>
        </div>
        <div class="edit-day-chevron${isOpen ? ' open' : ''}">▼</div>
      </div>
      <div class="edit-day-body${isOpen ? ' open' : ''}">
        ${isRenaming ? `
          <div class="rename-modal">
            <div class="rename-modal-label">Day name</div>
            <input id="renameDay_${di}" value="${dayObj.day}" placeholder="e.g. Monday">
            <div class="rename-modal-label">Session label</div>
            <input id="renameLabel_${di}" value="${dayObj.label}" placeholder="e.g. Push">
            <div class="rename-actions">
              <button class="rename-confirm" onclick="confirmRenameDay(${di})">Save</button>
              <button class="rename-cancel" onclick="cancelRename()">Cancel</button>
            </div>
          </div>` : ''}
        <div class="edit-col-labels">
          <div class="ecl" style="flex:1">Exercise</div>
          <div class="ecl" style="width:72px;text-align:center">Target</div>
          <div class="ecl" style="width:58px;text-align:center">Type</div>
          <div class="ecl" style="width:42px;text-align:center">Sets</div>
          <div style="width:24px"></div>
        </div>
        ${dayObj.exercises.map((ex, ei) => `
          <div class="edit-ex-row">
            <div class="ex-drag">⠿</div>
            <input class="ex-name-input" value="${ex.name}" placeholder="Exercise name" oninput="updateExField(${di},${ei},'name',this.value)">
            <input class="ex-target-input" value="${ex.target}" placeholder="3x5" oninput="updateExField(${di},${ei},'target',this.value)">
            <select class="ex-type-select" onchange="updateExField(${di},${ei},'type',this.value)">
              <option value="compound" ${ex.type === 'compound' ? 'selected' : ''}>Cmpd</option>
              <option value="isolation" ${ex.type === 'isolation' ? 'selected' : ''}>Isol</option>
            </select>
            <input class="ex-sets-input" type="number" inputmode="numeric" min="1" max="10" value="${ex.sets}" oninput="updateExField(${di},${ei},'sets',parseInt(this.value)||3)">
            <button class="ex-del-btn" onclick="deleteExercise(${di},${ei})">×</button>
          </div>`).join('')}
        <button class="add-ex-btn" onclick="addExercise(${di})">+ add exercise</button>
        <div class="edit-day-actions">
          <button class="rename-day-btn" onclick="startRenameDay(${di})">Rename day</button>
          <button class="del-day-btn" onclick="deleteDay(${di})">Remove day</button>
        </div>
      </div>`;
    container.appendChild(card);
  });
}

function toggleEditDay(di) {
  state.openEditDay = state.openEditDay === di ? null : di;
  state.renamingDay = null;
  renderEditView();
}

function updateExField(di, ei, field, val) {
  state.programme[di].exercises[ei][field] = val;
}

function deleteExercise(di, ei) {
  if (state.programme[di].exercises.length <= 1) { showToast('Need at least one exercise'); return; }
  state.programme[di].exercises.splice(ei, 1);
  renderEditView();
}

function addExercise(di) {
  state.programme[di].exercises.push({ name: 'New Exercise', target: '3x10', type: 'isolation', sets: 3 });
  renderEditView();
  setTimeout(() => {
    const inputs = document.querySelectorAll('.ex-name-input');
    const last = inputs[inputs.length - 1];
    if (last) { last.focus(); last.select(); }
  }, 50);
}

function startRenameDay(di) {
  state.renamingDay = di;
  state.openEditDay = di;
  renderEditView();
  setTimeout(() => { const el = document.getElementById('renameDay_' + di); if (el) { el.focus(); el.select(); } }, 50);
}

function cancelRename() { state.renamingDay = null; renderEditView(); }

function confirmRenameDay(di) {
  const newDay = document.getElementById('renameDay_' + di).value.trim();
  const newLabel = document.getElementById('renameLabel_' + di).value.trim();
  if (!newDay) return;
  const old = state.programme[di].day;
  state.programme[di].day = newDay;
  state.programme[di].label = newLabel || newDay;
  if (state.currentDay === old) state.currentDay = newDay;
  const newLogData = {};
  Object.entries(state.logData).forEach(([key, val]) => {
    newLogData[key.startsWith(old + '_') ? key.replace(old + '_', newDay + '_') : key] = val;
  });
  state.logData = newLogData;
  state.renamingDay = null;
  renderEditView();
  showToast('Day renamed');
}

function deleteDay(di) {
  if (state.programme.length <= 1) { showToast('Need at least one training day'); return; }
  const removed = state.programme.splice(di, 1)[0];
  if (state.currentDay === removed.day) state.currentDay = state.programme[0].day;
  state.openEditDay = null;
  renderEditView();
  showToast(removed.day + ' removed');
}

function addDay() {
  const usedDays = state.programme.map(d => d.day);
  const nextDay = ALL_DAYS.find(d => !usedDays.includes(d)) || 'New Day';
  state.programme.push({ day: nextDay, label: 'Session', exercises: [{ name: 'Exercise 1', target: '3x10', type: 'compound', sets: 3 }] });
  state.openEditDay = state.programme.length - 1;
  state.renamingDay = state.programme.length - 1;
  renderEditView();
  setTimeout(() => { const el = document.getElementById('renameDay_' + (state.programme.length - 1)); if (el) { el.focus(); el.select(); } }, 50);
}

/* ── CYCLE / WEEK DROPDOWNS ── */
function updateCycleButtons() {
  document.getElementById('cycleBtn').textContent = 'C' + state.cycle;
  document.getElementById('weekBtn').textContent = 'W' + state.week;
  // mark selected options
  document.querySelectorAll('#cycleDropdown .cw-option').forEach(function(el, i) {
    el.classList.toggle('selected', i + 1 === state.cycle);
  });
  document.querySelectorAll('#weekDropdown .cw-option').forEach(function(el, i) {
    el.classList.toggle('selected', i + 1 === state.week);
  });
}

function toggleDropdown(which, event) {
  event.stopPropagation();
  var cycleDD = document.getElementById('cycleDropdown');
  var weekDD = document.getElementById('weekDropdown');
  var cycleBtn = document.getElementById('cycleBtn');
  var weekBtn = document.getElementById('weekBtn');
  if (which === 'cycle') {
    var isOpen = cycleDD.classList.contains('open');
    cycleDD.classList.toggle('open', !isOpen);
    cycleBtn.classList.toggle('active', !isOpen);
    weekDD.classList.remove('open');
    weekBtn.classList.remove('active');
  } else {
    var isOpen = weekDD.classList.contains('open');
    weekDD.classList.toggle('open', !isOpen);
    weekBtn.classList.toggle('active', !isOpen);
    cycleDD.classList.remove('open');
    cycleBtn.classList.remove('active');
  }
}

function setCycle(c, event) {
  event.stopPropagation();
  state.cycle = c;
  document.getElementById('cycleDropdown').classList.remove('open');
  document.getElementById('cycleBtn').classList.remove('active');
  updateCycleButtons();
  renderLogView();
  if (state.currentView === 'progress') renderProgressView();
  saveState();
  showToast('Cycle ' + c);
}

function setWeek(w, event) {
  event.stopPropagation();
  state.week = w;
  document.getElementById('weekDropdown').classList.remove('open');
  document.getElementById('weekBtn').classList.remove('active');
  updateCycleButtons();
  renderLogView();
  if (state.currentView === 'progress') renderProgressView();
  saveState();
  var labels = ['Build', 'Overload', 'Push', 'Deload'];
  showToast('Week ' + w + ' — ' + labels[w - 1]);
}

// close dropdowns when tapping outside
document.addEventListener('click', function() {
  document.getElementById('cycleDropdown').classList.remove('open');
  document.getElementById('cycleBtn').classList.remove('active');
  document.getElementById('weekDropdown').classList.remove('open');
  document.getElementById('weekBtn').classList.remove('active');
});

/* ── TOAST ── */
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

init();
