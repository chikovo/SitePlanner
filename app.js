/* ═══════════════════════════════════════════════════════════
   SitePlanner — Main Application
   Firebase Auth + Firestore + Storage
   Roles: manager | engineer | viewer
   ═══════════════════════════════════════════════════════════ */

'use strict';

// ─────────────────────────────────────────────────────────────
// 0. FIREBASE INIT
// ─────────────────────────────────────────────────────────────

const FIREBASE_CONFIG = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};

firebase.initializeApp(FIREBASE_CONFIG);

const auth    = firebase.auth();
const db      = firebase.firestore();
const storage = firebase.storage();

// Enable offline persistence
db.enablePersistence({ synchronizeTabs: true }).catch(() => {});

// ─────────────────────────────────────────────────────────────
// 1. APP STATE
// ─────────────────────────────────────────────────────────────

const STATE = {
  currentUser:   null,   // Firebase Auth user
  userProfile:   null,   // Firestore users/{uid} doc
  role:          null,   // 'manager' | 'engineer' | 'viewer'
  units:         [],     // all units array (live from Firestore)
  filteredUnits: [],
  openUnitId:    null,
  activeView:    'map',
  activeTab:     'overview',
  filters: {
    statuses:   new Set(['not_started','in_progress','on_hold','issue_flagged','completed','handed_over']),
    types:      new Set(['A','B','C','D','AP']),
    phase:      '',
    engineer:   '',
    handover:   '',
    myOnly:     false,
    search:     ''
  },
  masterplanUrl: null,
  config: {
    statuses: [],
    phases:   []
  },
  users:         [],
  unsubscribers: []
};

// ─────────────────────────────────────────────────────────────
// 2. DEFAULT CONFIG DATA (seeded to Firestore on first run)
// ─────────────────────────────────────────────────────────────

const DEFAULT_STATUSES = [
  { id: 'not_started',   label: 'Not Started',   color: '#94A3B8', order: 1 },
  { id: 'in_progress',   label: 'In Progress',   color: '#3B82F6', order: 2 },
  { id: 'on_hold',       label: 'On Hold',       color: '#F59E0B', order: 3 },
  { id: 'issue_flagged', label: 'Issue Flagged', color: '#EF4444', order: 4 },
  { id: 'completed',     label: 'Completed',     color: '#10B981', order: 5 },
  { id: 'handed_over',   label: 'Handed Over',   color: '#8B5CF6', order: 6 }
];

const DEFAULT_PHASES = [
  'Plot Preparation / Excavation',
  'Foundation & Footings',
  'Ground Floor Columns & Slabs',
  'Upper Floor Structure',
  'Roof Slab',
  'Blockwork / Masonry',
  'Plumbing & Drainage (MEP Rough-in)',
  'Electrical Conduits (MEP Rough-in)',
  'External Plastering',
  'Internal Plastering',
  'Floor & Wall Tiling',
  'Painting',
  'Doors, Windows & Ironmongery',
  'MEP Final Fix',
  'Landscaping',
  'Final Inspection & Snag List',
  'Handover'
];

// ─────────────────────────────────────────────────────────────
// 3. UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────

function $(id) { return document.getElementById(id); }

