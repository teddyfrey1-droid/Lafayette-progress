// Centre de contrôle (Super Admin only)

// Firebase config (identique à l'app)
const firebaseConfig = {
  apiKey: "AIzaSyAGaitqmFwExvJ9ZUpkdUdCKAqqDOP2cdQ",
  authDomain: "objectif-restaurant.firebaseapp.com",
  databaseURL: "https://objectif-restaurant-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "objectif-restaurant",
  storageBucket: "objectif-restaurant.firebasestorage.app",
  messagingSenderId: "910113283000",
  appId: "1:910113283000:web:0951fd9dca01aa6e46cd4d"
};

// Prevent double init
try{ if(!firebase.apps || !firebase.apps.length) firebase.initializeApp(firebaseConfig); }catch(e){ /* ignore */ }
const auth = firebase.auth();
const db = firebase.database();

const SUPER_ADMIN_EMAIL = "teddy.frey1@gmail.com";

const ROLE_KEYS = ['user','manager','director','owner','super_admin'];
const DEFAULT_ROLE_LABELS = {
  user: 'Utilisateur',
  manager: 'Manager',
  director: 'Directeur',
  owner: 'Gérant',
  super_admin: 'Super Admin'
};
const FEATURE_KEYS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'personalHistory', label: 'Mon historique' },
  { key: 'diffusion', label: 'Diffusion / Alertes' },
  { key: 'adminPanel', label: 'Panel Équipe (Admin)' },
  { key: 'pilotage', label: 'Pilotage (objectifs + simulateur)' },
  { key: 'logs', label: 'Historique (logs)' },
  { key: 'feedbacks', label: 'Avis & Nouveautés (admin)' },
  { key: 'controlCenter', label: 'Centre de contrôle' }
];

const DEFAULT_ROLE_PERMISSIONS = {
  user: { features: { dashboard:true, personalHistory:true, diffusion:true, adminPanel:false, pilotage:false, logs:false, feedbacks:false, controlCenter:false } },
  manager: { features: { dashboard:true, personalHistory:true, diffusion:true, adminPanel:true,  pilotage:true,  logs:false, feedbacks:false, controlCenter:false } },
  director:{ features: { dashboard:true, personalHistory:true, diffusion:true, adminPanel:true,  pilotage:true,  logs:true,  feedbacks:true,  controlCenter:false } },
  owner:   { features: { dashboard:true, personalHistory:true, diffusion:true, adminPanel:true,  pilotage:true,  logs:true,  feedbacks:true,  controlCenter:false } },
  super_admin:{features:{ dashboard:true, personalHistory:true, diffusion:true, adminPanel:true, pilotage:true, logs:true, feedbacks:true, controlCenter:true } }
};

let me = null; // {uid,email, userRecord}
let accessControl = { roleLabels: {}, rolePermissions: {} };
let usersCache = {};

function _safeObj(v){ return (v && typeof v === 'object') ? v : {}; }

function getRoleKeyFromUser(u){
  if(!u) return 'user';
  if(typeof u.roleKey === 'string' && ROLE_KEYS.includes(u.roleKey)) return u.roleKey;
  if(u.isSuperAdmin === true) return 'super_admin';
  if(u.role === 'admin') return 'manager';
  return 'user';
}

function isSuperAdminUser(userRecord, authUser){
  const email = (authUser && authUser.email) ? String(authUser.email).toLowerCase() : '';
  const emailOk = !!(email && email === SUPER_ADMIN_EMAIL.toLowerCase());
  const rk = getRoleKeyFromUser(userRecord);
  return !!(emailOk || (userRecord && userRecord.isSuperAdmin === true) || rk === 'super_admin');
}

// --- Theme ---
if(localStorage.getItem('heiko_dark_mode') === null) localStorage.setItem('heiko_dark_mode','true');
if(localStorage.getItem('heiko_dark_mode') === 'true') document.body.classList.add('dark-mode');
window.addEventListener('DOMContentLoaded', () => {
  const icon = document.querySelector('.toggle-icon');
  if(icon) icon.textContent = document.body.classList.contains('dark-mode') ? '☀️' : '🌙';
});
function toggleDarkModeCC(){
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  localStorage.setItem('heiko_dark_mode', isDark);
  const icon = document.querySelector('.toggle-icon');
  if(icon) icon.textContent = isDark ? '☀️' : '🌙';
}
window.toggleDarkModeCC = toggleDarkModeCC;
function togglePassCC(){
  const x = document.getElementById('loginPass');
  if(x) x.type = (x.type === 'password') ? 'text' : 'password';
}
window.togglePassCC = togglePassCC;

function showDenied(){
  const denied = document.getElementById('denied');
  const app = document.getElementById('app');
  const login = document.getElementById('loginOverlay');
  if(login) login.style.display = 'none';
  if(app) app.style.display = 'none';
  if(denied) denied.style.display = 'block';
}

