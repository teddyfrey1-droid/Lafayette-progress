// CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyAGaitqmFwExvJ9ZUpkdUdCKAqqDOP2cdQ",
  authDomain: "objectif-restaurant.firebaseapp.com",
  databaseURL: "https://objectif-restaurant-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "objectif-restaurant",
  storageBucket: "objectif-restaurant.firebasestorage.app",
  messagingSenderId: "910113283000",
  appId: "1:910113283000:web:0951fd9dca01aa6e46cd4d"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

async function _maybeAutoNotify(kind, payload){
  // Notifications push désactivées pour l’instant.
  return;
}

let currentUser = null;
let allUsers = {};
let allObjs = {};
// Variables globales attachées à window pour être accessibles partout
window.allLogs = {};
window.allFeedbacks = {};
window.allUpdates = {};

let globalSettings = { budget: 0 };
const BASE_HOURS = 35;
const SUPER_ADMIN_EMAIL = "teddy.frey1@gmail.com";

// Seuil d'alerte (en %) pour "coût primes / CA" en simulation.
const DEFAULT_GUARDRAIL_MAX_PCT_OF_CA = 20;

// --- Archives mensuelles (équipe) & suivi manuel (objectifs) ---
let _archiveUserId = null;
let _archiveUserName = null;
let _archiveUserComputedBonus = 0;

let _objProgId = null;
let _objProgUnsub = null;

function getGuardrailMaxPctOfCA(){
  const v = (globalSettings && globalSettings.guardrailMaxPctOfCA != null)
    ? parseFloat(globalSettings.guardrailMaxPctOfCA)
    : NaN;
  return (isFinite(v) && v > 0) ? v : DEFAULT_GUARDRAIL_MAX_PCT_OF_CA;
}

function isSuperAdmin() {
  return !!(currentUser && currentUser.email && currentUser.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase());
}

function isAdminUser() {
  return !!(currentUser && (currentUser.role === 'admin' || isSuperAdmin()));
}

// CALENDAR DATA
const calEvents = [
    { t: "HEIKO x STURIA", start: "2025-12-01", end: "2026-01-31", c: "evt-heiko" },
    { t: "Flyers Sturia", start: "2025-12-01", end: "2025-12-31", c: "evt-sturia" },
    { t: "7off7 Deliveroo", start: "2025-12-01", end: "2025-12-07", c: "evt-deliv" },
    { t: "BOGOF Deliveroo", start: "2025-12-08", end: "2025-12-14", c: "evt-deliv" },
    { t: "BOGOF UberEats", start: "2025-12-15", end: "2025-12-21", c: "evt-uber" },
    { t: "Street Marketing", start: "2026-01-01", end: "2026-01-31", c: "evt-street" }
];
let currentCalDate = new Date(2025, 11, 1);

// INITIALIZE THEME
if(localStorage.getItem('heiko_dark_mode') === null) {
    localStorage.setItem('heiko_dark_mode', 'true');
}
if(localStorage.getItem('heiko_dark_mode') === 'true') {
    document.body.classList.add('dark-mode');
}
window.addEventListener('DOMContentLoaded', function() {
    const icon = document.querySelector('.toggle-icon');
    if(icon) icon.textContent = document.body.classList.contains('dark-mode') ? '☀️' : '🌙';
});

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('heiko_dark_mode', isDark);
    const icon = document.querySelector('.toggle-icon');
    if(icon) icon.textContent = isDark ? '☀️' : '🌙';
}

// --- PWA ---
function initPWA() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(err => console.error('SW error:', err));
      navigator.serviceWorker.register('/firebase-messaging-sw.js').catch(err => console.error('FCM SW error:', err));
    });
  }
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = document.getElementById('installAppBtn');
    if (btn) {
      btn.style.display = 'block';
      btn.onclick = async () => {
        try {
          btn.disabled = true;
          deferredPrompt.prompt();
          await deferredPrompt.userChoice;
        } catch {}
        deferredPrompt = null;
        btn.style.display = 'none';
        btn.disabled = false;
      };
    }
  });
  window.addEventListener('appinstalled', () => {
    const btn = document.getElementById('installAppBtn');
    if (btn) btn.style.display = 'none';
    deferredPrompt = null;
    if (currentUser && currentUser.uid) {
      db.ref(`users/${currentUser.uid}`).update({ pwaInstalled: true, pwaInstalledAt: Date.now() });
    }
  });
}

// GLOBAL MENU
function toggleGlobalMenu(force) {
    const menu = document.getElementById("globalMenu");
    const backdrop = document.getElementById("globalMenuBackdrop");
    if(!menu || !backdrop) return;
    const isOpen = menu.classList.contains("open");
    const shouldOpen = (typeof force === "boolean") ? force : !isOpen;
    if(shouldOpen) {
        menu.classList.add("open");
        backdrop.classList.add("open");
        document.body.style.overflow = "hidden";
    } else {
        menu.classList.remove("open");
        backdrop.classList.remove("open");
        document.body.style.overflow = "";
        try{ toggleMenuSites(false); }catch(e){}
        try{ toggleMenuSuppliers(false); }catch(e){}
        try{ toggleMenuContacts(false); }catch(e){}
    }
}
document.addEventListener("keydown", (e) => { if(e.key === "Escape") toggleGlobalMenu(false); });

function openUpdatesModalFromMenu(){
  const modal = document.getElementById('updatesModal');
  if(modal) modal.style.display = 'flex';
  toggleGlobalMenu(false);
}
window.openUpdatesModalFromMenu = openUpdatesModalFromMenu;

function openHistoryModalFromMenu(){
  const modal = document.getElementById('historyModal');
  if(modal) modal.style.display = 'flex';
  toggleGlobalMenu(false);
  try{ renderUserHistory(); }catch(e){}
}
window.openHistoryModalFromMenu = openHistoryModalFromMenu;

// Dashboard: aperçu Sites utiles
let __sitesMiniOpen = false;
function toggleSitesMini(force){
  const panel = document.getElementById('sitesMiniPanel');
  const btn = document.getElementById('sitesMiniToggle');
  if(!panel) return;
  const next = (typeof force === 'boolean') ? force : !__sitesMiniOpen;
  __sitesMiniOpen = next;
  panel.style.display = next ? 'block' : 'none';
  if(btn){ btn.textContent = next ? '▴' : '▾'; }
  if(next){ try{ renderSitesPreview(true); }catch(e){} }
}
window.toggleSitesMini = toggleSitesMini;

// Menu Accordion
let __menuSitesOpen = false;
let __menuContactsOpen = false;
let __menuSuppliersOpen = false;

function _setMenuAccordion(which, open){
  const map = {
    sites: { sub: 'menuSitesSub', chev: 'menuSitesChev' },
    suppliers: { sub: 'menuSuppliersSub', chev: 'menuSuppliersChev' },
    contacts: { sub: 'menuContactsSub', chev: 'menuContactsChev' }
  };
  const cfg = map[which] || map.contacts;
  const sub = document.getElementById(cfg.sub);
  const chev = document.getElementById(cfg.chev);
  if(sub) sub.style.display = open ? 'block' : 'none';
  if(chev) chev.textContent = open ? '▾' : '▸';
}

function toggleMenuSites(force){
  const next = (typeof force === 'boolean') ? force : !__menuSitesOpen;
  __menuSitesOpen = next;
  if(next){ __menuContactsOpen = false; _setMenuAccordion('contacts', false); __menuSuppliersOpen = false; _setMenuAccordion('suppliers', false); }
  _setMenuAccordion('sites', next);
  if(next){ try{ renderMenuSitesPreview(); }catch(e){} }
}
window.toggleMenuSites = toggleMenuSites;

function toggleMenuContacts(force){
  const next = (typeof force === 'boolean') ? force : !__menuContactsOpen;
  __menuContactsOpen = next;
  if(next){ __menuSitesOpen = false; _setMenuAccordion('sites', false); __menuSuppliersOpen = false; _setMenuAccordion('suppliers', false); }
  _setMenuAccordion('contacts', next);
  if(next){ try{ renderMenuContactsPreview(); }catch(e){} }
}
window.toggleMenuContacts = toggleMenuContacts;

function toggleMenuSuppliers(force){
  const next = (typeof force === 'boolean') ? force : !__menuSuppliersOpen;
  __menuSuppliersOpen = next;
  if(next){ __menuSitesOpen = false; _setMenuAccordion('sites', false); __menuContactsOpen = false; _setMenuAccordion('contacts', false); }
  _setMenuAccordion('suppliers', next);
  if(next){ try{ renderMenuSuppliersPreview(); }catch(e){} }
}
window.toggleMenuSuppliers = toggleMenuSuppliers;

function renderMenuContactsPreview(){
  const cRoot = document.getElementById('menuContactsPreview');
  if(!cRoot) return;
  const data = window.__contactsData || {};
  const items = Object.entries(data).map(([k,v]) => ({ key:k, ...(v||{}) })).filter(it => it && (it.label || it.value));
  items.sort((a,b) => (a.label||'').localeCompare(b.label||''));
  cRoot.innerHTML = '';
  items.slice(0, 8).forEach(it => {
    const value = (it.value || '').toString().trim();
    const isPhone = /^[+0-9][0-9 .-]{6,}$/.test(value);
    const href = isPhone ? `tel:${value.replace(/\s+/g,'')}` : '';
    const a = document.createElement('a');
    a.className = 'menu-preview-chip';
    a.href = href || 'contacts.html#contacts';
    a.innerHTML = `<div class="menu-preview-title">${escapeHtml(it.label || 'Contact')}</div><div class="menu-preview-sub">${escapeHtml(value || '—')}</div>`;
    cRoot.appendChild(a);
  });
  if(items.length === 0) cRoot.innerHTML = '<div class="menu-preview-empty">Aucun contact.</div>';
}

function renderMenuSuppliersPreview(){
  const root = document.getElementById('menuSuppliersPreview');
  if(!root) return;
  const data = window.__suppliersData || {};
  const items = Object.entries(data).map(([k,v]) => ({ key:k, ...(v||{}) })).filter(it => it && (it.label || it.phone || it.commercial));
  items.sort((a,b) => (a.label||'').localeCompare(b.label||''));
  root.innerHTML = '';
  items.slice(0, 8).forEach(it => {
    const phone = (it.phone || '').toString().trim();
    const commercial = (it.commercial || '').toString().trim();
    const isPhone = /^[+0-9][0-9 .-]{6,}$/.test(phone);
    const href = isPhone ? `tel:${phone.replace(/\s+/g,'')}` : 'contacts.html#fournisseurs';
    const a = document.createElement('a');
    a.className = 'menu-preview-chip';
    a.href = href;
    a.innerHTML = `<div class="menu-preview-title">${escapeHtml(it.label || 'Fournisseur')}</div><div class="menu-preview-sub">${escapeHtml((commercial || '').trim() || (phone || '').trim() || '—')}</div>`;
    root.appendChild(a);
  });
  if(items.length === 0) root.innerHTML = '<div class="menu-preview-empty">Aucun fournisseur.</div>';
}

function renderMenuSitesPreview(){
  const sRoot = document.getElementById('menuSitesPreview');
  if(!sRoot) return;
  const data = window.__sitesData || {};
  const items = Object.entries(data).map(([k,v]) => ({ key:k, ...(v||{}) })).filter(it => it && (it.url || it.label));
  items.sort((a,b) => (a.category||'').localeCompare(b.category||'') || (a.label||'').localeCompare(b.label||''));
  sRoot.innerHTML = '';
  items.slice(0, 10).forEach(it => {
    const safe = sanitizeUrl(it.url);
    const a = document.createElement('a');
    a.className = 'menu-preview-chip';
    a.href = safe || 'contacts.html#sites';
    if(safe){ a.target = '_blank'; a.rel = 'noopener'; }
    a.innerHTML = `<div class="menu-preview-row"><div class="menu-preview-icon">${siteLogoHtml(it)}</div><div style="min-width:0;"><div class="menu-preview-title">${escapeHtml(it.label || 'Lien')}</div><div class="menu-preview-sub">${escapeHtml((it.category||'').trim() || '—')}</div></div></div>`;
    sRoot.appendChild(a);
  });
  if(items.length === 0) sRoot.innerHTML = '<div class="menu-preview-empty">Aucun lien.</div>';
}

function renderMenuDirectoryPreview(){
  try{ renderMenuSitesPreview(); }catch(e){}
  try{ renderMenuSuppliersPreview(); }catch(e){}
  try{ renderMenuContactsPreview(); }catch(e){}
}
window.renderMenuDirectoryPreview = renderMenuDirectoryPreview;