function toast(msg, type = 'info') {
  const icons = {
    success: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`,
    error:   `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    info:    `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r=".5" fill="currentColor"/></svg>`
  };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${icons[type] || icons.info}<span class="toast-text">${msg}</span>`;
  $('toastContainer').appendChild(el);
  setTimeout(() => {
    el.classList.add('removing');
    setTimeout(() => el.remove(), 260);
  }, 3500);
}

function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function timeAgo(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60)   return 'just now';
  if (secs < 3600) return `${Math.floor(secs/60)}m ago`;
  if (secs < 86400)return `${Math.floor(secs/3600)}h ago`;
  return `${Math.floor(secs/86400)}d ago`;
}

function initials(name = '') {
  return name.split(' ').slice(0,2).map(p => p[0]).join('').toUpperCase() || '?';
}

function statusInfo(id) {
  return STATE.config.statuses.find(s => s.id === id) ||
         DEFAULT_STATUSES.find(s => s.id === id) ||
         { id, label: id, color: '#94A3B8' };
}

function canEdit(unit) {
  if (!STATE.role) return false;
  if (STATE.role === 'viewer') return false;
  if (STATE.role === 'manager') return true;
  // engineer: only assigned units
  return unit && unit.assignedEngineerId === STATE.currentUser.uid;
}

function logActivity(msg, unitId = null) {
  db.collection('activity').add({
    message: msg,
    unitId,
    userId: STATE.currentUser.uid,
    userName: STATE.userProfile?.name || STATE.currentUser.email,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }).catch(() => {});
}

// ─────────────────────────────────────────────────────────────
// 4. AUTH FLOW
// ─────────────────────────────────────────────────────────────

auth.onAuthStateChanged(async (user) => {
  if (user) {
    STATE.currentUser = user;
    await loadUserProfile(user.uid);
    showApp();
  } else {
    STATE.currentUser = null;
    STATE.userProfile = null;
    STATE.role        = null;
    showLogin();
  }
});

async function loadUserProfile(uid) {
  try {
    const doc = await db.collection('users').doc(uid).get();
    if (doc.exists) {
      STATE.userProfile = doc.data();
      STATE.role        = STATE.userProfile.role || 'viewer';
    } else {
      // First-time manager bootstrap: if no users collection exists yet
      STATE.userProfile = { name: STATE.currentUser.email, role: 'manager' };
      STATE.role        = 'manager';
      await db.collection('users').doc(uid).set({
        name:    STATE.currentUser.email,
        email:   STATE.currentUser.email,
        role:    'manager',
        assignedUnits: [],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  } catch (e) {
    console.error('loadUserProfile:', e);
    STATE.userProfile = { name: STATE.currentUser.email, role: 'viewer' };
    STATE.role        = 'viewer';
  }
}

function showLogin() {
  $('loginScreen').style.display = 'flex';
  $('appRoot').style.display     = 'none';
  unsubscribeAll();
}

function showApp() {
  $('loginScreen').style.display = 'none';
  $('appRoot').style.display     = 'flex';
  applyRoleUI();
  initApp();
}

$('loginBtn').addEventListener('click', doLogin);
$('loginEmail').addEventListener('keydown', e => { if (e.key === 'Enter') $('loginPassword').focus(); });
$('loginPassword').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

async function doLogin() {
  const email = $('loginEmail').value.trim();
  const pass  = $('loginPassword').value;
  $('loginError').style.display = 'none';
  $('loginBtn').textContent = 'Signing in…';
  $('loginBtn').disabled = true;
  try {
    await auth.signInWithEmailAndPassword(email, pass);
  } catch (e) {
    $('loginError').textContent = e.message;
    $('loginError').style.display = 'block';
  } finally {
    $('loginBtn').textContent = 'Sign In';
    $('loginBtn').disabled    = false;
  }
}

$('signOutBtn').addEventListener('click', () => auth.signOut());

// ─────────────────────────────────────────────────────────────
// 5. ROLE-BASED UI
// ─────────────────────────────────────────────────────────────

function applyRoleUI() {
  const p = STATE.userProfile;
  const role = STATE.role;

  // Header user chip
  $('userDisplayName').textContent = p?.name || 'User';
  $('userRoleBadge').textContent   = role ? role.charAt(0).toUpperCase() + role.slice(1) : '';
  $('userAvatar').textContent      = initials(p?.name || '');

  // Manager-only elements
  document.querySelectorAll('.manager-only').forEach(el => {
    el.style.display = role === 'manager' ? '' : 'none';
  });

  // Engineer-only elements
  document.querySelectorAll('.engineer-only').forEach(el => {
    el.style.display = role === 'engineer' ? '' : 'none';
  });
}

// ─────────────────────────────────────────────────────────────
// 6. APP INIT
// ─────────────────────────────────────────────────────────────

async function initApp() {
  await loadConfig();
  await loadMasterplanUrl();
  subscribeUnits();
  subscribeActivity();
  if (STATE.role === 'manager') subscribeUsers();
  buildFilterUI();
  setupEventListeners();
  renderView(STATE.activeView);
}

function unsubscribeAll() {
  STATE.unsubscribers.forEach(fn => fn());
  STATE.unsubscribers = [];
}

// ─────────────────────────────────────────────────────────────
// 7. CONFIG (statuses + phases from Firestore)
// ─────────────────────────────────────────────────────────────

async function loadConfig() {
  try {
    // Seed defaults if not set
    const sDoc = db.collection('config').doc('statuses');
    const pDoc = db.collection('config').doc('phases');
    const [sSnap, pSnap] = await Promise.all([sDoc.get(), pDoc.get()]);

    if (!sSnap.exists) {
      await sDoc.set({ items: DEFAULT_STATUSES });
      STATE.config.statuses = DEFAULT_STATUSES;
    } else {
      STATE.config.statuses = sSnap.data().items || DEFAULT_STATUSES;
    }

    if (!pSnap.exists) {
      await pDoc.set({ items: DEFAULT_PHASES });
      STATE.config.phases = DEFAULT_PHASES;
    } else {
      STATE.config.phases = pSnap.data().items || DEFAULT_PHASES;
    }
  } catch (e) {
    STATE.config.statuses = DEFAULT_STATUSES;
    STATE.config.phases   = DEFAULT_PHASES;
  }
}

// ─────────────────────────────────────────────────────────────
// 8. UNITS — Firestore real-time subscription
// ─────────────────────────────────────────────────────────────

function subscribeUnits() {
  const unsub = db.collection('units')
    .orderBy('unitNumber')
    .onSnapshot(snap => {
      STATE.units = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      applyFilters();
      renderHotspots();
      renderUnitList();
      updateHeaderStats();
      if (STATE.activeView === 'dashboard') renderDashboard();
    }, err => console.error('units snapshot:', err));
  STATE.unsubscribers.push(unsub);
}

// ─────────────────────────────────────────────────────────────
// 9. MASTERPLAN IMAGE
// ─────────────────────────────────────────────────────────────

async function loadMasterplanUrl() {
  try {
    const doc = await db.collection('config').doc('masterplan').get();
    if (doc.exists && doc.data().url) {
      STATE.masterplanUrl = doc.data().url;
      setMasterplanImage(STATE.masterplanUrl);
    }
  } catch (e) { /* no masterplan yet */ }
}

function setMasterplanImage(url) {
  const img   = $('masterplanImg');
  const empty = $('mapEmpty');
  img.src = url;
  img.onload = () => {
    empty.classList.add('hidden');
    renderHotspots();
  };
}

$('loadMapBtn').addEventListener('click', () => $('masterplanInput').click());

$('masterplanInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!['manager'].includes(STATE.role)) { toast('Only managers can upload the masterplan', 'error'); return; }
  toast('Uploading masterplan…', 'info');
  try {
    const ref = storage.ref('masterplan/masterplan');
    await ref.put(file);
    const url = await ref.getDownloadURL();
    await db.collection('config').doc('masterplan').set({ url });
    STATE.masterplanUrl = url;
    setMasterplanImage(url);
    toast('Masterplan uploaded!', 'success');
  } catch (e) {
    toast('Upload failed: ' + e.message, 'error');
  }
  e.target.value = '';
});

// ─────────────────────────────────────────────────────────────
// 10. HOTSPOT RENDERING (SVG overlay)
// ─────────────────────────────────────────────────────────────

function renderHotspots() {
  const svg = $('hotspotSvg');
  if (!svg) return;

  // Clear existing
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  STATE.units.forEach(unit => {
    const hs = unit.hotspot;
    if (!hs || typeof hs.x !== 'number') return;

    const si = statusInfo(unit.status || 'not_started');
    const isFiltered = !STATE.filteredUnits.find(u => u.id === unit.id);

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('data-unit-id', unit.id);
    if (isFiltered) g.classList.add('hs-filtered');

    // Circle
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', hs.x);
    circle.setAttribute('cy', hs.y);
    circle.setAttribute('r', '3.2');
    circle.setAttribute('fill', si.color);
    circle.setAttribute('stroke', 'white');
    circle.setAttribute('stroke-width', '0.7');
    circle.classList.add('hs-circle');

    // Label
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', hs.x);
    text.setAttribute('y', hs.y);
    text.setAttribute('class', 'hs-label');
    text.textContent = unit.unitNumber || unit.id;

    g.appendChild(circle);
    g.appendChild(text);

    // Events
    g.addEventListener('click', () => openUnitPanel(unit.id));
    g.addEventListener('mouseenter', (e) => showTooltip(e, unit));
    g.addEventListener('mouseleave', hideTooltip);

    svg.appendChild(g);
  });

  // If no units yet: show placement mode hint
  if (STATE.units.length === 0 && STATE.masterplanUrl) {
    setupHotspotPlacement();
  }
}

// Tooltip
const tooltip = $('mapTooltip');

function showTooltip(e, unit) {
  const svg = $('hotspotSvg');
  const rect = svg.getBoundingClientRect();
  const hs   = unit.hotspot;
  const x    = (hs.x / 100) * rect.width  + rect.left;
  const y    = (hs.y / 100) * rect.height + rect.top;
  const canvas = $('mapCanvas');
  const cr = canvas.getBoundingClientRect();

  tooltip.style.left = `${x - cr.left}px`;
  tooltip.style.top  = `${y - cr.top}px`;

  const si = statusInfo(unit.status || 'not_started');
  $('ttNum').textContent     = unit.unitNumber || unit.id;
  $('ttType').textContent    = unit.unitType || '—';
  $('ttStatus').textContent  = `Status: ${si.label}`;
  $('ttPhase').textContent   = `Phase: ${unit.currentPhase || 'Not set'}`;
  $('ttEngineer').textContent = unit.assignedEngineerName ? `Eng: ${unit.assignedEngineerName}` : '';
  tooltip.classList.add('visible');
}

function hideTooltip() {
  tooltip.classList.remove('visible');
}

// Click on empty masterplan = place new hotspot (Manager only)
function setupHotspotPlacement() {
  if (STATE.role !== 'manager') return;
  // handled by map click in placement modal
}

// ─────────────────────────────────────────────────────────────
// 11. FILTERS
// ─────────────────────────────────────────────────────────────

function buildFilterUI() {
  // Status filter list from config
  const statusList = $('statusFilterList');
  statusList.innerHTML = '';
  STATE.config.statuses.forEach(s => {
    const label = document.createElement('label');
    label.className = 'fb-check';
    label.innerHTML = `<input type="checkbox" class="sf" data-key="status" value="${s.id}" ${STATE.filters.statuses.has(s.id) ? 'checked' : ''}><span class="dot-s" style="background:${s.color}"></span>${s.label}`;
    statusList.appendChild(label);
  });

  // Legend
  const legendList = $('legendList');
  legendList.innerHTML = '';
  STATE.config.statuses.forEach(s => {
    const row = document.createElement('div');
    row.className = 'leg-row';
    row.innerHTML = `<span class="dot-s" style="background:${s.color}"></span>${s.label}`;
    legendList.appendChild(row);
  });

  // Phase filter
  const phaseFilter = $('phaseFilter');
  phaseFilter.innerHTML = '<option value="">All Phases</option>';
  STATE.config.phases.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p; opt.textContent = p;
    phaseFilter.appendChild(opt);
  });

  // Engineer filter (populated when users load)
  refreshEngineerFilter();
}

function refreshEngineerFilter() {
  const ef = $('engineerFilter');
  if (!ef) return;
  const prev = ef.value;
  ef.innerHTML = '<option value="">All Engineers</option>';
  STATE.users.filter(u => u.role === 'engineer').forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.id; opt.textContent = u.name;
    ef.appendChild(opt);
  });
  ef.value = prev;
}

function applyFilters() {
  let units = [...STATE.units];

  // Status
  units = units.filter(u => STATE.filters.statuses.has(u.status || 'not_started'));

  // Type
  if (STATE.filters.types.size > 0) {
    units = units.filter(u => STATE.filters.types.has(u.unitType?.charAt(u.unitType.length - 1) || 'A'));
  }

  // Phase
  if (STATE.filters.phase) {
    units = units.filter(u => u.currentPhase === STATE.filters.phase);
  }

  // Engineer
  if (STATE.filters.engineer) {
    units = units.filter(u => u.assignedEngineerId === STATE.filters.engineer);
  }

  // Handover
  if (STATE.filters.handover === 'yes') units = units.filter(u => u.engineerHandover?.done);
  if (STATE.filters.handover === 'no')  units = units.filter(u => !u.engineerHandover?.done);

  // My units only (engineer)
  if (STATE.filters.myOnly && STATE.currentUser) {
    units = units.filter(u => u.assignedEngineerId === STATE.currentUser.uid);
  }

  // Search
  if (STATE.filters.search) {
    const q = STATE.filters.search.toLowerCase();
    units = units.filter(u =>
      (u.unitNumber || '').toLowerCase().includes(q) ||
      (u.unitType || '').toLowerCase().includes(q) ||
      (u.assignedEngineerName || '').toLowerCase().includes(q) ||
      (u.contractor || '').toLowerCase().includes(q)
    );
  }

  STATE.filteredUnits = units;
}

// ─────────────────────────────────────────────────────────────
// 12. HEADER STATS
// ─────────────────────────────────────────────────────────────

function updateHeaderStats() {
  const units = STATE.units;
  $('statTotal').textContent      = units.length || 255;
  $('statNotStarted').textContent = units.filter(u => (u.status || 'not_started') === 'not_started').length || '—';
  $('statInProgress').textContent = units.filter(u => u.status === 'in_progress').length || '—';
  $('statCompleted').textContent  = units.filter(u => u.status === 'completed' || u.status === 'handed_over').length || '—';
  $('statOnHold').textContent     = units.filter(u => u.status === 'on_hold' || u.status === 'issue_flagged').length || '—';
}

// ─────────────────────────────────────────────────────────────
// 13. VIEW NAVIGATION
// ─────────────────────────────────────────────────────────────

function renderView(view) {
  STATE.activeView = view;
  document.querySelectorAll('.view-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.vtab').forEach(t => t.classList.remove('active'));

  const pane = document.getElementById('view' + view.charAt(0).toUpperCase() + view.slice(1));
  const tab  = document.getElementById('tab'  + view.charAt(0).toUpperCase() + view.slice(1));

  if (pane) pane.classList.add('active');
  if (tab)  tab.classList.add('active');

  if (view === 'dashboard') renderDashboard();
  if (view === 'list')      renderUnitList();
  if (view === 'users')     renderUsersPage();
}

// ─────────────────────────────────────────────────────────────
// 14. UNIT LIST VIEW
// ─────────────────────────────────────────────────────────────

function renderUnitList() {
  if (STATE.activeView !== 'list') return;
  const tbody = $('tblBody');
  if (!tbody) return;

  const sortKey = $('listSort')?.value || 'number';
  const search  = $('listSearch')?.value.toLowerCase() || '';

  let units = [...STATE.filteredUnits];

  // Local search in list
  if (search) {
    units = units.filter(u =>
      Object.values(u).some(v => String(v).toLowerCase().includes(search))
    );
  }

  // Sort
  units.sort((a, b) => {
    if (sortKey === 'number')   return (a.unitNumber || '').localeCompare(b.unitNumber || '');
    if (sortKey === 'status')   return (a.status || '').localeCompare(b.status || '');
    if (sortKey === 'phase')    return (a.currentPhase || '').localeCompare(b.currentPhase || '');
    if (sortKey === 'engineer') return (a.assignedEngineerName || '').localeCompare(b.assignedEngineerName || '');
    return 0;
  });

  if (units.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-muted)">No units match your filters</td></tr>`;
    return;
  }

  tbody.innerHTML = units.map(u => {
    const si = statusInfo(u.status || 'not_started');
    return `
    <tr>
      <td class="tbl-num">${u.unitNumber || u.id}</td>
      <td>${u.unitType || '—'}</td>
      <td><span class="status-pill sp-${u.status || 'not_started'}" style="--sc:${si.color}">${si.label}</span></td>
      <td>${u.currentPhase || '—'}</td>
      <td>${u.assignedEngineerName || '—'}</td>
      <td>${u.contractor || '—'}</td>
      <td>${u.engineerHandover?.done ? `<span style="color:var(--success);font-weight:600">✓ ${formatDate(u.engineerHandover.date)}</span>` : '<span style="color:var(--text-muted)">Pending</span>'}</td>
      <td>${u._issueCount ? `<span style="color:var(--danger);font-weight:700">${u._issueCount}</span>` : '—'}</td>
      <td><button class="tbl-open-btn" onclick="openUnitPanel('${u.id}')">Open</button></td>
    </tr>`;
  }).join('');
}