function showLogin(){
  const login = document.getElementById('loginOverlay');
  const app = document.getElementById('app');
  const denied = document.getElementById('denied');
  if(app) app.style.display = 'none';
  if(denied) denied.style.display = 'none';
  if(login) login.style.display = 'flex';
}

function showApp(){
  const login = document.getElementById('loginOverlay');
  const app = document.getElementById('app');
  const denied = document.getElementById('denied');
  if(login) login.style.display = 'none';
  if(denied) denied.style.display = 'none';
  if(app) app.style.display = 'block';
}

function setMeBadge(){
  const el = document.getElementById('ccMe');
  if(!el || !me) return;
  const n = (me.userRecord && me.userRecord.name) ? me.userRecord.name : 'Super Admin';
  el.textContent = `👤 ${n}`;
}

async function loadAccessControl(){
  const snap = await db.ref('settings/accessControl').get();
  const val = snap.exists() ? snap.val() : {};
  accessControl = {
    roleLabels: _safeObj(val && val.roleLabels),
    rolePermissions: _safeObj(val && val.rolePermissions)
  };
}

function getRoleLabel(roleKey){
  const custom = accessControl.roleLabels && typeof accessControl.roleLabels[roleKey] === 'string'
    ? accessControl.roleLabels[roleKey].trim()
    : '';
  return custom || DEFAULT_ROLE_LABELS[roleKey] || roleKey;
}

function getRolePerms(roleKey){
  const def = _safeObj(DEFAULT_ROLE_PERMISSIONS[roleKey]);
  const over = _safeObj(accessControl.rolePermissions && accessControl.rolePermissions[roleKey]);
  const merged = { ...def, ...over };
  merged.features = { ..._safeObj(def.features), ..._safeObj(over.features) };
  return merged;
}

function setRolePerm(roleKey, featureKey, enabled){
  if(!accessControl.rolePermissions) accessControl.rolePermissions = {};
  if(!accessControl.rolePermissions[roleKey]) accessControl.rolePermissions[roleKey] = {};
  if(!accessControl.rolePermissions[roleKey].features) accessControl.rolePermissions[roleKey].features = {};
  accessControl.rolePermissions[roleKey].features[featureKey] = !!enabled;
}

function setRoleLabel(roleKey, label){
  if(!accessControl.roleLabels) accessControl.roleLabels = {};
  accessControl.roleLabels[roleKey] = String(label || '').trim();
}

function renderRoleLabels(){
  const grid = document.getElementById('roleLabelsGrid');
  if(!grid) return;
  grid.innerHTML = '';
  ROLE_KEYS.forEach(rk => {
    const div = document.createElement('div');
    div.className = 'cc-field';
    const current = getRoleLabel(rk);
    div.innerHTML = `
      <label>${rk.toUpperCase()}</label>
      <input type="text" id="lbl_${rk}" value="${_escape(current)}" placeholder="${_escape(DEFAULT_ROLE_LABELS[rk] || rk)}" />
    `;
    grid.appendChild(div);
  });
}

function renderPermTable(){
  const tbl = document.getElementById('permTable');
  if(!tbl) return;
  const head = `
    <tr>
      <th style="width:220px;">Fonction</th>
      ${ROLE_KEYS.map(rk => `<th>${_escape(getRoleLabel(rk))}</th>`).join('')}
    </tr>
  `;
  const rows = FEATURE_KEYS.map(f => {
    const tds = ROLE_KEYS.map(rk => {
      const checked = !!(getRolePerms(rk).features && getRolePerms(rk).features[f.key]);
      const disabled = (rk !== 'super_admin' && f.key === 'controlCenter');
      const id = `perm_${f.key}_${rk}`;
      return `
        <td>
          <div style="display:flex;align-items:center;justify-content:center;">
            <input type="checkbox" id="${id}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}
              onchange="window._ccOnPermChange('${f.key}','${rk}', this.checked)" />
          </div>
        </td>
      `;
    }).join('');
    return `
      <tr>
        <td style="font-weight:900; color:var(--text-main);">${_escape(f.label)}</td>
        ${tds}
      </tr>
    `;
  }).join('');
  tbl.innerHTML = head + rows;
}

window._ccOnPermChange = (featureKey, roleKey, checked) => {
  // Protection : le Centre de contrôle doit rester super_admin-only
  if(featureKey === 'controlCenter' && roleKey !== 'super_admin') return;
  setRolePerm(roleKey, featureKey, checked);
};