function escapeHtml(str){ return (str || '').toString().replace(/[&<>\"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s])); }
function sanitizeUrl(url){ const u = (url || '').trim(); if(!u) return ''; if(/^https?:\/\//i.test(u)) return u; return ''; }
function siteLogoHtml(it){
  const img = (it.imageData || it.imageUrl || '').toString().trim();
  if(img) return `<img src="${escapeHtml(img)}" alt="">`;
  const icon = (it.icon || '🔗').toString().trim() || '🔗';
  return escapeHtml(icon);
}

function renderSitesPreview(forceMini){
  const data = window.__sitesData || {};
  const items = Object.entries(data).map(([k,v]) => ({ key:k, ...(v||{}) })).filter(it => it && (it.url || it.label));
  items.sort((a,b) => (a.category||'').localeCompare(b.category||'') || (a.label||'').localeCompare(b.label||''));
  const miniRow = document.getElementById('sitesMiniRow');
  const bottomRow = document.getElementById('sitesBottomRow');
  if(miniRow) miniRow.innerHTML = '';
  if(bottomRow) bottomRow.innerHTML = '';
  const top = items.slice(0, 12);
  const bottom = items.slice(0, 6);
  if(miniRow && (__sitesMiniOpen || forceMini)){
    top.forEach(it => {
      const safe = sanitizeUrl(it.url);
      const a = document.createElement('a'); a.className = 'site-chip'; a.href = safe || 'contacts.html'; if(safe){ a.target = '_blank'; a.rel = 'noopener'; }
      a.innerHTML = `<div class="site-chip-icon">${siteLogoHtml(it)}</div><div class="site-chip-main"><div class="site-chip-name">${escapeHtml(it.label || 'Lien')}</div><div class="site-chip-meta">${escapeHtml((it.category||'').trim() || '—')}</div>${it.description ? `<div class="site-chip-desc">${escapeHtml(it.description)}</div>` : ''}</div>`;
      miniRow.appendChild(a);
    });
  }
  if(bottomRow){
    bottom.forEach(it => {
      const safe = sanitizeUrl(it.url);
      const a = document.createElement('a'); a.className = 'site-card-mini'; a.href = safe || 'contacts.html'; if(safe){ a.target = '_blank'; a.rel = 'noopener'; }
      a.innerHTML = `<div class="site-chip-icon">${siteLogoHtml(it)}</div><div class="site-chip-main"><div class="site-chip-name">${escapeHtml(it.label || 'Lien')}</div><div class="site-chip-meta">${escapeHtml((it.category||'').trim() || (it.url||'—'))}</div></div>`;
      bottomRow.appendChild(a);
    });
  }
}

// AUTH
auth.onAuthStateChanged(user => {
  if (user) {
    document.getElementById("loginOverlay").style.display = "none";
    document.getElementById("appContent").style.display = "block";
    // Lance la bannière 2 secondes après l'arrivée sur le dashboard
    setTimeout(checkNotificationStatus, 1000);
    db.ref('users/' + user.uid).on('value', snap => {
      const val = snap.val();
      if(!val) {
         const def = { name: "Utilisateur", hours:35, role:'staff', email: user.email, status: 'pending' };
         db.ref('users/'+user.uid).set(def);
         currentUser = def;
      } else { 
         currentUser = val;
         if(!currentUser.email && user.email){
           try{ db.ref('users/'+user.uid).update({ email: user.email }); }catch(e){}
         }
         if(currentUser.status !== 'active') {
             db.ref('users/'+user.uid).update({ status: 'active', lastLogin: Date.now() });
         }
      }
      currentUser.uid = user.uid;
      currentUser.email = user.email;
      try{ _setupPushUI(); }catch(e){}
      try{ setupPushNotifications(); }catch(e){}
      const newLogRef = db.ref("logs").push();
      newLogRef.set({ user: currentUser.name, action: "Connexion", type: "session", startTime: Date.now(), lastSeen: Date.now() });
      setInterval(() => { newLogRef.update({ lastSeen: Date.now() }); }, 60000);
      updateUI();
    });
    loadData();
    renderNativeCalendar();
  } else {
    document.getElementById("loginOverlay").style.display = "flex";
    document.getElementById("appContent").style.display = "none";
  }
});

document.getElementById("btnLogin").onclick = () => {
  const email = document.getElementById("loginEmail").value.trim();
  const pass = document.getElementById("loginPass").value;
  auth.signInWithEmailAndPassword(email, pass).catch(e => {
      document.getElementById("loginPass").classList.add("error");
      document.getElementById("loginEmail").classList.add("error");
      setTimeout(() => { document.getElementById("loginPass").classList.remove("error"); document.getElementById("loginEmail").classList.remove("error"); }, 1000);
      alert("❌ Mot de passe incorrect !");
  });
};

function clearLoginError() { document.getElementById("loginPass").classList.remove("error"); document.getElementById("loginEmail").classList.remove("error"); }
function togglePass() { const x = document.getElementById("loginPass"); x.type = (x.type === "password") ? "text" : "password"; }
function logout() { auth.signOut(); location.reload(); }
function logAction(action, detail) { db.ref("logs").push({ user: currentUser ? currentUser.name : "Inconnu", action: action, detail: detail || "", type: "action", time: Date.now() }); }

// UI Helpers
function getMonthlyCAObjective(){
  const arr = Object.values(allObjs || {}).filter(o => o && o.published);
  let cand = arr.find(o => o && o.isNumeric && (String(o.name||"").toLowerCase().includes("ca") || String(o.name||"").toLowerCase().includes("chiffre") ));
  if(!cand) cand = arr.find(o => o && o.isPrimary && o.isNumeric);
  return cand || null;
}

function renderTrajectoryIndicator(){
  const el = document.getElementById('trajectoryIndicator');
  if(!el) return;
  const caObj = getMonthlyCAObjective();
  const cur = caObj ? parseFloat(caObj.current) : NaN;
  const target = caObj ? parseFloat(caObj.target) : NaN;
  if(!isFinite(cur) || !isFinite(target) || target <= 0){ el.style.display = 'none'; return; }
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
  const day = now.getDate();
  const pctElapsed = day / Math.max(1, daysInMonth);
  const theo = target * pctElapsed;
  if(!(theo > 0)) { el.style.display = 'none'; return; }
  const deltaPct = ((cur - theo) / theo) * 100;
  const abs = Math.abs(deltaPct).toFixed(1);
  let emoji = '🟠'; let label = `À l’heure : ${deltaPct >= 0 ? '+' : '-'}${abs}%`; let color = 'rgba(245,158,11,1)';
  if(deltaPct >= 2){ emoji = '🟢'; label = `En avance de +${abs}%`; color = 'rgba(16,185,129,1)'; } else if(deltaPct <= -2){ emoji = '🔴'; label = `À rattraper : -${abs}%`; color = 'rgba(239,68,68,1)'; }
  el.innerHTML = `${emoji} ${label} <span class="ti-sub">· trajectoire</span>`;
  el.style.display = 'block'; el.style.color = color;
}

function computeDailyMicroMessage(primOk, pending){
  const published = Object.values(allObjs || {}).filter(o => o && o.published);
  const visible = published.filter(o => o && (o.isPrimary || primOk));
  const n = visible.length;
  if(n === 0) return "Publie les objectifs pour démarrer la journée.";
  if(!primOk) return "TEMPS RESTANT";
  if(pending < 0.01) return "Tout est débloqué : maintiens ce rythme.";
  return "Objectif du jour : valider un palier de plus.";
}

function renderDailyMicro(primOk, pending){
  const el = document.getElementById('dailyMicro');
  if(!el) return;
  if(!currentUser || !currentUser.uid){ el.style.display='none'; return; }
  const uid = currentUser.uid;
  const dayKey = new Date().toISOString().slice(0,10);
  const lsKey = `dailyMicro_${uid}_${dayKey}`;
  let msg = null;
  try{ msg = localStorage.getItem(lsKey); }catch(e){ msg = null; }
  if(!msg){
    msg = computeDailyMicroMessage(primOk, pending);
    try{ localStorage.setItem(lsKey, msg); }catch(e){}
    db.ref(`dailyMicro/${uid}/${dayKey}`).set({ msg, time: Date.now() }).catch(() => {});
  }
  if(msg === "TEMPS RESTANT"){ el.classList.add('time-remaining'); el.textContent = '⏳ TEMPS RESTANT ⏳'; } else { el.classList.remove('time-remaining'); el.textContent = msg || ""; }
  el.style.display = msg ? 'block' : 'none';
}

function haptic(kind){ try{ if(!("vibrate" in navigator)) return; if(kind === "milestone") navigator.vibrate([12]); else if(kind === "win") navigator.vibrate([18, 12, 18]); }catch(e){} }
function monthKeyFromTs(ts){ const d = new Date(ts || Date.now()); const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); return `${y}-${m}`; }

function saveMonthlyUserHistory(primesUnlocked, pctValidated){
  if(!currentUser) return;
  const key = monthKeyFromTs(Date.now());
  const uid = currentUser.uid;
  const payload = { month: key, primes: Number(primesUnlocked || 0), validatedPct: Number(pctValidated || 0), updatedAt: Date.now() };
  const throttleKey = `hist_save_${uid}_${key}`;
  const now = Date.now();
  let last = 0; try{ last = Number(localStorage.getItem(throttleKey) || "0"); }catch(e){ last = 0; }
  if(now - last < 2*60*60*1000) return;
  db.ref(`history/users/${uid}/${key}`).update(payload).then(()=>{ try{ localStorage.setItem(throttleKey, String(now)); }catch(e){} }).catch(()=>{});
}

function renderUserHistory(){
  if(renderUserHistory._bound) return; renderUserHistory._bound = true;
  if(!currentUser) return;
  const dashPanel = document.getElementById("historyPanel");
  const dashList  = document.getElementById("historyList");
  const modalList = document.getElementById("historyModalList");
  if(!dashList && !modalList) return;
  const fmtMonth = (key) => {
    const k = String(key || '').trim(); const mt = /^(\d{4})-(\d{2})$/.exec(k); if(!mt) return k;
    const y = Number(mt[1]); const mo = Number(mt[2]) - 1; const d = new Date(y, mo, 1);
    return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  };
  const makeRows = (rows) => rows.map(r=>{
    const m = fmtMonth(r.month); const primes = (Number(r.primes||0)).toFixed(0); const pct = (Number(r.validatedPct||0)).toFixed(0);
    return `<div class="history-row"><div class="history-month">${m}</div><div class="history-metrics"><div class="history-pill">💶 ${primes}€</div><div class="history-pill">✅ ${pct}%</div></div></div>`;
  }).join("");
  db.ref(`history/users/${currentUser.uid}`).on('value', snap=>{
    const raw = snap.exists() ? (snap.val() || {}) : {};
    const rows = Object.keys(raw).map(k => ({ month: k, ...(raw[k]||{}) })).sort((a,b)=> String(b.month).localeCompare(String(a.month)));
    if(dashPanel && dashList){ if(rows.length === 0){ dashPanel.style.display = 'none'; dashList.innerHTML = ""; } else { dashPanel.style.display = ''; dashList.innerHTML = makeRows(rows.slice(0,3)); } }
    if(modalList){ modalList.innerHTML = rows.length ? makeRows(rows) : `<div style="text-align:center; color:#94a3b8; font-weight:700;">Aucune donnée pour le moment.</div>`; }
  });
}

function showToast(message) { const toast = document.getElementById("toast"); toast.textContent = message; toast.className = "show"; setTimeout(() => { toast.className = "hide"; }, 3000); }

// --- DATA LOADING ---
function loadData() {
  db.ref('objectives').on('value', s => { 
      allObjs = s.val() || {};
      try{ Object.keys(allObjs).forEach(k=>{ if(allObjs[k] && typeof allObjs[k]==='object') allObjs[k]._id = k; }); }catch(e){} 
      try { renderDashboard(); if(isAdminUser()) { renderAdminObjs(); } if(isAdminUser()) { renderSimulator(); } } catch(e) { console.error(e); }
  });
  db.ref('users').on('value', s => { 
    allUsers = s.val() || {}; 
    if(isAdminUser()) { renderAdminUsers(); }
    if(isAdminUser()) { renderSimulator(); }
    try{ if(window.renderMailUI) window.renderMailUI(); }catch(e){}
  });
  db.ref('settings').on('value', s => { 
    globalSettings = s.val() || { budget: 0 }; 
    if(globalSettings.guardrailMaxPctOfCA == null) globalSettings.guardrailMaxPctOfCA = DEFAULT_GUARDRAIL_MAX_PCT_OF_CA;
    if(!globalSettings.notifications) globalSettings.notifications = { autoOnUpdate:false, autoOnObjChange:false, autoOnPilotage:false, autoAudience:'all' };
    if(globalSettings.notifications.autoAudience == null) globalSettings.notifications.autoAudience = 'all';
    if(isAdminUser()) { renderSimulator(); }
    try{ if(window.renderMailUI) window.renderMailUI(); }catch(e){}
  });
  db.ref('directory/sites').on('value', s => { window.__sitesData = s.val() || {}; try{ renderSitesPreview(); }catch(e){ console.error(e); } });
  db.ref('directory/contacts').on('value', s => { window.__contactsData = s.val() || {}; try{ renderMenuDirectoryPreview(); }catch(e){} });
  db.ref('directory/suppliers').on('value', s => { window.__suppliersData = s.val() || {}; try{ renderMenuDirectoryPreview(); }catch(e){} });

  // --- MODIFICATION: Chargement des logs/feedbacks/updates pour Super Admin ---
  db.ref('logs').limitToLast(2000).on('value', s => { 
      window.allLogs = s.val() || {}; 
      if(isSuperAdmin()) renderLogs(window.allLogs); 
  });
  db.ref('feedbacks').on('value', s => { 
      window.allFeedbacks = s.val() || {}; 
      if(isSuperAdmin()) renderFeedbacks(window.allFeedbacks); 
  });
  db.ref('updates').on('value', s => { 
      window.allUpdates = s.val() || {}; 
      renderUpdatesPublic();
      checkNewUpdates(window.allUpdates);
      if(isSuperAdmin()) renderUpdatesAdmin();
  });
}

function checkNewUpdates(updates) {
    const arr = Object.values(updates).sort((a,b) => b.date - a.date);
    if(arr.length === 0) return;
    const latest = arr[0];
    const latestId = latest.title + "_" + latest.date;
    const lastSeen = localStorage.getItem('heiko_last_update_seen');
    if(latestId !== lastSeen) {
        const alertBox = document.getElementById("topAlert");
        document.getElementById("topAlertText").textContent = latest.title;
        alertBox.classList.remove("trigger");
        void alertBox.offsetWidth; alertBox.classList.add("trigger");
        localStorage.setItem('heiko_last_update_seen', latestId);
    }
}

function updateUI() {
  if(!currentUser) return;
  document.getElementById("userName").textContent = currentUser.name;
  document.getElementById("userHours").textContent = (currentUser.hours || 35) + "h";
  
  const isSuperUser = isSuperAdmin();
  const isAdmin = isAdminUser();

  document.getElementById("btnAdmin").style.display = isAdmin ? 'block' : 'none';
  
  // --- GESTION EXCLUSIVE SUPER ADMIN ---
  if (isSuperUser) {
      document.getElementById("btnTabLogs").style.display = 'block';
      document.getElementById("btnTabFeedbacks").style.display = 'block';
      // Force refresh data view
      if (window.allLogs) renderLogs(window.allLogs);
      if (window.allFeedbacks) renderFeedbacks(window.allFeedbacks);
      if (window.allUpdates) renderUpdatesAdmin();
  } else {
      document.getElementById("btnTabLogs").style.display = 'none';
      document.getElementById("btnTabFeedbacks").style.display = 'none';
  }

  const btnEmails = document.getElementById("btnTabEmails");
  if(btnEmails) btnEmails.style.display = isAdmin ? 'block' : 'none';
  
  const globalBudgetInput = document.getElementById("simGlobalBudget");
  const saveBudgetBtn = document.getElementById("btnSaveGlobalBudget");
  const simCAInput = document.getElementById('simMonthlyCA');
  const superAdminBlock = document.getElementById('superAdminBudget');
  
  const pilotageAllowed = isAdmin;
  if(superAdminBlock) superAdminBlock.style.display = pilotageAllowed ? 'block' : 'none';
  if(globalBudgetInput) globalBudgetInput.disabled = !pilotageAllowed;
  if(saveBudgetBtn) saveBudgetBtn.style.display = pilotageAllowed ? 'inline-block' : 'none';
  if(simCAInput) simCAInput.disabled = !pilotageAllowed;
  
  if(isAdmin) { renderAdminObjs(); renderSimulator(); }
  renderDashboard();
}

function saveUpdate() {
    const id = document.getElementById("uptId").value;
    const t = document.getElementById("uptTitle").value.trim();
    const d = document.getElementById("uptDesc").value.trim();
    const type = document.getElementById("uptType").value;
    if(!t || !d) return alert("Remplir titre et description");
    if(id) {
        db.ref('updates/' + id).update({ title:t, desc:d, type:type }).then(async () => {
            showToast("✅ Mise à jour modifiée !"); cancelUpdateEdit();
            try{ await _maybeAutoNotify('update', { title: "🛠️ " + t, body: d, link: "/index.html#dashboard" }); }catch(e){}
        });
    } else {
        db.ref('updates').push({ title:t, desc:d, type:type, date:Date.now() }).then(async () => {
            showToast("📢 Publié !"); cancelUpdateEdit();
            try{ await _maybeAutoNotify('update', { title: "📢 " + t, body: d, link: "/index.html#dashboard" }); }catch(e){}
        });
    }
}

function editUpdate(id) {
    const u = window.allUpdates[id]; if(!u) return;
    document.getElementById("uptId").value = id;
    document.getElementById("uptTitle").value = u.title;
    document.getElementById("uptDesc").value = u.desc;
    document.getElementById("uptType").value = u.type;
    document.getElementById("btnSaveUpdate").textContent = "💾 Enregistrer Modification";
    document.getElementById("btnSaveUpdate").style.background = "#f59e0b";
    document.getElementById("btnCancelUpdate").style.display = "inline-block";
    document.querySelector('.admin-section').scrollIntoView({ behavior: 'smooth' });
}

function cancelUpdateEdit() {
    document.getElementById("uptId").value = ""; document.getElementById("uptTitle").value = ""; document.getElementById("uptDesc").value = "";
    document.getElementById("btnSaveUpdate").textContent = "Publier l'info";
    document.getElementById("btnSaveUpdate").style.background = "var(--primary)";
    document.getElementById("btnCancelUpdate").style.display = "none";
}

function deleteUpdate(id) { if(confirm("Supprimer cette info ?")) { db.ref('updates/'+id).remove(); if(document.getElementById("uptId").value === id) cancelUpdateEdit(); } }

function renderUpdatesPublic() {
    const c = document.getElementById("publicUpdatesList"); c.innerHTML = "";
    const arr = Object.values(window.allUpdates || {}).sort((a,b) => b.date - a.date);
    if(arr.length === 0) { c.innerHTML = "<div style='text-align:center;color:#999;font-style:italic;'>Aucune nouveauté pour le moment.</div>"; return; }
    arr.forEach(u => {
        const d = new Date(u.date).toLocaleDateString();
        let tag = ""; if(u.type==='new') tag = `<span class="update-tag tag-new">✨ Nouveauté</span>`; if(u.type==='impr') tag = `<span class="update-tag tag-impr">🛠️ Amélioration</span>`; if(u.type==='fix') tag = `<span class="update-tag tag-fix">🐛 Correction</span>`;
        const div = document.createElement("div"); div.className = "update-card";
        div.innerHTML = `<div class="update-header">${tag}<span class="update-date">${d}</span></div><span class="update-title">${u.title}</span><div class="update-body">${u.desc}</div>`;
        c.appendChild(div);
    });
}

function renderUpdatesAdmin() {
    const c = document.getElementById("adminUpdatesList"); c.innerHTML = "";
    const arr = []; Object.keys(window.allUpdates || {}).forEach(k => arr.push({id:k, ...window.allUpdates[k]}));
    arr.sort((a,b) => b.date - a.date);
    if(arr.length === 0) { c.innerHTML = "<div style='color:#ccc; font-style:italic;'>Aucune publication.</div>"; return; }
    arr.forEach(u => {
        const d = new Date(u.date).toLocaleDateString();
        const div = document.createElement("div"); div.className = "update-card";
        div.innerHTML = `<div class="update-header"><span style="font-weight:800;font-size:12px;">${u.type.toUpperCase()} - ${d}</span><div style="display:flex; gap:10px;"><button onclick="editUpdate('${u.id}')" style="background:none;border:none;cursor:pointer;font-size:14px;">✏️</button><button onclick="deleteUpdate('${u.id}')" style="background:none;border:none;cursor:pointer;font-size:14px;">🗑️</button></div></div><div style="font-weight:bold;">${u.title}</div><div style="font-size:12px; color:var(--text-muted);">${u.desc.substring(0,50)}...</div>`;
        c.appendChild(div);
    });
}

function sendFeedback() {
    const txt = document.getElementById("fbContent").value.trim(); if(!txt) return;
    db.ref('feedbacks').push({ user: currentUser.name, msg: txt, time: Date.now() }).then(() => { showToast("Message envoyé ! Merci 💡"); document.getElementById("fbContent").value = ""; document.getElementById("feedbackModal").style.display = 'none'; });
}

function renderFeedbacks(feeds) {
    const container = document.getElementById("feedbacksContainer"); if(!container) return; container.innerHTML = "";
    const arr = Object.values(feeds).sort((a,b) => b.time - a.time);
    if(arr.length === 0) { container.innerHTML = "<div style='color:#999;font-style:italic;'>Aucun avis.</div>"; return; }
    arr.forEach(f => {
        const d = new Date(f.time);
        const div = document.createElement("div"); div.className = "log-user-group";
        div.innerHTML = `<div class="group-header" style="cursor:default;"><div class="group-info">💬 ${f.user}</div><div class="last-seen">${d.toLocaleString()}</div></div><div style="padding:15px; font-size:13px; line-height:1.4; color:var(--text-main);">${f.msg}</div>`;
        container.appendChild(div);
    });
}

// --- COCKPIT SIMULATOR ---
let simObjs = {}; 
function renderSimulator() { buildSimulatorUI(); }
function buildSimulatorUI() {
    const container = document.getElementById("simObjList"); container.innerHTML = "";
    simObjs = JSON.parse(JSON.stringify(allObjs)); 
    document.getElementById("simGlobalBudget").value = globalSettings.budget || 0;
    const storedCA = localStorage.getItem('heiko_sim_monthly_ca');
    const simCAInput = document.getElementById('simMonthlyCA');
    if(simCAInput) simCAInput.value = storedCA ? String(storedCA) : '';
    const guardPctInput = document.getElementById('simGuardrailPct');
    if(guardPctInput) guardPctInput.value = String(getGuardrailMaxPctOfCA());
    let totalPotential35h = 0;
    Object.keys(simObjs).forEach(k => {
        const o = simObjs[k]; if(!o.published) return; 
        let maxObjPrize = 0;
        if(o.isFixed) { maxObjPrize = (o.paliers && o.paliers[0]) ? parse(o.paliers[0].prize) : 0; } 
        else { if(o.paliers) o.paliers.forEach(p => maxObjPrize += parse(p.prize)); }
        totalPotential35h += maxObjPrize;
        let objTotalCost = 0; let totalUserRatio = 0;
        Object.values(allUsers).forEach(u => { if(u && u.email && String(u.email).toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) return; if(u && u.primeEligible === false) return; totalUserRatio += ((u.hours || 35) / BASE_HOURS); });
        objTotalCost = maxObjPrize * totalUserRatio;
        const div = document.createElement("div"); div.className = "cockpit-obj-row";
        let slidersHtml = "";
        if(o.isFixed) {
            const prize = (o.paliers && o.paliers[0]) ? parse(o.paliers[0].prize) : 0;
            slidersHtml = `<div class="slider-row"><div class="slider-label-line"><span class="slider-label">Prime Fixe</span><span class="slider-val" id="val-${k}-0">${prize}€</span></div><input type="range" min="0" max="50" step="5" value="${prize}" oninput="updateObjVal('${k}', 0, this.value)"></div>`;
        } else {
            (o.paliers || []).forEach((p, i) => {
                const prize = parse(p.prize); let label = `Palier ${p.threshold}`; if(o.isNumeric) label += ""; else label += "%";
                slidersHtml += `<div class="slider-row"><div class="slider-label-line"><span class="slider-label">${label}</span><span class="slider-val" id="val-${k}-${i}">${prize}€</span></div><input type="range" min="0" max="30" step="5" value="${prize}" oninput="updateObjVal('${k}', ${i}, this.value)"></div>`;
            });
        }
        div.innerHTML = `<button class="cockpit-obj-head" type="button" onclick="toggleCockpitObj(this)"><div class="cockpit-obj-title"><span>${o.name}</span><span class="cost">Coût équipe : ${objTotalCost.toFixed(0)}€</span></div><span class="cockpit-chevron">▾</span></button><div class="cockpit-obj-body">${slidersHtml}</div>`; 
        container.appendChild(div);
    });
    document.getElementById("simTotalPerUser").innerText = `${totalPotential35h.toFixed(0)}€`;
    updateSim();
}
function updateObjVal(objId, tierIdx, val) { document.getElementById(`val-${objId}-${tierIdx}`).innerText = val + "€"; if(simObjs[objId].paliers && simObjs[objId].paliers[tierIdx]) { simObjs[objId].paliers[tierIdx].prize = val; } updateSim(); }
function toggleCockpitObj(btn){ try{ const row = btn.closest('.cockpit-obj-row'); if(!row) return; row.classList.toggle('open'); }catch(e){} }

function updateSim() {
   const budget = parseFloat(document.getElementById("simGlobalBudget").value) || 0;
   const simCAEl = document.getElementById('simMonthlyCA'); const simCA = simCAEl ? (parseFloat(simCAEl.value) || 0) : 0; if(simCAEl) localStorage.setItem('heiko_sim_monthly_ca', simCAEl.value || '');
   let totalUserRatio = 0;
   Object.values(allUsers).forEach(u => { if(u && u.email && String(u.email).toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) return; if(u && u.primeEligible === false) return; totalUserRatio += ((u.hours || 35) / BASE_HOURS); });
   let maxLiability = 0; let totalPotential35h = 0;
   Object.keys(simObjs).forEach(k => {
       const o = simObjs[k]; if(!o.published) return;
       let maxP = 0; if(o.isFixed) { maxP = (o.paliers && o.paliers[0]) ? parse(o.paliers[0].prize) : 0; } else { if(o.paliers) o.paliers.forEach(p => maxP += parse(p.prize)); }
       const objCost = maxP * totalUserRatio;
       const costLabel = document.getElementById(`cost-${k}`); if(costLabel) costLabel.innerText = `Coût équipe : ${objCost.toFixed(0)}€`;
       maxLiability += objCost; totalPotential35h += maxP;
   });
   const pct = (budget > 0) ? (maxLiability / budget) * 100 : 0; const bar = document.getElementById("simGauge"); bar.style.width = Math.min(pct, 100) + "%";
   if(maxLiability > budget) { bar.classList.add("danger"); document.getElementById("simUsed").style.color = "#ef4444"; } else { bar.classList.remove("danger"); document.getElementById("simUsed").style.color = "#3b82f6"; }
   document.getElementById("simUsed").innerText = `${maxLiability.toFixed(0)}€ Engagés`; document.getElementById("simLeft").innerText = `Reste : ${(budget - maxLiability).toFixed(0)}€`;
   document.getElementById("simTotalPerUser").innerText = `${totalPotential35h.toFixed(0)}€`;
   const pctEl = document.getElementById('simPctCA');
   if(pctEl) { if(simCA > 0) { const pctCA = (maxLiability / simCA) * 100; pctEl.textContent = `${pctCA.toFixed(1)}% du CA`; } else { pctEl.textContent = '—'; } }
   const guardBox = document.getElementById('guardrailBox'); const guardText = document.getElementById('guardrailText'); const warnings = [];
   if(budget <= 0) { warnings.push("Budget max non défini : impossible d'évaluer le dépassement."); } else if(maxLiability > budget) { warnings.push(`Dépassement budget : ${(maxLiability - budget).toFixed(0)}€ au-dessus du budget max.`); }
   if(simCA > 0) { const pctCA = (maxLiability / simCA) * 100; const seuil = getGuardrailMaxPctOfCA(); if(pctCA > seuil) { warnings.push(`Coût primes élevé : ${pctCA.toFixed(1)}% du CA (seuil ${seuil}%).`); } }
   Object.keys(simObjs).forEach(k => { const o = simObjs[k]; if(!o || !o.published) return; if(!o.paliers || !Array.isArray(o.paliers) || o.paliers.length === 0) { warnings.push(`Objectif "${o.name || 'Sans nom'}" publié sans paliers.`); } });
   if(guardBox && guardText) { if(warnings.length > 0) { guardText.innerHTML = warnings.map(w => `• ${w}`).join('<br>'); guardBox.style.display = 'block'; } else { guardBox.style.display = 'none'; } }
}
function publishSim() {
    if(!isSuperAdmin()) return;
    if(confirm("📡 Confirmer la publication des nouveaux montants ?")) {
        const updates = {}; const newBudget = parseFloat(document.getElementById("simGlobalBudget").value); if(!isNaN(newBudget)) db.ref('settings/budget').set(newBudget);
        Object.keys(simObjs).forEach(k => { updates['objectives/' + k + '/paliers'] = simObjs[k].paliers; });
        db.ref().update(updates).then(async () => { showToast("✅ Pilotage Appliqué !"); logAction("Pilotage", "Mise à jour globale budget & primes"); try{ await _maybeAutoNotify('pilotage', { title: "📡 Pilotage publié", body: "Les primes & paliers ont été mis à jour.", link: "/index.html#dashboard" }); }catch(e){} });
    }
}

function renderNativeCalendar() {
    const m = currentCalDate.getMonth(); const y = currentCalDate.getFullYear();
    document.getElementById("calTitle").innerText = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(currentCalDate);
    const firstDay = new Date(y, m, 1); const lastDay = new Date(y, m + 1, 0);
    const grid = document.getElementById("calGrid"); const legend = document.getElementById("calLegend");
    grid.innerHTML = ""; legend.innerHTML = ""; 
    let dayOfWeek = firstDay.getDay() - 1; if(dayOfWeek === -1) dayOfWeek = 6; 
    for(let i=0; i<dayOfWeek; i++) { grid.appendChild(document.createElement("div")); }
    for(let d=1; d<=lastDay.getDate(); d++) {
        const cell = document.createElement("div"); cell.className = "cal-cell"; cell.innerHTML = `<span class="cal-date">${d}</span>`; const cellDate = new Date(y, m, d);
        calEvents.forEach(evt => { const s = new Date(evt.start); const e = new Date(evt.end); if(cellDate.setHours(0,0,0,0) >= s.setHours(0,0,0,0) && cellDate.setHours(0,0,0,0) <= e.setHours(0,0,0,0)) { cell.innerHTML += `<span class="cal-event-dot ${evt.c}">${evt.t}</span>`; } });
        grid.appendChild(cell);
    }
    const uniqueEvents = [...new Map(calEvents.map(item => [item.t, item])).values()];
    uniqueEvents.forEach(evt => { const legItem = document.createElement("div"); legItem.className = "legend-item"; legItem.innerHTML = `<div class="legend-dot ${evt.c}"></div><span>${evt.t}</span>`; legend.appendChild(legItem); });
}
function prevMonth() { currentCalDate.setMonth(currentCalDate.getMonth()-1); renderNativeCalendar(); }
function nextMonth() { currentCalDate.setMonth(currentCalDate.getMonth()+1); renderNativeCalendar(); }

function formatEuro(v){ const n = Number(v||0); return (isFinite(n)? n.toFixed(2): "0.00") + "€"; }
function updateGainToday(totalMyGain){
  if(!currentUser) return;
  const el = document.getElementById("gainToday"); if(!el) return;
  const uid = currentUser.uid || currentUser.id || "me"; const key = "gainDayStart_" + uid; const today = (new Date()).toLocaleDateString("fr-FR");
  let state = null; try { state = JSON.parse(localStorage.getItem(key) || "null"); } catch(e){ state = null; }
  if(!state || state.day !== today){ state = { day: today, start: Number(totalMyGain||0) }; try { localStorage.setItem(key, JSON.stringify(state)); } catch(e){} }
  const delta = Number(totalMyGain||0) - Number(state.start||0); const sign = delta >= 0 ? "+" : ""; el.textContent = `${sign}${delta.toFixed(2)}€ aujourd’hui`;
}

let __monthCountdownTimer = null;
function updateMonthCountdown(){
  const el = document.getElementById("monthCountdown"); if(!el) return;
  const now = new Date(); const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0); let diff = Math.max(0, end.getTime() - now.getTime());
  const totalSec = Math.floor(diff / 1000); const days = Math.floor(totalSec / 86400); const hours = Math.floor((totalSec % 86400) / 3600); const mins = Math.floor((totalSec % 3600) / 60); const secs = totalSec % 60;
  const pad2 = (n) => String(n).padStart(2, "0");
  el.innerHTML = `<div class="mc-box" aria-label="Jours"><div class="mc-num">${pad2(days)}</div><div class="mc-unit">jours</div></div><div class="mc-box" aria-label="Heures"><div class="mc-num">${pad2(hours)}</div><div class="mc-unit">heures</div></div><div class="mc-box" aria-label="Minutes"><div class="mc-num">${pad2(mins)}</div><div class="mc-unit">minutes</div></div><div class="mc-box" aria-label="Secondes"><div class="mc-num">${pad2(secs)}</div><div class="mc-unit">secondes</div></div>`;
  if(!__monthCountdownTimer){ __monthCountdownTimer = setInterval(updateMonthCountdown, 1000); }
}

function computeNextMilestone(userRatio, primOk){
  const el = document.getElementById("nextMilestone"); if(!el) return;
  let best = null; let unlockedCount = 0; let totalPaliers = 0;
  Object.keys(allObjs||{}).forEach(k=>{
    const o = allObjs[k]; if(!o || !o.published) return;
    const isLocked = !o.isPrimary && !primOk; if(isLocked) return;
    const pct = getPct(o.current, o.target, o.isInverse);
    (o.paliers||[]).forEach(p=>{
      totalPaliers += 1; const th = Number(p.threshold); const prize = parse(p.prize) * userRatio;
      let unlocked = false; if(o.isNumeric) unlocked = Number(o.current) >= th; else unlocked = pct >= th;
      if(unlocked){ unlockedCount += 1; return; }
      let gap = 0; let unit = ""; if(o.isNumeric){ gap = th - Number(o.current); unit = ""; } else { gap = th - pct; unit = "%"; }
      if(!(gap > 0)) return;
      const denom = (o.isNumeric ? Math.max(1, Math.abs(th)) : 100); const score = gap / denom;
      const cand = { score, gap, unit, name: (o.name || "Objectif").toString(), prize };
      if(!best || cand.score < best.score) best = cand;
    });
  });
  if(totalPaliers > 0 && unlockedCount >= totalPaliers){ el.textContent = "Tous les paliers sont débloqués 🎉"; } else if(best){ const gapTxt = best.unit === "%" ? `${best.gap.toFixed(1)}%` : `${Math.ceil(best.gap)}`; el.textContent = `Encore ${gapTxt} sur “${best.name}” pour +${best.prize.toFixed(2)}€`; } else { el.textContent = "Prochain palier : à portée de main 💪"; }
  if(!currentUser) return; const uid = currentUser.uid || currentUser.id || "me"; const key = "unlockedCount_" + uid; let prev = 0; try { prev = Number(localStorage.getItem(key) || "0"); } catch(e){ prev = 0; }
  if(unlockedCount > prev){ haptic("milestone"); const sc = document.getElementById("scoreCircle"); if(sc){ sc.classList.remove("milestone"); void sc.offsetWidth; sc.classList.add("milestone"); setTimeout(()=>sc.classList.remove("milestone"), 650); } }
  try { localStorage.setItem(key, String(unlockedCount)); } catch(e){}
}

function createSecondaryCarousel(objs, primOk, ratio){
  const wrap = document.createElement("div"); wrap.className = "secondary-carousel";
  const btnPrev = document.createElement("button"); btnPrev.className = "carousel-btn prev"; btnPrev.innerHTML = "<span>❮</span>"; btnPrev.style.display="none";
  const btnNext = document.createElement("button"); btnNext.className = "carousel-btn next"; btnNext.innerHTML = "<span>❯</span>"; btnNext.style.display="none";
  const track = document.createElement("div"); track.className = "carousel-track";
  if(!window.__carouselNudged){ window.__carouselNudged = true; track.classList.add("nudge"); setTimeout(()=>track.classList.remove("nudge"), 2600); }
  if(!window.__carouselPeekTimer){ window.__carouselPeekTimer = setInterval(() => { try{ if(!track || !track.lastElementChild) return; const canScroll = track.scrollWidth > (track.clientWidth + 24); if(!canScroll) return; const notAtEnd = track.scrollLeft < (track.scrollWidth - track.clientWidth - 24); if(!notAtEnd) return; const last = track.lastElementChild; last.classList.add('peek'); setTimeout(() => last.classList.remove('peek'), 1800); }catch(e){} }, 8000); }
  objs.forEach(o => { const item = document.createElement("div"); item.className = "carousel-item"; item.appendChild(createCard(o, !primOk, ratio, false)); track.appendChild(item); });
  const step = () => Math.max(220, Math.round(track.clientWidth * 0.88));
  btnPrev.addEventListener("click", () => { track.scrollBy({ left: -step(), behavior: "smooth" }); });
  btnNext.addEventListener("click", () => { track.scrollBy({ left: step(), behavior: "smooth" }); });
  if(objs.length <= 1){ btnPrev.style.display = "none"; btnNext.style.display = "none"; }
  wrap.appendChild(btnPrev); wrap.appendChild(btnNext); wrap.appendChild(track); return wrap;
}

function renderDashboard() {
  if(!currentUser) return;
  const container = document.getElementById("cardsContainer"); container.innerHTML = "";
  const eligible = (currentUser.primeEligible !== false) && !(currentUser.email && String(currentUser.email).toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase());
  const ratio = eligible ? ((currentUser.hours || 35) / BASE_HOURS) : 0;
  let totalMyGain = 0; let totalPotential = 0;
  const prims = Object.values(allObjs).filter(o => o.isPrimary && o.published);
  let primOk = true;
  if(prims.length > 0) { primOk = prims.every(o => { let threshold = 100; if(o.isFixed) threshold = 100; else if(o.paliers && o.paliers[0]) threshold = o.paliers[0].threshold; if(o.isNumeric) return parseFloat(o.current) >= threshold; else { const pct = getPct(o.current, o.target, o.isInverse); return pct >= threshold; } }); }
  if(prims.length > 0) container.innerHTML += `<div class="category-title">🔥&nbsp;<span>Priorité Absolue</span></div>`;
  prims.forEach(o => container.appendChild(createCard(o, false, ratio, true)));
  const secs = Object.values(allObjs).filter(o => !o.isPrimary && o.published);
  if(secs.length > 0) container.innerHTML += `<div class="category-title secondary">💎&nbsp;<span>Bonus Déblocables</span></div>`;
  container.appendChild(createSecondaryCarousel(secs, primOk, ratio));
  Object.keys(allObjs).forEach(key => {
    const o = allObjs[key]; if(!o.published) return;
    const pct = getPct(o.current, o.target, o.isInverse); const isLocked = !o.isPrimary && !primOk;
    if(o.isFixed) { const prize = (o.paliers && o.paliers[0]) ? parse(o.paliers[0].prize) : 0; totalPotential += prize * ratio; } else { (o.paliers||[]).forEach(p => { totalPotential += parse(p.prize) * ratio; }); }
    if(!isLocked) { if(o.isFixed) { let win = false; if(o.isNumeric) win = parseFloat(o.current) >= o.target; else win = pct >= 100; if(win && o.paliers && o.paliers[0]) totalMyGain += (parse(o.paliers[0].prize) * ratio); } else { if(o.paliers) o.paliers.forEach(p => { let unlocked = false; if(o.isNumeric) unlocked = parseFloat(o.current) >= p.threshold; else unlocked = pct >= p.threshold; if(unlocked) totalMyGain += (parse(p.prize) * ratio); }); } }
  });
  const d = new Date(); const gainText = totalMyGain.toFixed(2) + "€";
  const myGainEl = document.getElementById("myTotalGain"); if(myGainEl) myGainEl.textContent = eligible ? gainText : '—';
  try{ const labelEl = document.getElementById('globalScoreLabel'); if(labelEl) labelEl.textContent = eligible ? 'MES PRIMES DÉBLOQUÉES' : 'HORS PRIMES'; }catch(e){}
  try{ const kpiEl = document.getElementById('kpiMyGain'); if(kpiEl) kpiEl.textContent = eligible ? gainText : '—'; }catch(e){}
  try{ const visibleObjs = Object.values(allObjs || {}).filter(o => o && o.published && (o.isPrimary || primOk)); const winCount = visibleObjs.filter(o => { const pct = getPct(o.current, o.target, o.isInverse); if(o.isFixed){ if(o.isNumeric) return parseFloat(o.current) >= o.target; return pct >= 100; } else if(o.paliers && o.paliers[0]){ if(o.isNumeric) return parseFloat(o.current) >= o.paliers[0].threshold; return pct >= o.paliers[0].threshold; } return false; }).length; const pctValidated = visibleObjs.length ? (winCount / visibleObjs.length) * 100 : 0; saveMonthlyUserHistory(totalMyGain, pctValidated); }catch(e){}
  if(eligible){ updateGainToday(totalMyGain); computeNextMilestone(ratio, primOk); } else { const gt = document.getElementById('gainToday'); if(gt) gt.textContent = ''; const nm = document.getElementById('nextMilestone'); if(nm) nm.textContent = ''; }
  updateMonthCountdown();
  const pending = Math.max(0, totalPotential - totalMyGain);
  const pendingEl = document.getElementById('pendingGain'); if(pendingEl){ if(eligible){ pendingEl.style.display = ''; pendingEl.textContent = `⏳ ${pending.toFixed(2)}€ en attente`; } else { pendingEl.style.display = 'none'; pendingEl.textContent = ''; } }
  renderTrajectoryIndicator(); renderDailyMicro(primOk, pending);
  const microEl = document.getElementById('microMotiv'); if(microEl){ let msg = ""; if(!eligible){ msg = "Compte hors primes."; } else if(!prims.length){ msg = "📝 Publie les objectifs pour activer les primes."; } else if(!primOk){ msg = ""; } else if(pending < 0.01){ msg = "✅ Tout est débloqué pour ce mois. Maintiens le niveau."; } else { msg = "🎯 Prochain palier : focus sur le +1 aujourd’hui."; } microEl.textContent = msg; microEl.style.display = msg ? "block" : "none"; }
  const rainContainer = document.getElementById("moneyRain"); if(rainContainer) rainContainer.innerHTML = "";
  const lastUpdateEl = document.getElementById("lastUpdate"); if(lastUpdateEl) lastUpdateEl.textContent = "Mise à jour : " + d.toLocaleDateString('fr-FR');
  const kMy = document.getElementById("kpiMyGain"); if(kMy) kMy.textContent = gainText;
  const publishedCount = Object.values(allObjs || {}).filter(o => o && o.published).length; const kAct = document.getElementById("kpiActiveObjs"); if(kAct) kAct.textContent = publishedCount;
  const bonusCount = Object.values(allObjs || {}).filter(o => o && !o.isPrimary && o.published).length; const kBonus = document.getElementById("kpiBonusState"); const kBonusSub = document.getElementById("kpiBonusSub"); if(kBonus) kBonus.textContent = primOk ? "Ouverts" : "Verrouillés"; if(kBonusSub) kBonusSub.textContent = primOk ? (bonusCount + " bonus") : "Priorités requises";
  const kUp = document.getElementById("kpiUpdated"); if(kUp) kUp.textContent = d.toLocaleDateString('fr-FR');
  const sc = document.getElementById("scoreCircle"); if(sc){ sc.classList.remove("bump"); void sc.offsetWidth; sc.classList.add("bump"); setTimeout(() => sc.classList.remove("bump"), 240); }
  const focusPillEl = document.getElementById("focusPill"); const focusTextEl = document.getElementById("focusText"); const focusEmojiEl = document.getElementById("focusEmoji");
  if(!primOk){ if(focusPillEl) focusPillEl.style.display = 'none'; }
  if(focusTextEl && focusEmojiEl){
    if(focusPillEl && primOk) focusPillEl.style.display = '';
    const publishedObjs = Object.values(allObjs || {}).filter(o => o && o.published); let winCount = 0;
    publishedObjs.forEach(o => { const pct2 = getPct(o.current, o.target, o.isInverse); let win = false; if(o.isFixed){ if(o.isNumeric) win = parseFloat(o.current) >= o.target; else win = pct2 >= 100; } else if(o.paliers && o.paliers[0]){ const thr = o.paliers[0].threshold; if(o.isNumeric) win = parseFloat(o.current) >= thr; else win = pct2 >= thr; } if(win) winCount++; });
    const n = publishedObjs.length; const dayKey = new Date().toISOString().slice(0,10); let msgs = [];
    if(n === 0){ msgs = [{ e: "📝", t: "Publie les objectifs du jour pour lancer la journée." }]; } else if(winCount === n){ msgs = [{ e: "🎉", t: "Tout est validé : garde ce rythme, c’est parfait." }]; } else { msgs = [ { e: "🎯", t: "Objectif du jour : +1 palier validé." }, { e: "🚀", t: `Prochain palier : ${n - winCount} objectif(s) à valider.` }, { e: "💶", t: "Chaque palier compte : vise le +1 aujourd’hui." } ]; }
    let idx = 0; for(let i=0; i<dayKey.length; i++) idx = (idx + dayKey.charCodeAt(i)) % msgs.length; const m = msgs[idx] || msgs[0];
    focusEmojiEl.textContent = m.e; focusTextEl.textContent = m.t;
  }
}

function createCard(obj, isLocked, userRatio, isPrimary) {
  const pct = getPct(obj.current, obj.target, obj.isInverse); let isWin = false;
  if(obj.isFixed) { if(obj.isNumeric) isWin = parseFloat(obj.current) >= obj.target; else isWin = pct >= 100; } else { if(obj.paliers && obj.paliers[0]) { if(obj.isNumeric) isWin = parseFloat(obj.current) >= obj.paliers[0].threshold; else isWin = pct >= obj.paliers[0].threshold; } }
  try{ if(currentUser && obj && obj._id){ const hk = `win_${currentUser.uid}_${obj._id}`; const prevWin = (localStorage.getItem(hk) === "1"); if(isWin && !prevWin){ haptic("win"); localStorage.setItem(hk, "1"); } else if(!isWin && prevWin){ localStorage.setItem(hk, "0"); } } }catch(e){}
  const el = document.createElement("div"); let cls = "card"; if(isPrimary) cls += " primary-card"; else cls += " secondary-card"; if(isLocked) cls += " is-locked"; if(isWin && !isLocked) cls += " is-winner"; el.className = cls;
  let badge = ""; if(isLocked) badge = `<div class="status-badge badge-locked">🔒 DÉBLOQUER L'OBJECTIF PRINCIPAL</div>`; else if(isWin) badge = `<div class="status-badge badge-winner">🎉 OBJECTIF VALIDÉ</div>`; else if(!isPrimary) badge = `<div class="status-badge badge-ready">💎 BONUS POTENTIEL</div>`;
  let earnedBadge = ""; let myGain = 0;
  if(obj.isFixed) { let win = false; if(obj.isNumeric) win = parseFloat(obj.current) >= obj.target; else win = pct >= 100; if(win && obj.paliers && obj.paliers[0]) myGain = parse(obj.paliers[0].prize); } else { if(obj.paliers) obj.paliers.forEach(p => { let unlocked = false; if(obj.isNumeric) unlocked = parseFloat(obj.current) >= p.threshold; else unlocked = pct >= p.threshold; if(unlocked) myGain += parse(p.prize); }); }
  if(!isLocked && myGain > 0) earnedBadge = `<div class="earned-badge-container"><div class="earned-badge">💶 Prime gagnée : ${(myGain*userRatio).toFixed(2)}€</div></div>`;
  let totalPotentialObj = 0; if(obj.isFixed){ totalPotentialObj = (obj.paliers && obj.paliers[0]) ? parse(obj.paliers[0].prize) : 0; } else { (obj.paliers||[]).forEach(p => { totalPotentialObj += parse(p.prize); }); }
  const remainingPotential = Math.max(0, (totalPotentialObj - myGain) * userRatio);
  const remainingHtml = (!isLocked && remainingPotential > 0.009) ? `<span class="remaining-potential">Reste <b>${remainingPotential.toFixed(2)}€</b> à débloquer</span>` : "";
  const graphBtn = (isAdminUser() && obj && obj._id) ? `<button class="obj-graph-btn" type="button" onclick="openObjectiveProgress('${obj._id}')" title="Suivi (graph)">📈</button>` : "";
  let middleHtml = "";
  if(obj.isFixed) { const prizeAmount = (obj.paliers && obj.paliers[0]) ? parse(obj.paliers[0].prize) : 0; middleHtml = `<div class="fixed-bonus-block ${isWin && !isLocked ? 'unlocked' : ''}"><div style="font-size:12px; text-transform:uppercase;">PRIME UNIQUE</div><div style="font-size:24px; font-weight:900;">${(prizeAmount * userRatio).toFixed(2)}€</div><div style="font-size:11px; margin-top:5px;">${isWin && !isLocked ? '✅ ACQUISE' : '🔒 À DÉBLOQUER'}</div></div>`; } 
  else { middleHtml = `<div class="milestones">`; const emojis = ['🥳','🚀','🔥']; (obj.paliers||[]).forEach((p, i) => { let u = false; if(obj.isNumeric) u = parseFloat(obj.current) >= p.threshold; else u = pct >= p.threshold; const valStep = parse(p.prize); const displayVal = (valStep * userRatio).toFixed(2); let labelTh = p.threshold + "%"; if(obj.isNumeric) labelTh = p.threshold; middleHtml += `<div class="ms-item ${u?'unlocked':''}"><div class="ms-threshold">${labelTh}</div><div class="ms-circle">${u?emojis[i%3]:(i+1)}</div><div class="ms-prize">+${displayVal}€</div></div>`; }); middleHtml += `</div>`; }
  let targetVal = obj.hideTarget ? '<span style="font-size:20px;">🔒</span>' : obj.target + (obj.isInverse ? '%' : ''); let currentVal = obj.hideCurrent ? '<span style="font-size:20px;">🔒</span>' : obj.current + (obj.isInverse ? '%' : ''); if(obj.isNumeric) { targetVal = obj.target; currentVal = obj.current; }
  let percentDisplay = pct.toFixed(1) + '%'; if(obj.isNumeric) { percentDisplay = `${Math.floor(obj.current)} / ${obj.target}`; } else if(obj.isInverse && pct >= 100) { percentDisplay = 'SUCCÈS'; }
  const w1 = Math.min(pct, 100); const w2 = pct > 100 ? Math.min(pct - 100, 100) : 0;
  el.innerHTML = `${badge}<div class="card-top"><div class="obj-info-group"><div class="obj-icon">${isPrimary?'⚡':'💎'}</div><div style="flex:1"><div class="obj-title-row"><h3 class="obj-title">${obj.name}</h3><div class="obj-title-actions">${remainingHtml}${graphBtn}</div></div><div style="font-size:12px; color:var(--text-muted); font-weight:700;">${isPrimary ? 'OBJECTIF OBLIGATOIRE' : 'BONUS SECONDAIRE'} ${obj.isInverse ? '📉 (Inversé)' : ''}</div></div></div></div><div class="data-boxes-row"><div class="data-box"><span class="data-box-label">ACTUEL</span><span class="data-box-value">${currentVal}</span></div><div class="data-box"><span class="data-box-label">CIBLE ${obj.isInverse ? '(MAX)' : ''}</span><span class="data-box-value">${targetVal}</span></div></div><div class="progress-track"><div class="percent-float">${percentDisplay}</div><div class="progress-fill ${isWin?'green-mode':''}" style="width:${w1}%"></div><div class="progress-overdrive" style="width:${w2}%"></div></div>${middleHtml}${earnedBadge}`;
  return el;
}

function toggleAdmin(show) { document.getElementById("adminPanel").classList.toggle("active", show); if(show) { renderAdminUsers(); renderSimulator(); } }
document.getElementById("btnAdmin").onclick = () => toggleAdmin(true);
function switchTab(t) {
   document.querySelectorAll('.btn-tab').forEach(b => b.classList.remove('active'));
   if(t === 'team') document.getElementById('btnTabTeam').classList.add('active');
   if(t === 'objs') document.getElementById('btnTabObjs').classList.add('active');
   if(t === 'logs') document.getElementById('btnTabLogs').classList.add('active');
   if(t === 'feedbacks') document.getElementById('btnTabFeedbacks').classList.add('active');
   if(t === 'emails') { const b = document.getElementById('btnTabEmails'); if(b) b.classList.add('active'); }
   document.getElementById('tab-team').style.display = t==='team'?'block':'none';
   document.getElementById('tab-objs').style.display = t==='objs'?'block':'none';
   document.getElementById('tab-logs').style.display = t==='logs'?'block':'none';
   document.getElementById('tab-feedbacks').style.display = t==='feedbacks'?'block':'none';
   const emailsTab = document.getElementById('tab-emails'); if(emailsTab) emailsTab.style.display = t==='emails'?'block':'none';
   if(t==='emails'){ try{ if(window.renderMailUI) window.renderMailUI(); }catch(e){} }
}
function toggleCreateInputs() { document.getElementById("createTiersBlock").style.display = document.getElementById("noFixed").checked ? 'none' : 'block'; }
function toggleEditInputs() { document.getElementById("editTiersBlock").style.display = document.getElementById("eoFixed").checked ? 'none' : 'block'; }

function addObj() {
   const name = document.getElementById("noName").value.trim(); const target = document.getElementById("noTarget").value.trim(); if(name.length < 2) { alert("⚠️ Le NOM est obligatoire."); return; } if(target.length < 1) { alert("⚠️ La CIBLE est obligatoire."); return; }
   const isFixed = document.getElementById("noFixed").checked; const isNumeric = document.getElementById("noNumeric").checked;
   let paliers = []; if(isFixed) { paliers = [{ threshold: 100, prize: "0" }]; } else { paliers = [{threshold: parseFloat(document.getElementById("c_p1t").value)||50, prize: "0"}, {threshold: parseFloat(document.getElementById("c_p2t").value)||100, prize: "0"}, {threshold: parseFloat(document.getElementById("c_p3t").value)||120, prize: "0"}]; }
   const id = "obj-" + Date.now();
   db.ref("objectives/"+id).set({ name: name, target: target, current: 0, published: true, isPrimary: document.getElementById("noPrimary").checked, isInverse: document.getElementById("noInverse").checked, isFixed: isFixed, isNumeric: isNumeric, paliers: paliers }).then(() => { showToast("✅ Objectif Ajouté !"); });
   logAction("Création Objectif", name);
}

function renderAdminObjs() {
  const pl = document.getElementById("pubList"); pl.innerHTML = ""; const ol = document.getElementById("objList"); if(ol) ol.innerHTML = "";
  Object.keys(allObjs).forEach(k => {
    const o = allObjs[k]; const d1 = document.createElement("div"); d1.className="user-item pub-row"; const state = o.published ? 'ACTIF' : 'INACTIF';
    d1.innerHTML = `<div class="user-info"><div class="user-header" style="gap:10px;"><span class="user-name">${o.name} ${o.isInverse?'📉':''} ${o.isFixed?'🎁':''}</span><span class="pub-state ${o.published?'on':'off'}">${state}</span></div><div class="user-meta">Publication + activation/désactivation</div></div><div class="user-actions"><label class="switch" title="Activer / désactiver"><input type="checkbox" ${o.published?'checked':''} onchange="togglePub('${k}', this.checked)"><span class="slider"></span></label><div class="btn-group"><button onclick="openObjectiveProgress('${k}')" class="action-btn" title="Suivi (graph)">📈</button><button onclick="openEditObj('${k}')" class="action-btn" title="Modifier">✏️</button><button onclick="deleteObj('${k}')" class="action-btn delete" title="Supprimer">🗑️</button></div></div>`;
    pl.appendChild(d1);
    if(ol){ const d2 = document.createElement("div"); d2.className="user-item"; d2.id = "row-" + k; d2.innerHTML = `<span>${o.name} ${o.isInverse?'📉':''} ${o.isFixed?'🎁':''}</span><div style="display:flex; gap:10px;"><button onclick="openEditObj('${k}')" class="action-btn">✏️</button> <button onclick="deleteObj('${k}')" class="action-btn delete">🗑️</button></div>`; ol.appendChild(d2); }
  });
}

function openEditObj(id) {
  const o = allObjs[id]; document.getElementById("editObjPanel").classList.add("active"); document.getElementById("eoId").value = id;
  document.getElementById("eoName").value = o.name; document.getElementById("eoCurrent").value = o.current; document.getElementById("eoTarget").value = o.target;
  document.getElementById("eoPrimary").checked = o.isPrimary; document.getElementById("eoInverse").checked = o.isInverse || false;
  document.getElementById("eoFixed").checked = o.isFixed || false; document.getElementById("eoNumeric").checked = o.isNumeric || false; toggleEditInputs(); 
  if(o.paliers && o.paliers.length > 0) { if(o.isFixed) { document.getElementById("eoFixedPrize").value = o.paliers[0].prize; } else { if(o.paliers[0]) { document.getElementById("p1t").value = o.paliers[0].threshold; document.getElementById("p1p").value = o.paliers[0].prize; } if(o.paliers[1]) { document.getElementById("p2t").value = o.paliers[1].threshold; document.getElementById("p2p").value = o.paliers[1].prize; } if(o.paliers[2]) { document.getElementById("p3t").value = o.paliers[2].threshold; document.getElementById("p3p").value = o.paliers[2].prize; } } }
  document.getElementById("eoHideTarget").checked = o.hideTarget || false; document.getElementById("eoHideCurrent").checked = o.hideCurrent || false;
}

function saveObj() {
  const id = document.getElementById("eoId").value; const isFixed = document.getElementById("eoFixed").checked; const newName = document.getElementById("eoName").value; const newCurrentRaw = document.getElementById("eoCurrent").value; const newTargetRaw = document.getElementById("eoTarget").value; const newIsInverse = document.getElementById("eoInverse").checked; const newIsNumeric = document.getElementById("eoNumeric").checked;
  let paliers = []; const oldP = allObjs[id].paliers || [];
  if(isFixed) { paliers = [{ threshold: 100, prize: oldP[0]?oldP[0].prize:"0" }]; } else { paliers = [ {threshold: parseFloat(document.getElementById("p1t").value), prize: oldP[0]?oldP[0].prize:"0"}, {threshold: parseFloat(document.getElementById("p2t").value), prize: oldP[1]?oldP[1].prize:"0"}, {threshold: parseFloat(document.getElementById("p3t").value), prize: oldP[2]?oldP[2].prize:"0"} ]; }
  db.ref("objectives/"+id).update({ name: newName, current: newCurrentRaw, target: newTargetRaw, isPrimary: document.getElementById("eoPrimary").checked, isInverse: newIsInverse, isFixed: isFixed, isNumeric: newIsNumeric, hideTarget: document.getElementById("eoHideTarget").checked, hideCurrent: document.getElementById("eoHideCurrent").checked, paliers: paliers }).then(() => {
      showToast("✅ Objectif Modifié !"); document.getElementById("editObjPanel").classList.remove("active");
      try{ const oName = String(newName||"Objectif"); const curNum = parseFloat(String(newCurrentRaw).replace(',', '.')); const tarNum = parseFloat(String(newTargetRaw).replace(',', '.')); const hideCur = !!document.getElementById("eoHideCurrent").checked; const hideTar = !!document.getElementById("eoHideTarget").checked; let msg = ""; if((hideCur || hideTar) && isFinite(curNum) && isFinite(tarNum)) { const pct = getPct(curNum, tarNum, newIsInverse); msg = `${oName} : ${pct.toFixed(0)}%`; } else if(isFinite(curNum) && isFinite(tarNum)) { msg = `${oName} : ${curNum}/${tarNum}`; } else { msg = `${oName} mis à jour`; } _maybeAutoNotify('objective', { title: "🎯 Objectif mis à jour", body: msg, link: "/index.html#dashboard" }); }catch(e){}
      try{ const now = new Date(); const y = now.getFullYear(); const m = String(now.getMonth()+1).padStart(2,'0'); const d = String(now.getDate()).padStart(2,'0'); const dayKey = `${y}-${m}-${d}`; const curNum = parseFloat(String(newCurrentRaw).replace(',', '.')); const tarNum = parseFloat(String(newTargetRaw).replace(',', '.')); if(isFinite(curNum)){ const payload = { updatedAt: Date.now(), by: (currentUser && currentUser.name) ? currentUser.name : 'Admin', current: curNum }; if(isFinite(tarNum)) payload.target = tarNum; if(isFinite(tarNum)){ const pct = getPct(curNum, tarNum, newIsInverse); payload.pct = pct; payload.value = pct; } db.ref(`objectiveProgress/${id}/${dayKey}`).set(payload); } }catch(e){}
  });
  logAction("Modification", "Objectif : " + newName);
}

function deleteObj(id) { if(confirm("🗑️ Supprimer ?")) { db.ref("objectives/"+id).remove().then(() => showToast("🗑️ Supprimé")); logAction("Suppression", `Objectif ${id}`); } }
function togglePub(id, v) { db.ref("objectives/"+id+"/published").set(v); logAction("Publication", `Objectif ${id}: ${v}`); }
function createUser() {
    const name = document.getElementById('nuName').value;
    const email = document.getElementById('nuEmail').value;
    const hours = document.getElementById('nuHours').value;
    const isAdmin = document.getElementById('nuAdmin').checked;

    if(!name || !email) return alert("Nom et Email requis");

    // Génération d'un mot de passe aléatoire invisible
    const tempPassword = Math.random().toString(36).slice(-10) + "Aa1!";

    firebase.auth().createUserWithEmailAndPassword(email, tempPassword)
        .then((userCredential) => {
            // Envoi immédiat du mail de configuration du mot de passe
            firebase.auth().sendPasswordResetEmail(email);
            
            const uid = userCredential.user.uid;
            return firebase.database().ref('users/' + uid).set({
                name: name,
                email: email,
                hours: parseInt(hours) || 35,
                role: isAdmin ? 'admin' : 'staff',
                status: 'pending'
            });
        })
        .then(() => {
            showToast("✅ Membre créé ! Invitation envoyée par mail.");
            document.getElementById('nuName').value = "";
            document.getElementById('nuEmail').value = "";
            document.getElementById('nuHours').value = "";
            document.getElementById('nuAdmin').checked = false;
        })
        .catch(err => alert("Erreur : " + err.message));
}
function renderAdminUsers() { 
    const d = document.getElementById("usersList"); if(!d) return; d.innerHTML = ""; let totalToPay = 0;
    const entries = Object.keys(allUsers || {}).map(uid => ({ uid, u: (allUsers[uid] || {}) })).filter(e => !(e.u.email && String(e.u.email).toLowerCase() === String(SUPER_ADMIN_EMAIL||'').toLowerCase()));
    const eligibleEntries = []; const ineligibleEntries = []; entries.forEach(e => { const isEligible = (e.u.primeEligible !== false); (isEligible ? eligibleEntries : ineligibleEntries).push(e); });
    const nameSort = (a,b) => { const an = (a.u.name || a.u.email || a.uid || '').toString(); const bn = (b.u.name || b.u.email || b.uid || '').toString(); return an.localeCompare(bn, 'fr', { sensitivity: 'base' }); };
    eligibleEntries.sort(nameSort); ineligibleEntries.sort(nameSort);
    function computeUserBonus(u){
      const userRatio = (u.hours || 35) / BASE_HOURS; let userBonus = 0;
      const prims = Object.values(allObjs).filter(o => o.isPrimary && o.published); let primOk = true; if(prims.length > 0) { primOk = prims.every(o => { let threshold = 100; if(o.isFixed) threshold = 100; else if(o.paliers && o.paliers[0]) threshold = o.paliers[0].threshold; if(o.isNumeric) return parseFloat(o.current) >= threshold; const pct = getPct(o.current, o.target, o.isInverse); return pct >= threshold; }); } 
      Object.values(allObjs).forEach(o => { if(!o.published) return; const pct = getPct(o.current, o.target, o.isInverse); const isLocked = !o.isPrimary && !primOk; let g = 0; if(o.isFixed) { let win = false; if(o.isNumeric) win = parseFloat(o.current) >= o.target; else win = pct >= 100; if(win && o.paliers && o.paliers[0]) g = parse(o.paliers[0].prize); } else { if(o.paliers) o.paliers.forEach(p => { let unlocked = false; if(o.isNumeric) unlocked = parseFloat(o.current) >= p.threshold; else unlocked = pct >= p.threshold; if(unlocked) g += parse(p.prize); }); } if(!isLocked) userBonus += (g * userRatio); }); return userBonus;
    }
   function renderUser(uid, u, isEligible){
      const userBonus = isEligible ? computeUserBonus(u) : 0; if(isEligible) totalToPay += userBonus;
      const div = document.createElement("div"); div.className = "user-item"; 
      const statusClass = (u.status === 'active') ? 'active' : 'pending'; 
      const statusLabel = (u.status === 'active') ? 'ACTIF' : 'EN ATTENTE'; 
      let adminBadge = ""; if(u.role === 'admin') adminBadge = `<span class="admin-tag">ADMIN</span>`; 
      const checked = isEligible ? 'checked' : ''; 
      const gain = isEligible ? userBonus.toFixed(2) + '€' : '—';

      div.innerHTML = `
        <div class="user-info">
          <div class="user-header">
            <span class="user-name">${u.name || ''} ${adminBadge}</span>
            <div style="display:flex; align-items:center;">
              <span class="status-dot ${statusClass}"></span>
              <span class="status-text">${statusLabel}</span>
            </div>
          </div>
          <div class="user-email-sub">${u.email || ''}</div>
          <div class="user-meta">${u.hours || 35}h</div>
          <label class="check-label" style="margin-top:6px; font-size:11px; opacity:.95;">
            <input type="checkbox" ${checked} onchange="setUserPrimeEligible('${uid}', this.checked)"> 💶 Compte dans les primes
          </label>
        </div>
        <div class="user-actions">
          <div class="user-gain">${gain}</div>
          <div class="btn-group"></div>
        </div>`;

      const btnGroup = div.querySelector('.btn-group');

      // BOUTON CLÉ (🔑)
      const btnReset = document.createElement('button');
      btnReset.innerHTML = '🔑';
      btnReset.className = 'action-btn';
      btnReset.title = "Renvoyer l'email de configuration";
      btnReset.onclick = () => {
          if(confirm(`Envoyer un lien de configuration de mot de passe à ${u.email} ?`)) {
              firebase.auth().sendPasswordResetEmail(u.email)
                  .then(() => showToast("✅ Email envoyé !"))
                  .catch(err => alert("❌ Erreur : " + err.message));
          }
      };

      const btnArchive = document.createElement('button');
      btnArchive.innerHTML = '📄';
      btnArchive.className = 'action-btn';
      btnArchive.onclick = () => openTeamArchive(uid);

      const btnEdit = document.createElement('button');
      btnEdit.innerHTML = '✏️';
      btnEdit.className = 'action-btn';
      btnEdit.onclick = () => editUser(uid);

      const btnDel = document.createElement('button');
      btnDel.innerHTML = '🗑️';
      btnDel.className = 'action-btn delete';
      btnDel.onclick = () => deleteUser(uid);

      btnGroup.appendChild(btnReset);
      btnGroup.appendChild(btnArchive);
      btnGroup.appendChild(btnEdit);
      btnGroup.appendChild(btnDel);

      d.appendChild(div); 
    }
function setUserPrimeEligible(uid, isEligible){
  if(!isAdminUser()) return; const val = !!isEligible; const prev = (allUsers && allUsers[uid]) ? (allUsers[uid].primeEligible !== false) : true;
  try{ if(allUsers && allUsers[uid]) allUsers[uid].primeEligible = val; renderAdminUsers(); }catch(e){}
  db.ref('users/' + uid + '/primeEligible').set(val).then(() => { try{ logAction('Équipe', `PrimeEligible ${uid} -> ${val}`); }catch(e){} try{ showToast(val ? '✅ Compte inclus dans les primes' : '🚫 Compte exclu des primes'); }catch(e){} }).catch(() => { try{ if(allUsers && allUsers[uid]) allUsers[uid].primeEligible = prev; renderAdminUsers(); }catch(e){} try{ showToast('Erreur mise à jour.'); }catch(e){} });
}
window.setUserPrimeEligible = setUserPrimeEligible;

function renderLogs(logs) {
  const container = document.getElementById("logsContainer"); if(!container) return; container.innerHTML = "";
  if (!logs || Object.keys(logs).length === 0) { container.innerHTML = "<div style='text-align:center; padding:20px; color:#999;'>Aucun historique disponible.</div>"; return; }
  const grouped = {};
  Object.values(logs).forEach(log => {
      if(!log.user) return; if(!grouped[log.user]) grouped[log.user] = { lastSeen: 0, sessions: [], actions: [] };
      const time = log.time || log.startTime || 0;
      if(log.type === 'session') { grouped[log.user].sessions.push(log); } else { grouped[log.user].actions.push(log); }
      const activityTime = log.lastSeen || log.time || 0; if(activityTime > grouped[log.user].lastSeen) grouped[log.user].lastSeen = activityTime;
  });
  const sortedUsers = Object.keys(grouped).sort((a,b) => grouped[b].lastSeen - grouped[a].lastSeen);
  sortedUsers.forEach(uName => {
      const g = grouped[uName]; const d = new Date(g.lastSeen); g.sessions.sort((a,b) => b.startTime - a.startTime); g.actions.sort((a,b) => b.time - a.time);
      const safeId = 'log-group-' + uName.replace(/[^a-zA-Z0-9]/g, '');
      const div = document.createElement("div"); div.className = "log-user-group";
      div.innerHTML = `<div class="group-header" onclick="toggleUserLogs('${safeId}')"><div class="group-info" style="flex:1;">👤 ${escapeHtml(uName)} <span style="font-weight:400; font-size:11px; color:var(--text-muted); margin-left:10px;">(Dernier : ${d.toLocaleString()}) ▼</span></div><button onclick="event.stopPropagation(); deleteUserLogs('${uName}')" class="btn-clear-hist" title="Effacer historique">🗑️</button></div><div class="group-body" id="${safeId}"><div><div class="log-col-title">🔌 Connexions</div><div class="log-list" id="sess-${safeId}"></div></div><div><div class="log-col-title">🛠️ Activité</div><div class="log-list" id="act-${safeId}"></div></div></div>`;
      container.appendChild(div);
      const sc = document.getElementById(`sess-${safeId}`); 
      if(g.sessions.length===0) sc.innerHTML='<div class="log-entry" style="color:#ccc;">Rien</div>'; 
      else g.sessions.slice(0, 20).forEach(s=>{ const st=new Date(s.startTime); const m=Math.floor((s.lastSeen-s.startTime)/60000); const dt=(m>60)?Math.floor(m/60)+"h "+(m%60)+"m":m+"m"; sc.innerHTML+=`<div class="log-entry"><span class="log-dot">🟢</span><span class="log-time-s">${st.toLocaleDateString().slice(0,5)} ${st.toLocaleTimeString().slice(0,5)}</span><span class="log-dur">${dt}</span></div>`; });
      const ac = document.getElementById(`act-${safeId}`); 
      if(g.actions.length===0) ac.innerHTML='<div class="log-entry" style="color:#ccc;">Rien</div>'; 
      else g.actions.slice(0, 50).forEach(a=>{ const at=new Date(a.time); ac.innerHTML+=`<div class="log-entry"><span class="log-dot">🔵</span><span class="log-time-s">${at.toLocaleDateString().slice(0,5)} ${at.toLocaleTimeString().slice(0,5)}</span><span class="log-desc">${escapeHtml(a.action)} <span style="color:#94a3b8;">${escapeHtml(a.detail)}</span></span></div>`; });
  });
}

function deleteUserLogs(targetName) {
    if(confirm("🗑️ Effacer tout l'historique de " + targetName + " ?")) {
        const updates = {}; Object.keys(window.allLogs).forEach(k => { if(window.allLogs[k].user === targetName) updates['logs/'+k] = null; });
        db.ref().update(updates).then(() => showToast("Historique nettoyé !"));
    }
}
function toggleUserLogs(id) { const el = document.getElementById(id); if(el) el.classList.toggle('open'); }

function editUser(uid) { const u = allUsers[uid]; document.getElementById("editUserPanel").classList.add("active"); document.getElementById("euId").value = uid; document.getElementById("euName").value = u.name; document.getElementById("euHours").value = u.hours; document.getElementById("euAdmin").checked = (u.role === 'admin'); }
function saveUser() { db.ref('users/'+document.getElementById("euId").value).update({ name: document.getElementById("euName").value, hours: parseFloat(document.getElementById("euHours").value), role: document.getElementById("euAdmin").checked ? 'admin' : 'staff' }); document.getElementById("editUserPanel").classList.remove("active"); showToast("✅ Modifié"); }
function deleteUser(uid) { if(confirm("Supprimer ?")) { db.ref('users/'+uid).remove(); showToast("🗑️ Supprimé"); } }

// Graph helper
function _isoToLocalTs(iso){ if(!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return NaN; const p = String(iso).split('-'); const y = parseInt(p[0],10); const m = parseInt(p[1],10); const d = parseInt(p[2],10); if(!isFinite(y)||!isFinite(m)||!isFinite(d)) return NaN; return new Date(y, m-1, d).getTime(); }
function _formatIsoDateFR(iso){ const ts = _isoToLocalTs(iso); if(!isFinite(ts)) return iso || ''; const d = new Date(ts); const day = d.getDate(); let month = d.toLocaleDateString('fr-FR', { month: 'long' }); const year = d.getFullYear(); month = month ? (month.charAt(0).toUpperCase() + month.slice(1)) : ''; return `${day} ${month} ${year}`.trim(); }
let _objProgHit = [];
function _bindObjProgCanvas(){
  const canvas = document.getElementById('objProgCanvas'); if(!canvas || canvas._bound) return; canvas._bound = true;
  const tip = document.getElementById('objProgTooltip'); const hideTip = () => { if(tip) tip.style.display = 'none'; };
  const showTip = (text, cssX, cssY, rect) => {
    if(!tip) return; tip.textContent = text; tip.style.display = 'block'; const wrap = tip.parentElement;
    const w = (wrap && wrap.clientWidth) ? wrap.clientWidth : rect.width; const h = (wrap && wrap.clientHeight) ? wrap.clientHeight : rect.height; const tw = tip.offsetWidth || 180; const th = tip.offsetHeight || 44; let left = cssX + 12; let top = cssY - (th + 12); if(left + tw > w) left = Math.max(6, w - tw - 6); if(top < 6) top = cssY + 12; if(top + th > h) top = Math.max(6, h - th - 6); tip.style.left = left + 'px'; tip.style.top = top + 'px';
  };
  const findNearest = (x, y) => { let best = null; let bestD = 1e9; for(const p of (_objProgHit || [])){ const dx = x - p.x; const dy = y - p.y; const d = Math.sqrt(dx*dx + dy*dy); if(d < bestD){ bestD = d; best = p; } } return { best, bestD }; };
  canvas.style.cursor = 'default';
  canvas.addEventListener('mousemove', (ev) => { if(!_objProgHit || !_objProgHit.length){ hideTip(); canvas.style.cursor = 'default'; return; } const rect = canvas.getBoundingClientRect(); const scaleX = canvas.width / Math.max(1, rect.width); const scaleY = canvas.height / Math.max(1, rect.height); const x = (ev.clientX - rect.left) * scaleX; const y = (ev.clientY - rect.top) * scaleY; const { best, bestD } = findNearest(x, y); if(best && bestD <= 18){ canvas.style.cursor = 'pointer'; const cssX = best.x / scaleX; const cssY = best.y / scaleY; showTip(best.label, cssX, cssY, rect); } else { hideTip(); canvas.style.cursor = 'default'; } });
  canvas.addEventListener('mouseleave', () => { hideTip(); canvas.style.cursor = 'default'; });
  canvas.addEventListener('click', (ev) => { if(!_objProgHit || !_objProgHit.length) return; const rect = canvas.getBoundingClientRect(); const scaleX = canvas.width / Math.max(1, rect.width); const scaleY = canvas.height / Math.max(1, rect.height); const x = (ev.clientX - rect.left) * scaleX; const y = (ev.clientY - rect.top) * scaleY; const { best, bestD } = findNearest(x, y); if(best && bestD <= 18){ showToast(best.label); } });
}
function _getObjProgMode(o){ if(!o) return 'pct'; if(o.hideCurrent || o.hideTarget) return 'pct'; if(o.isNumeric) return 'num'; return 'pct'; }
function openObjectiveProgress(objId){
  if(!isAdminUser()) return; const o = allObjs[objId]; if(!o) return; _objProgId = objId; _objProgMode = _getObjProgMode(o);
  const n = document.getElementById('objProgName'); if(n) n.textContent = o.name || objId;
  const label = document.getElementById('objProgValueLabel'); const vEl = document.getElementById('objProgValue'); if(label){ label.textContent = (_objProgMode === 'num') ? 'VALEUR (NOMBRE)' : 'PROGRESSION (%)'; } if(vEl){ vEl.value = ''; vEl.placeholder = (_objProgMode === 'num') ? 'ex: 12' : 'ex: 22'; vEl.step = (_objProgMode === 'num') ? '1' : '0.1'; }
  const modal = document.getElementById('objectiveProgressModal'); if(modal) modal.style.display = 'flex';
  const dEl = document.getElementById('objProgDate'); if(dEl){ const now = new Date(); const y = now.getFullYear(); const m = String(now.getMonth()+1).padStart(2,'0'); const d = String(now.getDate()).padStart(2,'0'); dEl.value = `${y}-${m}-${d}`; }
  _bindObjProgCanvas(); _refreshObjectiveProgress();
}
function closeObjectiveProgress(){ const modal = document.getElementById('objectiveProgressModal'); if(modal) modal.style.display = 'none'; _objProgId = null; if(_objProgUnsub){ try{ _objProgUnsub.off(); }catch(e){} } _objProgUnsub = null; }
function _computeObjProgRows(data){
  const o = allObjs[_objProgId]; const mode = _objProgMode; const rowsRaw = Object.keys(data||{}).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)).map(k => ({ id:k, date:k, ...(data[k]||{}) })).sort((a,b) => String(a.date).localeCompare(String(b.date)));
  const out = []; rowsRaw.forEach(r => { const cur = (r.current != null) ? parseFloat(r.current) : NaN; const tar = (r.target != null) ? parseFloat(r.target) : (o && o.target != null ? parseFloat(o.target) : NaN); const pct = (r.pct != null) ? parseFloat(r.pct) : (r.value != null) ? parseFloat(r.value) : (isFinite(cur) && isFinite(tar)) ? getPct(cur, tar, !!(o && o.isInverse)) : NaN; if(mode === 'num'){ let y = cur; if(!isFinite(y)){ if(isFinite(pct) && isFinite(tar) && !(o && o.isInverse)) y = (pct/100) * tar; } if(isFinite(y)) out.push({ ...r, _y: y, _pct: isFinite(pct) ? pct : (isFinite(tar) ? getPct(y, tar, !!(o && o.isInverse)) : NaN) }); } else { if(isFinite(pct)) out.push({ ...r, _y: pct, _pct: pct }); } }); return out;
}
function _refreshObjectiveProgress(){
  if(!_objProgId) return; const list = document.getElementById('objProgList'); if(list) list.innerHTML = '<div style="text-align:center; color:#999;">Chargement...</div>';
  const ref = db.ref(`objectiveProgress/${_objProgId}`); if(_objProgUnsub){ try{ _objProgUnsub.off(); }catch(e){} } _objProgUnsub = ref;
  ref.on('value', snap => {
    const data = snap.val() || {}; const rows = _computeObjProgRows(data); _drawObjectiveProgress(rows, _objProgMode);
    if(!list) return; if(rows.length === 0){ list.innerHTML = '<div style="text-align:center; color:var(--text-muted); font-weight:800;">Aucune donnée.</div>'; return; }
    list.innerHTML = ''; rows.slice().reverse().forEach(r => { const div = document.createElement('div'); div.className = 'user-item'; const badge = (_objProgMode === 'num') ? `${Number(r._y).toLocaleString('fr-FR')} <span style="opacity:.75; font-weight:900;">(${Number(r._pct).toFixed(1)}%)</span>` : `${Number(r._pct).toFixed(1)}%`; div.innerHTML = `<div class="user-info"><div class="user-header" style="gap:10px;"><span class="user-name">${_formatIsoDateFR(r.date)}</span><span class="pub-state on" style="text-transform:none;">${badge}</span></div><div class="user-meta">Mise à jour</div></div><div class="user-actions"><div class="btn-group"><button class="action-btn delete" title="Supprimer" onclick="deleteObjectiveProgressPoint('${r.id}')">🗑️</button></div></div>`; list.appendChild(div); });
  });
}
function addObjectiveProgressPoint(){
  if(!_objProgId || !isAdminUser()) return; const o = allObjs[_objProgId]; const dEl = document.getElementById('objProgDate'); const vEl = document.getElementById('objProgValue'); const date = dEl ? String(dEl.value||'').trim() : ''; const raw = vEl ? parseFloat(String(vEl.value||'')) : NaN;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) { alert('Date invalide.'); return; } if(!isFinite(raw)) { alert('Valeur invalide.'); return; }
  const payload = { updatedAt: Date.now(), by: (currentUser && currentUser.name) ? currentUser.name : 'Admin' };
  if(_objProgMode === 'num'){ payload.current = raw; const tar = (o && o.target != null) ? parseFloat(o.target) : NaN; if(isFinite(tar)) payload.target = tar; if(isFinite(tar)){ const pct = getPct(raw, tar, !!(o && o.isInverse)); payload.pct = pct; payload.value = pct; } } else { payload.pct = raw; payload.value = raw; }
  db.ref(`objectiveProgress/${_objProgId}/${date}`).set(payload).then(() => { showToast('✅ Ajouté'); if(vEl) vEl.value=''; }).catch(()=>{});
}
function deleteObjectiveProgressPoint(pointId){ if(!_objProgId || !isAdminUser()) return; if(!confirm('Supprimer ce point ?')) return; db.ref(`objectiveProgress/${_objProgId}/${pointId}`).remove().then(() => showToast('🗑️ Supprimé')); }
function _drawObjectiveProgress(rows, mode){
  const canvas = document.getElementById('objProgCanvas'); if(!canvas) return; const ctx = canvas.getContext('2d'); const w = canvas.width; const h = canvas.height; ctx.clearRect(0,0,w,h);
  const isDark = document.body.classList.contains('dark-mode'); ctx.fillStyle = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'; ctx.fillRect(0,0,w,h);
  const pad = 28; ctx.strokeStyle = isDark ? 'rgba(148,163,184,0.25)' : 'rgba(17,24,39,0.18)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad, pad); ctx.lineTo(pad, h-pad); ctx.lineTo(w-pad, h-pad); ctx.stroke();
  if(!rows || rows.length < 1) return;
  const xs = rows.map(r => _isoToLocalTs(r.date)).filter(t => isFinite(t)); if(xs.length === 0) return; const minX = Math.min(...xs); const maxX = Math.max(...xs); const spanX = Math.max(1, maxX - minX);
  let minY = 0; let maxY = 100; if(mode === 'num'){ const ys = rows.map(r => Number(r._y)).filter(v => isFinite(v)); if(ys.length){ minY = 0; maxY = Math.max(1, Math.max(...ys) * 1.10); } } const spanY = Math.max(1e-9, maxY - minY);
  const pts = rows.map(r => { const tx = _isoToLocalTs(r.date); const vx = (tx - minX) / spanX; const vy = (Number(r._y) - minY) / spanY; const x = pad + vx * (w - 2*pad); const y = (h - pad) - vy * (h - 2*pad); return { x, y }; });
  _objProgHit = pts.map((p, i) => { const r = rows[i]; const dateIso = (r && r.date) ? r.date : ''; const date = _formatIsoDateFR(dateIso); let label = date; if(mode === 'num'){ const v = (r && isFinite(r._y)) ? Number(r._y) : NaN; const pct = (r && isFinite(r._pct)) ? Number(r._pct) : NaN; if(isFinite(v) && isFinite(pct)) label = `${date} — ${v.toLocaleString('fr-FR')} (${pct.toFixed(1)}%)`; else if(isFinite(v)) label = `${date} — ${v.toLocaleString('fr-FR')}`; else if(isFinite(pct)) label = `${date} — ${pct.toFixed(1)}%`; } else { const pct = (r && isFinite(r._pct)) ? Number(r._pct) : NaN; if(isFinite(pct)) label = `${date} — ${pct.toFixed(1)}%`; } return { x: p.x, y: p.y, label }; });
  ctx.strokeStyle = isDark ? 'rgba(59,130,246,0.85)' : 'rgba(37,99,235,0.90)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
  ctx.fillStyle = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(17,24,39,0.88)'; pts.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle = isDark ? 'rgba(59,130,246,0.55)' : 'rgba(37,99,235,0.45)'; ctx.lineWidth = 2; ctx.stroke(); });
}

function getPct(c, t, isInverse) {
  let cv = parseFloat(String(c).replace(',', '.')); let tv = parseFloat(String(t).replace(',', '.')); if(isNaN(cv) || isNaN(tv)) return 0;
  if(isInverse) { if(cv > tv) return 0; if(cv <= tv) return 100; return 0; }
  if(!tv) return 0; return (cv/tv)*100;
}
function parse(s) { return parseFloat(String(s).replace(/[^0-9.]/g,''))||0; }

// PWA
if('serviceWorker' in navigator){ 
    navigator.serviceWorker.addEventListener('controllerchange', () => { 
        if(!window.__swReloaded){ window.__swReloaded = true; window.location.reload(); } 
    }); 
}

// ============================================================
// GESTION DES NOTIFICATIONS (BANNIÈRE INTELLIGENTE)
// ============================================================

const VAPID_KEY = "BHItjKUG0Dz7jagVmfULxS7B_qQcT0DM7O_11fKdERKFzxP3QiWisJoD3agcV22VYFhtpVw-9YuUzrRmCZIawyo";

function checkNotificationStatus() {
    // Si le navigateur ne gère pas les notifs, on arrête
    if (!('Notification' in window)) return;
    
    // Si déjà accepté ou refusé, on ne montre rien
    if (Notification.permission === 'granted' || Notification.permission === 'denied') return;
    
    // Si l'utilisateur a fermé MANUELLEMENT la bannière "pour toujours"
    if (localStorage.getItem('heiko_push_banner_dismissed')) return;

    // SINON : On affiche la bannière
    const banner = document.getElementById('pushPermissionBanner');
    if (banner) {
        banner.style.display = 'flex'; // On l'affiche
        
        // --- ANIMATION : DU HAUT VERS LE CENTRE ---
        // 1. Position de départ : Caché tout en haut (-100px plus haut que sa position finale)
        banner.style.opacity = '0';
        banner.style.transition = 'none'; // Pas d'anim au placement initial
        banner.style.transform = 'translate(-50%, -100px)'; 
        
        // 2. Animation vers la position finale (top: 15%)
        setTimeout(() => {
             banner.style.transition = 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'; // Effet rebond "Bounce"
             banner.style.opacity = '1';
             banner.style.transform = 'translate(-50%, 0)'; // Arrive à sa place définie par le CSS
        }, 100);
    }
}

function dismissPushBanner() {
    const banner = document.getElementById('pushPermissionBanner');
    if (banner) banner.style.display = 'none';
    // On retient que l'utilisateur a fermé la bannière pour ne plus l'embêter
    localStorage.setItem('heiko_push_banner_dismissed', 'true');
}

async function enableNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    alert("Ton téléphone ne supporte pas les notifications.");
    return;
  }
  
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

  if (isIos && !isStandalone) {
    alert("📢 Pour activer les notifs sur iPhone :\n1. Clique sur Partager (carré avec flèche)\n2. Choisis 'Sur l'écran d'accueil'\n3. Ouvre l'app depuis l'accueil et réessaie.");
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
        const banner = document.getElementById('pushPermissionBanner');
        if (banner) banner.style.display = 'none';

        const messaging = firebase.messaging();
        const token = await messaging.getToken({ vapidKey: VAPID_KEY });
        
        if (token && currentUser && currentUser.uid) {
            await db.ref('users/' + currentUser.uid).update({ 
                fcmToken: token,
                pushEnabled: true,
                lastTokenUpdate: Date.now()
            });
            showToast("✅ Notifications activées !");
            const btn = document.getElementById('btnEnablePush');
            if(btn) { btn.innerHTML = "<span>🔔 Notifs actives</span>"; btn.style.opacity = "0.5"; }
        }
    } else {
        alert("Tu as refusé les notifications.");
        dismissPushBanner();
    }
  } catch (error) {
    console.error("Erreur notifs:", error);
  }
} // <--- Fermeture de enableNotifications

// Exposer les fonctions
window.enableNotifications = enableNotifications;
window.dismissPushBanner = dismissPushBanner;
// --- FIN DU FICHIER ---