// ─────────────────────────────────────────────────────────────
// 15. DASHBOARD VIEW
// ─────────────────────────────────────────────────────────────

function renderDashboard() {
  renderDashStats();
  renderProgressRing();
  renderPhaseBreakdown();
  renderEngWorkload();
}

function renderDashStats() {
  const units = STATE.units;
  const counts = {};
  STATE.config.statuses.forEach(s => { counts[s.id] = 0; });
  units.forEach(u => { const key = u.status || 'not_started'; if (counts[key] !== undefined) counts[key]++; });

  const total = units.length || 1;
  $('dashStatsRow').innerHTML = STATE.config.statuses.map(s => {
    const count = counts[s.id] || 0;
    const pct   = Math.round((count / total) * 100);
    return `
    <div class="ds-chip">
      <span class="ds-num" style="color:${s.color}">${count}</span>
      <span class="ds-lbl">${s.label}</span>
      <div class="ds-bar"><div class="ds-bar-fill" style="width:${pct}%;background:${s.color}"></div></div>
    </div>`;
  }).join('');
}

function renderProgressRing() {
  const units = STATE.units;
  const done  = units.filter(u => u.status === 'completed' || u.status === 'handed_over').length;
  const total = units.length || 255;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

  $('progPct').textContent = pct + '%';
  const ring   = $('ringFill');
  const r      = 58;
  const circ   = 2 * Math.PI * r;
  ring.style.strokeDasharray  = `${circ}`;
  ring.style.strokeDashoffset = `${circ - (circ * pct / 100)}`;
}

function renderPhaseBreakdown() {
  const phaseMap = {};
  STATE.units.forEach(u => {
    const p = u.currentPhase || 'Not Set';
    phaseMap[p] = (phaseMap[p] || 0) + 1;
  });

  const max   = Math.max(...Object.values(phaseMap), 1);
  const sorted = Object.entries(phaseMap).sort((a,b) => b[1] - a[1]).slice(0, 10);

  $('phaseBreakdown').innerHTML = sorted.map(([phase, count]) => `
    <div class="phase-bar-row">
      <span class="phase-bar-label" title="${phase}">${phase}</span>
      <div class="phase-bar-track"><div class="phase-bar-fill" style="width:${(count/max)*100}%"></div></div>
      <span class="phase-bar-count">${count}</span>
    </div>
  `).join('') || '<p style="color:var(--text-muted);font-size:13px">No data yet</p>';
}

function renderEngWorkload() {
  const engMap = {};
  STATE.units.forEach(u => {
    if (u.assignedEngineerName) {
      engMap[u.assignedEngineerName] = (engMap[u.assignedEngineerName] || 0) + 1;
    }
  });
  const sorted = Object.entries(engMap).sort((a,b) => b[1] - a[1]);
  $('engWorkload').innerHTML = sorted.map(([name, count]) => `
    <div class="eng-row">
      <div class="eng-av">${initials(name)}</div>
      <span class="eng-name">${name}</span>
      <span class="eng-count">${count} units</span>
    </div>
  `).join('') || '<p style="color:var(--text-muted);font-size:13px">No engineers assigned</p>';
}

// ─────────────────────────────────────────────────────────────
// 16. ACTIVITY FEED
// ─────────────────────────────────────────────────────────────

function subscribeActivity() {
  const unsub = db.collection('activity')
    .orderBy('createdAt', 'desc')
    .limit(50)
    .onSnapshot(snap => {
      const items = snap.docs.map(d => d.data());
      renderActivityLog(items);
    }, () => {});
  STATE.unsubscribers.push(unsub);
}

function renderActivityLog(items) {
  const el = $('activityLog');
  if (!el) return;
  if (items.length === 0) {
    el.innerHTML = '<p style="color:var(--text-muted);font-size:13px">No activity yet</p>';
    return;
  }
  el.innerHTML = items.map(item => `
    <div class="act-item">
      <div class="act-dot"></div>
      <div class="act-text" style="flex:1">
        <strong>${item.userName || 'User'}</strong> ${item.message}
        ${item.unitId ? `<span style="color:var(--brand-secondary)"> · ${item.unitId}</span>` : ''}
      </div>
      <span class="act-time">${timeAgo(item.createdAt)}</span>
    </div>
  `).join('');
}