function _escape(s){
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

async function refreshUsers(){
  const snap = await db.ref('users').get();
  usersCache = snap.exists() ? (snap.val() || {}) : {};
  renderUsers();
}
window.refreshUsers = refreshUsers;

function renderUsers(){
  const box = document.getElementById('usersBox');
  if(!box) return;
  const q = String((document.getElementById('userSearch') || {}).value || '').trim().toLowerCase();
  const entries = Object.keys(usersCache || {}).map(uid => ({ uid, ...(usersCache[uid]||{}) }));
  const filtered = entries
    .filter(u => {
      const hay = `${u.name||''} ${u.email||''}`.toLowerCase();
      return !q || hay.includes(q);
    })
    .sort((a,b) => String(a.name||'').localeCompare(String(b.name||'')));

  if(filtered.length === 0){
    box.innerHTML = `<div style="text-align:center;color:#999;">Aucun utilisateur.</div>`;
    return;
  }

  box.innerHTML = '';
  filtered.forEach(u => {
    const rk = getRoleKeyFromUser(u);
    const div = document.createElement('div');
    div.className = 'cc-user';
    const roleOptions = ROLE_KEYS.map(k => `<option value="${k}" ${k===rk?'selected':''}>${_escape(getRoleLabel(k))}</option>`).join('');
    div.innerHTML = `
      <div class="cc-user-main">
        <div class="cc-user-name">${_escape(u.name || '—')}</div>
        <div class="cc-user-email">${_escape(u.email || '')}</div>
      </div>
      <div class="cc-user-right">
        <select onchange="window._ccChangeUserRole('${u.uid}', this.value)">
          ${roleOptions}
        </select>
        <button class="btn" style="width:auto; padding:10px 12px;" onclick="window._ccPromoteAdmin('${u.uid}')">Admin ✓</button>
      </div>
    `;
    box.appendChild(div);
  });
}
window.renderUsers = renderUsers;

window._ccChangeUserRole = async (uid, newRoleKey) => {
  if(!uid || !ROLE_KEYS.includes(newRoleKey)) return;
  // Legacy mapping: keep role used by existing UI (admin checkbox) in sync
  const legacyRole = (newRoleKey === 'user') ? 'staff' : 'admin';
  const isSA = (newRoleKey === 'super_admin');
  try{
    await db.ref(`users/${uid}`).update({ roleKey: newRoleKey, role: legacyRole, isSuperAdmin: isSA });
    // Update local cache
    if(usersCache && usersCache[uid]){
      usersCache[uid].roleKey = newRoleKey;
      usersCache[uid].role = legacyRole;
      usersCache[uid].isSuperAdmin = isSA;
    }
  }catch(e){
    console.error(e);
    alert('Erreur : impossible de changer le rôle.');
  }
};

window._ccPromoteAdmin = async (uid) => {
  if(!uid) return;
  try{
    await db.ref(`users/${uid}`).update({ role: 'admin' });
    if(usersCache && usersCache[uid]) usersCache[uid].role = 'admin';
    renderUsers();
  }catch(e){
    console.error(e);
    alert('Erreur : impossible de mettre Admin.');
  }
};

async function saveRoleLabels(){
  ROLE_KEYS.forEach(rk => {
    const el = document.getElementById(`lbl_${rk}`);
    if(el) setRoleLabel(rk, el.value);
  });
  try{
    await db.ref('settings/accessControl/roleLabels').set(accessControl.roleLabels || {});
    alert('✅ Titres enregistrés.');
  }catch(e){
    console.error(e);
    alert('Erreur : impossible d\'enregistrer.');
  }
}
window.saveRoleLabels = saveRoleLabels;

async function saveRolePermissions(){
  // Garantir : controlCenter uniquement super_admin
  ROLE_KEYS.forEach(rk => {
    const perms = getRolePerms(rk);
    if(!perms.features) perms.features = {};
    if(rk !== 'super_admin') perms.features.controlCenter = false;
    if(rk === 'super_admin') perms.features.controlCenter = true;
    accessControl.rolePermissions[rk] = { features: perms.features };
  });
  try{
    await db.ref('settings/accessControl/rolePermissions').set(accessControl.rolePermissions || {});
    alert('✅ Accès enregistrés.');
  }catch(e){
    console.error(e);
    alert('Erreur : impossible d\'enregistrer.');
  }
}
window.saveRolePermissions = saveRolePermissions;

function logoutCC(){ auth.signOut(); location.reload(); }
window.logoutCC = logoutCC;

// Auth + boot
auth.onAuthStateChanged(async (user) => {
  if(!user){
    showLogin();
    return;
  }

  // Load user record to check super admin
  let userRecord = null;
  try{
    const s = await db.ref(`users/${user.uid}`).get();
    userRecord = s.exists() ? s.val() : null;
  }catch(e){
    console.error(e);
  }

  if(!isSuperAdminUser(userRecord, user)){
    showDenied();
    return;
  }

  me = { uid: user.uid, email: user.email, userRecord: userRecord || {} };
  setMeBadge();
  showApp();

  // Load access control + users
  try{ await loadAccessControl(); }catch(e){ console.error(e); }
  renderRoleLabels();
  renderPermTable();
  await refreshUsers();
});

document.getElementById('btnLogin').onclick = async () => {
  const email = String((document.getElementById('loginEmail')||{}).value || '').trim();
  const pass = String((document.getElementById('loginPass')||{}).value || '');
  try{
    await auth.signInWithEmailAndPassword(email, pass);
  }catch(e){
    console.error(e);
    alert('❌ Mot de passe incorrect !');
  }
};