// ─────────────────────────────────────────────────────────────
// 17. UNIT PANEL
// ─────────────────────────────────────────────────────────────

async function openUnitPanel(unitId) {
  STATE.openUnitId = unitId;
  const unit = STATE.units.find(u => u.id === unitId);
  if (!unit) return;

  // Header
  $('pBadge').textContent = unit.unitNumber || unit.id;
  $('pTitle').textContent = `Unit ${unit.unitNumber || unit.id}`;
  $('pSub').textContent   = unit.unitType ? `${unit.unitType}` : '—';

  // Status strip
  const si = statusInfo(unit.status || 'not_started');
  $('pStatusPill').className   = `status-pill sp-${unit.status || 'not_started'}`;
  $('pStatusPill').style.color = si.color;
  $('pStatusPill').textContent = si.label;

  const ho = unit.engineerHandover;
  $('pHandoverText').textContent = ho?.done ? `Handed Over — ${formatDate(ho.date)}` : 'Not Handed Over';

  // Edit button — show only if user can edit
  $('pEditBtn').style.display = canEdit(unit) ? '' : 'none';

  // Open panel
  $('unitPanel').classList.add('open');
  $('backdrop').classList.add('visible');

  // Render active tab
  await renderPanelTab(STATE.activeTab, unit);
}

async function renderPanelTab(tab, unit) {
  STATE.activeTab = tab;
  document.querySelectorAll('.ptab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));

  const body = $('panelBody');

  switch(tab) {
    case 'overview':  renderOverview(body, unit); break;
    case 'phases':    await renderPhases(body, unit); break;
    case 'photos':    await renderPhotos(body, unit); break;
    case 'drawings':  await renderDrawings(body, unit); break;
    case 'comments':  await renderComments(body, unit); break;
    case 'issues':    await renderIssues(body, unit); break;
  }
}

function closePanelFn() {
  $('unitPanel').classList.remove('open');
  $('backdrop').classList.remove('visible');
  STATE.openUnitId = null;
}

// ─── Overview Tab ───

function renderOverview(body, unit) {
  const si  = statusInfo(unit.status || 'not_started');
  const ho  = unit.engineerHandover;
  const edit = canEdit(unit);

  body.innerHTML = `
    <div class="ov-section">
      <div class="ov-section-title">Identity</div>
      <div class="ov-grid">
        <div class="ov-field"><label>Unit Number</label><span>${unit.unitNumber || '—'}</span></div>
        <div class="ov-field"><label>Unit Type</label><span>${unit.unitType || '—'}</span></div>
        <div class="ov-field"><label>Block / Cluster</label><span>${unit.block || '—'}</span></div>
        <div class="ov-field"><label>Status</label>
          <span class="status-pill sp-${unit.status || 'not_started'}">${si.label}</span>
        </div>
      </div>
    </div>

    <div class="ov-section">
      <div class="ov-section-title">Construction Phase</div>
      <div class="ov-grid">
        <div class="ov-field full"><label>Current Phase</label><span>${unit.currentPhase || 'Not set'}</span></div>
        <div class="ov-field full"><label>Ready For Next Phase</label><span>${unit.readyForPhase || '—'}</span></div>
      </div>
    </div>

    <div class="ov-section">
      <div class="ov-section-title">Assignment</div>
      <div class="ov-grid">
        <div class="ov-field"><label>Assigned Engineer</label><span>${unit.assignedEngineerName || '—'}</span></div>
        <div class="ov-field"><label>Contractor</label><span>${unit.contractor || '—'}</span></div>
        <div class="ov-field full"><label>Supervisor</label><span>${unit.supervisor || '—'}</span></div>
      </div>
    </div>

    <div class="ov-section">
      <div class="ov-section-title">Engineer Handover</div>
      <div class="ho-block">
        <div class="ho-info">
          ${ho?.done
            ? `Signed off by <strong>${ho.signedBy || '—'}</strong><br><small>${formatDate(ho.date)}</small>`
            : 'Not yet handed over to engineer'}
        </div>
        <div>
          <span class="ho-status ${ho?.done ? 'done' : 'pending'}">${ho?.done ? '✓ Done' : 'Pending'}</span>
          ${edit && !ho?.done ? `<br><button class="btn-outline" style="font-size:11px;margin-top:6px;padding:4px 8px" onclick="markHandover('${unit.id}')">Mark Handed Over</button>` : ''}
        </div>
      </div>
    </div>

    <div class="ov-section">
      <div class="ov-section-title">Dates</div>
      <div class="ov-grid">
        <div class="ov-field"><label>Created</label><span>${formatDate(unit.createdAt)}</span></div>
        <div class="ov-field"><label>Last Updated</label><span>${formatDate(unit.updatedAt)}</span></div>
      </div>
    </div>
  `;
}

window.markHandover = async function(unitId) {
  const unit = STATE.units.find(u => u.id === unitId);
  if (!unit || !canEdit(unit)) return;
  try {
    await db.collection('units').doc(unitId).update({
      engineerHandover: {
        done: true,
        date: firebase.firestore.FieldValue.serverTimestamp(),
        signedBy: STATE.userProfile?.name || STATE.currentUser.email
      },
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    logActivity('marked handover complete', unitId);
    toast('Handover marked complete', 'success');
    openUnitPanel(unitId);
  } catch(e) {
    toast('Failed: ' + e.message, 'error');
  }
};

// ─── Phases Tab ───

async function renderPhases(body, unit) {
  body.innerHTML = '<div style="padding:16px;color:var(--text-muted);font-size:13px">Loading phases…</div>';

  let phaseLog = [];
  try {
    const snap = await db.collection('units').doc(unit.id).collection('phases').orderBy('order').get();
    phaseLog = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e) {}

  const edit = canEdit(unit);

  body.innerHTML = `
    <div style="padding:14px 18px;border-bottom:1px solid var(--border-light);display:flex;align-items:center;justify-content:space-between">
      <span style="font-size:13px;font-weight:600;color:var(--text-secondary)">Phase History</span>
      ${edit ? `<button class="btn-outline" style="font-size:12px;padding:6px 12px" id="logPhaseBtn">Log Phase Completion</button>` : ''}
    </div>
    <div class="phase-log" id="phaseLogBody">
      ${STATE.config.phases.map((phase, i) => {
        const done = phaseLog.find(p => p.phaseName === phase);
        const isCurrent = unit.currentPhase === phase;
        return `
        <div class="pl-item">
          <div class="pl-dot ${done ? 'done' : isCurrent ? 'current' : 'pending'}"></div>
          <span class="pl-name">${phase}</span>
          ${done
            ? `<span class="pl-date">${formatDate(done.completedAt)}</span>
               <span class="pl-who">${done.completedBy || ''}</span>`
            : isCurrent
              ? `<span class="pl-date" style="color:var(--brand-secondary);font-weight:600">In Progress</span>`
              : ''}
        </div>`;
      }).join('')}
    </div>
  `;

  if (edit) {
    $('logPhaseBtn')?.addEventListener('click', () => showLogPhaseModal(unit));
  }
}

async function showLogPhaseModal(unit) {
  const phases = STATE.config.phases;
  showEditModal('Log Phase Completion', `
    <div class="form-group">
      <label class="form-label">Phase Completed</label>
      <select id="mPhase" class="form-input">
        ${phases.map(p => `<option value="${p}" ${p === unit.currentPhase ? 'selected' : ''}>${p}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Notes</label>
      <textarea id="mPhaseNotes" class="form-input" placeholder="Any notes about this phase…"></textarea>
    </div>
  `, async () => {
    const phaseName = $('mPhase').value;
    const notes     = $('mPhaseNotes').value.trim();
    const phaseIdx  = phases.indexOf(phaseName);
    const nextPhase = phases[phaseIdx + 1] || null;

    try {
      const phaseRef = db.collection('units').doc(unit.id).collection('phases');
      await phaseRef.add({
        phaseName,
        notes,
        order: phaseIdx,
        completedAt: firebase.firestore.FieldValue.serverTimestamp(),
        completedBy: STATE.userProfile?.name || STATE.currentUser.email
      });
      await db.collection('units').doc(unit.id).update({
        currentPhase: nextPhase || phaseName,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      logActivity(`completed phase "${phaseName}"`, unit.id);
      toast(`Phase "${phaseName}" logged`, 'success');
      closeModal();
      openUnitPanel(unit.id);
      renderPanelTab('phases', STATE.units.find(u => u.id === unit.id) || unit);
    } catch(e) {
      toast('Failed: ' + e.message, 'error');
    }
  });
}

// ─── Photos Tab ───

async function renderPhotos(body, unit) {
  body.innerHTML = '<div style="padding:16px;color:var(--text-muted);font-size:13px">Loading photos…</div>';

  let photos = [];
  try {
    const snap = await db.collection('units').doc(unit.id).collection('photos').orderBy('uploadedAt', 'desc').get();
    photos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e) {}

  const edit = canEdit(unit);

  body.innerHTML = `
    <div class="photos-toolbar">
      ${edit ? `
        <label class="btn-upload" for="photoUploadInput">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Upload Photos
        </label>
        <input type="file" id="photoUploadInput" accept="image/*" multiple style="display:none" />
        <div class="upload-progress" id="photoProgress"><div class="upload-progress-fill" id="photoProgressFill"></div></div>
      ` : ''}
    </div>
    <div class="photo-grid" id="photoGrid">
      ${photos.length > 0
        ? photos.map(p => `
          <div class="photo-thumb" onclick="openLightbox('${p.url}','${p.caption || p.originalName || ''}')">
            <img src="${p.url}" alt="${p.caption || 'Site photo'}" loading="lazy" />
            <div class="photo-meta">
              <div>${p.caption || p.originalName || ''}</div>
              <div>${p.uploadedBy || ''} · ${timeAgo(p.uploadedAt)}</div>
            </div>
          </div>`).join('')
        : '<div class="photo-empty" style="grid-column:1/-1">No photos yet</div>'
      }
    </div>
  `;

  if (edit) {
    $('photoUploadInput')?.addEventListener('change', (e) => uploadPhotos(e, unit));
  }
}

async function uploadPhotos(e, unit) {
  const files = Array.from(e.target.files);
  if (!files.length) return;

  const progressEl     = $('photoProgress');
  const progressFillEl = $('photoProgressFill');
  progressEl.classList.add('visible');

  let done = 0;
  for (const file of files) {
    const name = `units/${unit.id}/photos/${Date.now()}_${file.name}`;
    const ref  = storage.ref(name);
    const task = ref.put(file);

    await new Promise((res, rej) => {
      task.on('state_changed',
        snap => {
          const totalProgress = ((done + snap.bytesTransferred / snap.totalBytes) / files.length) * 100;
          progressFillEl.style.width = totalProgress + '%';
        },
        rej,
        async () => {
          const url = await ref.getDownloadURL();
          await db.collection('units').doc(unit.id).collection('photos').add({
            url,
            originalName: file.name,
            caption: '',
            uploadedBy:  STATE.userProfile?.name || STATE.currentUser.email,
            uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          done++;
          res();
        }
      );
    });
  }

  logActivity(`uploaded ${files.length} photo(s)`, unit.id);
  toast(`${files.length} photo(s) uploaded`, 'success');
  progressEl.classList.remove('visible');
  e.target.value = '';
  await renderPhotos($('panelBody'), unit);
}

// Lightbox
window.openLightbox = function(url, caption) {
  $('lightboxImg').src = url;
  $('lightboxCaption').textContent = caption;
  $('lightbox').classList.add('open');
};
$('lightboxClose')?.addEventListener('click', () => $('lightbox').classList.remove('open'));
$('lightboxBackdrop')?.addEventListener('click', () => $('lightbox').classList.remove('open'));

// ─── Drawings Tab ───

async function renderDrawings(body, unit) {
  body.innerHTML = '<div style="padding:16px;color:var(--text-muted);font-size:13px">Loading drawings…</div>';

  let drawings = [];
  try {
    const snap = await db.collection('units').doc(unit.id).collection('drawings').orderBy('uploadedAt', 'desc').get();
    drawings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e) {}

  const edit = canEdit(unit);
  const drawingTypes = ['Foundation Plan','Column Layout','Ground Floor Plan','1st Floor Plan','2nd Floor Plan','Roof Plan','Section A-A','Section B-B','Elevation North','Elevation South','Elevation East','Elevation West'];

  body.innerHTML = `
    <div class="drawings-toolbar">
      ${edit ? `
        <select id="drawingTypeSelect" class="fb-select" style="flex:1">
          ${drawingTypes.map(t => `<option value="${t}">${t}</option>`).join('')}
        </select>
        <label class="btn-upload" for="drawingUploadInput">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Upload PDF
        </label>
        <input type="file" id="drawingUploadInput" accept=".pdf,application/pdf" style="display:none" />
        <div class="upload-progress" id="drawingProgress"><div class="upload-progress-fill" id="drawingProgressFill"></div></div>
      ` : ''}
    </div>
    <div class="drawing-list" id="drawingList">
      ${drawings.length > 0
        ? drawings.map(d => `
          <div class="drawing-item">
            <div class="drawing-icon">PDF</div>
            <div>
              <div class="drawing-name">${d.drawingType || d.originalName}</div>
              <div class="drawing-rev">${d.originalName} · Rev ${d.revision || 1} · ${timeAgo(d.uploadedAt)}</div>
              <div class="drawing-rev">${d.uploadedBy || ''}</div>
            </div>
            <a class="drawing-open" href="${d.url}" target="_blank" rel="noopener">Open</a>
          </div>`).join('')
        : '<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:13px">No drawings uploaded</div>'
      }
    </div>
  `;

  if (edit) {
    $('drawingUploadInput')?.addEventListener('change', (e) => uploadDrawing(e, unit));
  }
}

async function uploadDrawing(e, unit) {
  const file = e.target.files[0];
  if (!file) return;
  const dtype = $('drawingTypeSelect')?.value || 'Drawing';

  const progressEl     = $('drawingProgress');
  const progressFillEl = $('drawingProgressFill');
  progressEl.classList.add('visible');

  // Get existing drawings of this type to determine revision
  const existing = await db.collection('units').doc(unit.id).collection('drawings')
    .where('drawingType', '==', dtype).get();
  const revision = existing.size + 1;

  const name = `units/${unit.id}/drawings/${Date.now()}_${file.name}`;
  const ref  = storage.ref(name);
  const task = ref.put(file);

  task.on('state_changed',
    snap => { progressFillEl.style.width = (snap.bytesTransferred / snap.totalBytes * 100) + '%'; },
    err  => { toast('Upload failed: ' + err.message, 'error'); progressEl.classList.remove('visible'); },
    async () => {
      const url = await ref.getDownloadURL();
      await db.collection('units').doc(unit.id).collection('drawings').add({
        url,
        drawingType: dtype,
        originalName: file.name,
        revision,
        uploadedBy:  STATE.userProfile?.name || STATE.currentUser.email,
        uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      logActivity(`uploaded drawing "${dtype}" (Rev ${revision})`, unit.id);
      toast(`Drawing "${dtype}" uploaded (Rev ${revision})`, 'success');
      progressEl.classList.remove('visible');
      e.target.value = '';
      await renderDrawings($('panelBody'), unit);
    }
  );
}

// ─── Comments Tab ───

async function renderComments(body, unit) {
  body.innerHTML = '<div style="padding:16px;color:var(--text-muted);font-size:13px">Loading comments…</div>';

  let comments = [];
  try {
    const snap = await db.collection('units').doc(unit.id).collection('comments')
      .orderBy('createdAt').get();
    comments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e) {}

  const edit = STATE.role !== 'viewer';

  body.style.display = 'flex';
  body.style.flexDirection = 'column';
  body.innerHTML = `
    <div class="comments-list" id="commentsListInner">
      ${comments.length > 0
        ? comments.map(c => `
          <div class="comment-item">
            <div class="comment-av">${initials(c.author || '')}</div>
            <div class="comment-body">
              <div class="comment-hdr">
                <span class="comment-author">${c.author || 'Unknown'}</span>
                <span class="comment-time">${timeAgo(c.createdAt)}</span>
              </div>
              <div class="comment-text">${escapeHtml(c.text)}</div>
            </div>
          </div>`).join('')
        : '<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:13px">No comments yet — be the first!</div>'
      }
    </div>
    ${edit ? `
    <div class="comments-box">
      <textarea id="commentInput" class="comment-input" placeholder="Add a comment…" rows="2"></textarea>
      <button class="btn-primary" id="sendCommentBtn" style="height:38px;padding:0 14px;align-self:flex-end">Send</button>
    </div>
    ` : ''}
  `;

  // Scroll to bottom
  const list = $('commentsListInner');
  if (list) list.scrollTop = list.scrollHeight;

  if (edit) {
    $('sendCommentBtn')?.addEventListener('click', () => sendComment(unit));
    $('commentInput')?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment(unit); }
    });
  }
}

async function sendComment(unit) {
  const input = $('commentInput');
  const text  = input?.value.trim();
  if (!text) return;
  input.value = '';

  try {
    await db.collection('units').doc(unit.id).collection('comments').add({
      text,
      author: STATE.userProfile?.name || STATE.currentUser.email,
      userId: STATE.currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    logActivity(`commented on unit`, unit.id);
    await renderComments($('panelBody'), unit);
  } catch(e) {
    toast('Failed to send: ' + e.message, 'error');
  }
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─── Issues Tab ───

async function renderIssues(body, unit) {
  body.innerHTML = '<div style="padding:16px;color:var(--text-muted);font-size:13px">Loading issues…</div>';

  let issues = [];
  try {
    const snap = await db.collection('units').doc(unit.id).collection('issues')
      .orderBy('createdAt', 'desc').get();
    issues = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e) {}

  const edit = canEdit(unit);

  body.innerHTML = `
    <div class="issues-toolbar">
      ${edit ? `<button class="btn-outline" id="addIssueBtn" style="font-size:12px;padding:6px 12px">+ Flag New Issue</button>` : ''}
    </div>
    <div class="issues-list" id="issuesListBody">
      ${issues.length > 0
        ? issues.map(issue => `
          <div class="issue-card">
            <div class="issue-card-hdr">
              <span class="issue-card-title">${escapeHtml(issue.title)}</span>
              <span class="issue-sev sev-${issue.severity || 'medium'}">${issue.severity || 'medium'}</span>
            </div>
            <div class="issue-desc">${escapeHtml(issue.description || '')}</div>
            <div class="issue-card-footer">
              <span>${issue.reportedBy || ''} · ${timeAgo(issue.createdAt)}</span>
              <span class="issue-res ${issue.resolved ? 'resolved' : 'open'}">
                ${issue.resolved ? '✓ Resolved' : '● Open'}
                ${edit && !issue.resolved ? `<button onclick="resolveIssue('${unit.id}','${issue.id}')" style="margin-left:8px;font-size:10px;padding:2px 6px;border:1px solid var(--success);border-radius:4px;color:var(--success);background:none;cursor:pointer">Resolve</button>` : ''}
              </span>
            </div>
          </div>`).join('')
        : '<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:13px">No issues flagged</div>'
      }
    </div>
  `;

  if (edit) {
    $('addIssueBtn')?.addEventListener('click', () => showAddIssueModal(unit));
  }
}

function showAddIssueModal(unit) {
  showEditModal('Flag New Issue', `
    <div class="form-group">
      <label class="form-label">Issue Title</label>
      <input type="text" id="issueTitle" class="form-input" placeholder="e.g. Foundation crack in corner" />
    </div>
    <div class="form-group">
      <label class="form-label">Description</label>
      <textarea id="issueDesc" class="form-input" placeholder="Describe the issue in detail…"></textarea>
    </div>
    <div class="form-group">
      <label class="form-label">Severity</label>
      <select id="issueSev" class="form-input">
        <option value="low">Low</option>
        <option value="medium" selected>Medium</option>
        <option value="high">High</option>
      </select>
    </div>
  `, async () => {
    const title = $('issueTitle').value.trim();
    const desc  = $('issueDesc').value.trim();
    const sev   = $('issueSev').value;
    if (!title) { toast('Please enter a title', 'error'); return; }
    try {
      await db.collection('units').doc(unit.id).collection('issues').add({
        title, description: desc, severity: sev,
        resolved: false,
        reportedBy: STATE.userProfile?.name || STATE.currentUser.email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Update unit status to issue_flagged if high severity
      if (sev === 'high') {
        await db.collection('units').doc(unit.id).update({
          status: 'issue_flagged',
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }

      logActivity(`flagged issue "${title}"`, unit.id);
      toast('Issue flagged', 'success');
      closeModal();
      renderIssues($('panelBody'), STATE.units.find(u => u.id === unit.id) || unit);
    } catch(e) {
      toast('Failed: ' + e.message, 'error');
    }
  });
}

window.resolveIssue = async function(unitId, issueId) {
  try {
    await db.collection('units').doc(unitId).collection('issues').doc(issueId).update({
      resolved: true,
      resolvedBy: STATE.userProfile?.name || STATE.currentUser.email,
      resolvedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    logActivity('resolved an issue', unitId);
    toast('Issue resolved', 'success');
    const unit = STATE.units.find(u => u.id === unitId);
    if (unit) renderIssues($('panelBody'), unit);
  } catch(e) {
    toast('Failed: ' + e.message, 'error');
  }
};

// ─────────────────────────────────────────────────────────────
// 18. EDIT UNIT MODAL
// ─────────────────────────────────────────────────────────────

$('pEditBtn')?.addEventListener('click', () => {
  const unit = STATE.units.find(u => u.id === STATE.openUnitId);
  if (!unit) return;
  showUnitEditModal(unit);
});

function showUnitEditModal(unit) {
  const phaseOpts = STATE.config.phases.map(p =>
    `<option value="${p}" ${p === unit.currentPhase ? 'selected' : ''}>${p}</option>`
  ).join('');

  const statusOpts = STATE.config.statuses.map(s =>
    `<option value="${s.id}" ${s.id === unit.status ? 'selected' : ''}>${s.label}</option>`
  ).join('');

  const engOpts = STATE.users.filter(u => u.role === 'engineer').map(u =>
    `<option value="${u.id}" ${u.id === unit.assignedEngineerId ? 'selected' : ''}>${u.name}</option>`
  ).join('');

  showEditModal(`Edit Unit ${unit.unitNumber || unit.id}`, `
    <div class="form-section-title">Identity</div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Unit Number</label>
        <input type="text" id="euNum" class="form-input" value="${unit.unitNumber || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Unit Type</label>
        <input type="text" id="euType" class="form-input" value="${unit.unitType || ''}" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Block / Cluster</label>
      <input type="text" id="euBlock" class="form-input" value="${unit.block || ''}" />
    </div>

    <div class="form-section-title">Status & Phase</div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Status</label>
        <select id="euStatus" class="form-input">${statusOpts}</select>
      </div>
      <div class="form-group">
        <label class="form-label">Current Phase</label>
        <select id="euPhase" class="form-input">${phaseOpts}</select>
      </div>
    </div>

    <div class="form-section-title">Assignment</div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Assigned Engineer</label>
        <select id="euEng" class="form-input">
          <option value="">— None —</option>
          ${engOpts}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Contractor</label>
        <input type="text" id="euContractor" class="form-input" value="${unit.contractor || ''}" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Supervisor</label>
      <input type="text" id="euSupervisor" class="form-input" value="${unit.supervisor || ''}" />
    </div>
  `, async () => {
    const engId   = $('euEng').value;
    const engUser = STATE.users.find(u => u.id === engId);
    try {
      await db.collection('units').doc(unit.id).update({
        unitNumber:          $('euNum').value.trim(),
        unitType:            $('euType').value.trim(),
        block:               $('euBlock').value.trim(),
        status:              $('euStatus').value,
        currentPhase:        $('euPhase').value,
        assignedEngineerId:  engId || null,
        assignedEngineerName: engUser?.name || null,
        contractor:          $('euContractor').value.trim(),
        supervisor:          $('euSupervisor').value.trim(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      logActivity(`updated unit details`, unit.id);
      toast('Unit updated', 'success');
      closeModal();
      openUnitPanel(unit.id);
    } catch(e) {
      toast('Failed: ' + e.message, 'error');
    }
  });
}

// Generic modal helper
let _modalSaveFn = null;

function showEditModal(title, bodyHtml, saveFn) {
  $('modalTitle').textContent = title;
  $('modalBody').innerHTML    = bodyHtml;
  _modalSaveFn = saveFn;
  $('editModal').classList.add('open');
}

function closeModal() {
  $('editModal').classList.remove('open');
  $('addUserModal').classList.remove('open');
  _modalSaveFn = null;
}

$('modalSave')?.addEventListener('click',   () => _modalSaveFn && _modalSaveFn());
$('modalCancel')?.addEventListener('click', closeModal);
$('modalClose')?.addEventListener('click',  closeModal);

// ─────────────────────────────────────────────────────────────
// 19. USERS PAGE (Manager only)
// ─────────────────────────────────────────────────────────────

function subscribeUsers() {
  const unsub = db.collection('users').onSnapshot(snap => {
    STATE.users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    refreshEngineerFilter();
    if (STATE.activeView === 'users') renderUsersPage();
  }, () => {});
  STATE.unsubscribers.push(unsub);
}

function renderUsersPage() {
  const grid = $('usersGrid');
  if (!grid) return;

  if (STATE.users.length === 0) {
    grid.innerHTML = '<p style="color:var(--text-muted);font-size:13px">No users yet. Add the first user.</p>';
    return;
  }

  grid.innerHTML = STATE.users.map(u => {
    const unitCount = STATE.units.filter(un => un.assignedEngineerId === u.id).length;
    return `
    <div class="user-card">
      <div class="uc-avatar" style="background:${roleColor(u.role)}">${initials(u.name || u.email)}</div>
      <div class="uc-info">
        <div class="uc-name">${u.name || '—'}</div>
        <div class="uc-email">${u.email || '—'}</div>
        <span class="uc-role ${u.role}">${u.role}</span>
        ${u.role === 'engineer' ? `<div class="uc-units">${unitCount} unit(s) assigned</div>` : ''}
      </div>
      <div class="uc-actions">
        <button class="uc-btn" onclick="editUser('${u.id}')">Edit Role</button>
        ${u.id !== STATE.currentUser?.uid
          ? `<button class="uc-btn danger" onclick="deleteUser('${u.id}','${u.name || u.email}')">Remove</button>`
          : ''}
      </div>
    </div>`;
  }).join('');
}

function roleColor(role) {
  return { manager: '#7C3AED', engineer: '#1D4ED8', viewer: '#15803D' }[role] || '#64748B';
}

window.editUser = function(uid) {
  const user = STATE.users.find(u => u.id === uid);
  if (!user) return;
  showEditModal(`Edit Role — ${user.name || user.email}`, `
    <div class="form-group">
      <label class="form-label">Role</label>
      <select id="editUserRole" class="form-input">
        <option value="engineer" ${user.role === 'engineer' ? 'selected' : ''}>Engineer</option>
        <option value="viewer"   ${user.role === 'viewer'   ? 'selected' : ''}>Viewer</option>
        <option value="manager"  ${user.role === 'manager'  ? 'selected' : ''}>Manager</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Full Name</label>
      <input type="text" id="editUserName" class="form-input" value="${user.name || ''}" />
    </div>
  `, async () => {
    try {
      await db.collection('users').doc(uid).update({
        role: $('editUserRole').value,
        name: $('editUserName').value.trim()
      });
      toast('User updated', 'success');
      closeModal();
    } catch(e) {
      toast('Failed: ' + e.message, 'error');
    }
  });
};

window.deleteUser = function(uid, name) {
  if (!confirm(`Remove user "${name}"? They will lose access but their data is preserved.`)) return;
  db.collection('users').doc(uid).delete()
    .then(() => toast('User removed', 'success'))
    .catch(e => toast('Failed: ' + e.message, 'error'));
};

// Add User Modal
$('addUserBtn')?.addEventListener('click', () => $('addUserModal').classList.add('open'));
$('addUserModalClose')?.addEventListener('click', closeModal);
$('addUserCancel')?.addEventListener('click', closeModal);

$('addUserSave')?.addEventListener('click', async () => {
  const name  = $('newUserName').value.trim();
  const email = $('newUserEmail').value.trim();
  const pass  = $('newUserPass').value;
  const role  = $('newUserRole').value;

  $('addUserError').style.display = 'none';
  if (!name || !email || !pass) {
    $('addUserError').textContent = 'All fields are required';
    $('addUserError').style.display = 'block';
    return;
  }

  $('addUserSave').textContent = 'Creating…';
  $('addUserSave').disabled    = true;

  try {
    // Create user via Firebase Admin SDK is needed for production.
    // For now: use a secondary Firebase app instance to create the user
    // without signing out the current manager.
    const secondaryApp = firebase.initializeApp(FIREBASE_CONFIG, 'secondary_' + Date.now());
    const cred = await secondaryApp.auth().createUserWithEmailAndPassword(email, pass);
    const uid  = cred.user.uid;

    await db.collection('users').doc(uid).set({
      name, email, role,
      assignedUnits: [],
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await secondaryApp.delete();

    toast(`User "${name}" created as ${role}`, 'success');
    closeModal();
    $('newUserName').value = $('newUserEmail').value = $('newUserPass').value = '';
  } catch (e) {
    $('addUserError').textContent = e.message;
    $('addUserError').style.display = 'block';
  } finally {
    $('addUserSave').textContent = 'Create User';
    $('addUserSave').disabled    = false;
  }
});

// ─────────────────────────────────────────────────────────────
// 20. HOTSPOT PLACEMENT MODE (Manager on map click)
// ─────────────────────────────────────────────────────────────

let _placementMode = false;

function enterPlacementMode() {
  if (STATE.role !== 'manager') return;
  _placementMode = true;
  $('mapCanvas').style.cursor = 'crosshair';
  toast('Click on the map to place a new unit hotspot', 'info');
}

$('mapCanvas')?.addEventListener('click', async (e) => {
  if (!_placementMode) return;
  const canvas = $('mapCanvas');
  const rect   = canvas.getBoundingClientRect();
  const x      = ((e.clientX - rect.left) / rect.width  * 100).toFixed(2);
  const y      = ((e.clientY - rect.top)  / rect.height * 100).toFixed(2);

  _placementMode = false;
  $('mapCanvas').style.cursor = '';

  // Show a quick modal to name the new unit
  showEditModal('Place New Unit', `
    <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">Placing unit at map position (${x}%, ${y}%)</p>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Unit Number *</label>
        <input type="text" id="nuNum" class="form-input" placeholder="e.g. A-001" autofocus />
      </div>
      <div class="form-group">
        <label class="form-label">Unit Type</label>
        <input type="text" id="nuType" class="form-input" placeholder="e.g. Villa A" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Block / Cluster</label>
      <input type="text" id="nuBlock" class="form-input" placeholder="e.g. Block 1" />
    </div>
  `, async () => {
    const num   = $('nuNum').value.trim();
    const type  = $('nuType').value.trim();
    const block = $('nuBlock').value.trim();
    if (!num) { toast('Unit number is required', 'error'); return; }

    try {
      await db.collection('units').add({
        unitNumber: num,
        unitType:   type,
        block,
        status:      'not_started',
        currentPhase: STATE.config.phases[0] || '',
        hotspot: { x: parseFloat(x), y: parseFloat(y) },
        engineerHandover: { done: false, date: null, signedBy: null },
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      logActivity(`placed new unit "${num}" on masterplan`);
      toast(`Unit ${num} placed on map`, 'success');
      closeModal();
    } catch(e) {
      toast('Failed: ' + e.message, 'error');
    }
  });
});

// "Add Unit" button via a floating action button on map view
// Add this button dynamically for managers
if (document.readyState !== 'loading') addPlaceFAB();
else document.addEventListener('DOMContentLoaded', addPlaceFAB);

function addPlaceFAB() {
  const mapStage = $('mapStage');
  if (!mapStage) return;
  const fab = document.createElement('button');
  fab.className = 'btn-primary';
  fab.id = 'addUnitFab';
  fab.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Unit`;
  fab.style.cssText = 'position:absolute;bottom:16px;right:16px;z-index:50;display:none;box-shadow:var(--shadow-md)';
  fab.addEventListener('click', enterPlacementMode);
  mapStage.appendChild(fab);
}

// ─────────────────────────────────────────────────────────────
// 21. SEARCH
// ─────────────────────────────────────────────────────────────

const searchInput = $('globalSearch');
const searchResults = $('searchResults');

searchInput?.addEventListener('input', debounce(() => {
  const q = searchInput.value.trim().toLowerCase();
  if (!q) { searchResults.innerHTML = ''; return; }

  const matches = STATE.units.filter(u =>
    (u.unitNumber || '').toLowerCase().includes(q) ||
    (u.assignedEngineerName || '').toLowerCase().includes(q) ||
    (u.contractor || '').toLowerCase().includes(q)
  ).slice(0, 12);

  if (!matches.length) { searchResults.innerHTML = '<div class="sr-item" style="color:var(--text-muted)">No results</div>'; return; }

  searchResults.innerHTML = matches.map(u => {
    const si = statusInfo(u.status || 'not_started');
    return `<div class="sr-item" onclick="openUnitPanel('${u.id}');searchResults.innerHTML=''">
      <span class="sr-num">${u.unitNumber || u.id}</span>
      <span class="sr-info">${u.unitType || ''} · <span style="color:${si.color}">${si.label}</span></span>
    </div>`;
  }).join('');
}, 200));

document.addEventListener('click', e => {
  if (!searchInput?.contains(e.target) && !searchResults?.contains(e.target)) {
    if (searchResults) searchResults.innerHTML = '';
  }
});

// ─────────────────────────────────────────────────────────────
// 22. CSV EXPORT
// ─────────────────────────────────────────────────────────────

$('exportCsvBtn')?.addEventListener('click', () => {
  const cols = ['Unit #','Type','Block','Status','Phase','Engineer','Contractor','Supervisor','Handed Over'];
  const rows = STATE.filteredUnits.map(u => [
    u.unitNumber || u.id,
    u.unitType || '',
    u.block || '',
    statusInfo(u.status || 'not_started').label,
    u.currentPhase || '',
    u.assignedEngineerName || '',
    u.contractor || '',
    u.supervisor || '',
    u.engineerHandover?.done ? 'Yes' : 'No'
  ]);

  const csv  = [cols, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `SitePlanner_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  toast('CSV exported', 'success');
});

// ─────────────────────────────────────────────────────────────
// 23. PAN + ZOOM (Masterplan)
// ─────────────────────────────────────────────────────────────

(function setupPanZoom() {
  const stage  = $('mapStage');
  const canvas = $('mapCanvas');
  if (!stage || !canvas) return;

  let scale = 1, tx = 0, ty = 0;
  let dragging = false, startX = 0, startY = 0, startTx = 0, startTy = 0;

  function applyTransform() {
    canvas.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }

  // Wheel zoom
  stage.addEventListener('wheel', e => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.min(Math.max(scale * delta, 0.3), 8);
    const rect = stage.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    tx = mx - (mx - tx) * (newScale / scale);
    ty = my - (my - ty) * (newScale / scale);
    scale = newScale;
    applyTransform();
  }, { passive: false });

  // Drag pan
  stage.addEventListener('mousedown', e => {
    if (e.target.classList.contains('hs-circle') || e.target.classList.contains('hs-label')) return;
    dragging = true;
    startX = e.clientX; startY = e.clientY;
    startTx = tx; startTy = ty;
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    tx = startTx + (e.clientX - startX);
    ty = startTy + (e.clientY - startY);
    applyTransform();
  });
  document.addEventListener('mouseup', () => { dragging = false; });

  // Touch
  let touches = [];
  let pinchDist0 = null, pinchScale0 = null, pinchTx0 = null, pinchTy0 = null;

  stage.addEventListener('touchstart', e => {
    touches = Array.from(e.touches);
    if (touches.length === 2) {
      pinchDist0  = Math.hypot(touches[1].clientX-touches[0].clientX, touches[1].clientY-touches[0].clientY);
      pinchScale0 = scale;
      pinchTx0    = tx; pinchTy0 = ty;
    }
  }, { passive: true });

  stage.addEventListener('touchmove', e => {
    touches = Array.from(e.touches);
    if (touches.length === 2 && pinchDist0) {
      const dist   = Math.hypot(touches[1].clientX-touches[0].clientX, touches[1].clientY-touches[0].clientY);
      scale = Math.min(Math.max(pinchScale0 * (dist / pinchDist0), 0.3), 8);
      applyTransform();
      e.preventDefault();
    }
  }, { passive: false });

  stage.addEventListener('touchend', () => { pinchDist0 = null; });
})();

// ─────────────────────────────────────────────────────────────
// 24. SIDEBAR TOGGLE
// ─────────────────────────────────────────────────────────────

$('sidebarToggle')?.addEventListener('click', () => {
  $('filterBar').classList.toggle('collapsed');
});

// ─────────────────────────────────────────────────────────────
// 25. CLOSE PANEL
// ─────────────────────────────────────────────────────────────

$('pCloseBtn')?.addEventListener('click',  closePanelFn);
$('backdrop')?.addEventListener('click',   closePanelFn);

// Panel tabs
$('panelTabs')?.addEventListener('click', async (e) => {
  const btn = e.target.closest('.ptab');
  if (!btn) return;
  const unit = STATE.units.find(u => u.id === STATE.openUnitId);
  if (unit) await renderPanelTab(btn.dataset.tab, unit);
});

// ─────────────────────────────────────────────────────────────
// 26. EVENT LISTENERS SETUP
// ─────────────────────────────────────────────────────────────

function setupEventListeners() {
  // View tabs
  document.querySelectorAll('.vtab').forEach(btn => {
    btn.addEventListener('click', () => renderView(btn.dataset.view));
  });

  // Filter: status checkboxes
  document.querySelectorAll('.sf').forEach(cb => {
    cb.addEventListener('change', () => {
      document.querySelectorAll('.sf').forEach(c => {
        if (c.checked) STATE.filters.statuses.add(c.value);
        else STATE.filters.statuses.delete(c.value);
      });
      applyFilters(); renderHotspots(); renderUnitList();
    });
  });

  // Filter: type checkboxes
  document.querySelectorAll('.tf').forEach(cb => {
    cb.addEventListener('change', () => {
      document.querySelectorAll('.tf').forEach(c => {
        if (c.checked) STATE.filters.types.add(c.value);
        else STATE.filters.types.delete(c.value);
      });
      applyFilters(); renderHotspots(); renderUnitList();
    });
  });

  // Filter: phase
  $('phaseFilter')?.addEventListener('change', e => {
    STATE.filters.phase = e.target.value;
    applyFilters(); renderHotspots(); renderUnitList();
  });

  // Filter: engineer
  $('engineerFilter')?.addEventListener('change', e => {
    STATE.filters.engineer = e.target.value;
    applyFilters(); renderHotspots(); renderUnitList();
  });

  // Filter: handover radio
  document.querySelectorAll('.hf').forEach(r => {
    r.addEventListener('change', e => {
      STATE.filters.handover = e.target.value;
      applyFilters(); renderHotspots(); renderUnitList();
    });
  });

  // My units only (engineer)
  $('myUnitsOnly')?.addEventListener('change', e => {
    STATE.filters.myOnly = e.target.checked;
    applyFilters(); renderHotspots(); renderUnitList();
  });

  // Clear filters
  $('clearFilters')?.addEventListener('click', () => {
    STATE.filters.statuses = new Set(DEFAULT_STATUSES.map(s => s.id));
    STATE.filters.types    = new Set(['A','B','C','D','AP']);
    STATE.filters.phase    = '';
    STATE.filters.engineer = '';
    STATE.filters.handover = '';
    STATE.filters.myOnly   = false;
    document.querySelectorAll('.sf').forEach(c => c.checked = true);
    document.querySelectorAll('.tf').forEach(c => c.checked = true);
    if ($('phaseFilter'))    $('phaseFilter').value = '';
    if ($('engineerFilter')) $('engineerFilter').value = '';
    document.querySelectorAll('.hf')[0].checked = true;
    if ($('myUnitsOnly'))    $('myUnitsOnly').checked = false;
    applyFilters(); renderHotspots(); renderUnitList();
  });

  // List sort / search
  $('listSort')?.addEventListener('change',  renderUnitList);
  $('listSearch')?.addEventListener('input', renderUnitList);

  // Show manager FAB if manager
  if (STATE.role === 'manager') {
    const fab = $('addUnitFab');
    if (fab) fab.style.display = '';
  }
}

// ─────────────────────────────────────────────────────────────
// 27. UTILITY: DEBOUNCE
// ─────────────────────────────────────────────────────────────

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
