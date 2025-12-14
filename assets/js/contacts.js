// Contacts & Sites utiles (page dédiée)
// - Firebase persistant
// - Admin & Super Admin : CRUD
// - Autres : lecture seule

// CONFIG (identique au dashboard)
const firebaseConfig = {
  apiKey: "AIzaSyAGaitqmFwExvJ9ZUpkdUdCKAqqDOP2cdQ",
  authDomain: "objectif-restaurant.firebaseapp.com",
  databaseURL: "https://objectif-restaurant-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "objectif-restaurant",
  storageBucket: "objectif-restaurant.firebasestorage.app",
  messagingSenderId: "910113283000",
  appId: "1:910113283000:web:0951fd9dca01aa6e46cd4d"
};

if(!firebase.apps || firebase.apps.length === 0) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

const SUPER_ADMIN_EMAIL = "teddy.frey1@gmail.com";

let currentUser = null;
let canEdit = false;
let currentTab = "contacts";
let editingType = null; // 'contact' | 'site'
let editingKey = null;

// Data (live)
let contactsData = {};
let sitesData = {};

// THEME
if(localStorage.getItem('heiko_dark_mode') === null) {
  localStorage.setItem('heiko_dark_mode', 'true');
}
if(localStorage.getItem('heiko_dark_mode') === 'true') {
  document.body.classList.add('dark-mode');
}
window.addEventListener('DOMContentLoaded', () => {
  const icon = document.querySelector('.toggle-icon');
  if(icon) icon.textContent = document.body.classList.contains('dark-mode') ? '☀️' : '🌙';
});
function toggleDarkMode(){
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  localStorage.setItem('heiko_dark_mode', isDark);
  const icon = document.querySelector('.toggle-icon');
  if(icon) icon.textContent = isDark ? '☀️' : '🌙';
}

// --- PWA: service worker + bouton d'installation (si disponible) ---
(function initPWA(){
  if('serviceWorker' in navigator){
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = document.getElementById('installAppBtn');
    if(btn){
      btn.style.display = 'inline-flex';
      btn.onclick = async () => {
        try{
          btn.disabled = true;
          deferredPrompt.prompt();
          await deferredPrompt.userChoice;
        } catch(_){ }
        deferredPrompt = null;
        btn.style.display = 'none';
        btn.disabled = false;
      };
    }
  });
  window.addEventListener('appinstalled', () => {
    const btn = document.getElementById('installAppBtn');
    if(btn) btn.style.display = 'none';
    deferredPrompt = null;
  });
})();

// AUTH UI helpers
document.getElementById("btnLogin").onclick = () => {
  const email = document.getElementById("loginEmail").value.trim();
  const pass = document.getElementById("loginPass").value;
  auth.signInWithEmailAndPassword(email, pass).catch(() => {
    document.getElementById("loginPass").classList.add("error");
    document.getElementById("loginEmail").classList.add("error");
    setTimeout(() => {
      document.getElementById("loginPass").classList.remove("error");
      document.getElementById("loginEmail").classList.remove("error");
    }, 1000);
    alert("❌ Mot de passe incorrect !");
  });
};
function clearLoginError(){
  document.getElementById("loginPass").classList.remove("error");
  document.getElementById("loginEmail").classList.remove("error");
}
function togglePass(){
  const x = document.getElementById("loginPass");
  x.type = (x.type === "password") ? "text" : "password";
}
function logout(){ auth.signOut(); location.href = "index.html"; }
window.resetPassword = () => {
  let email = document.getElementById("loginEmail").value.trim();
  if (!email) email = prompt("Email pour réinitialisation :");
  if(email) auth.sendPasswordResetEmail(email).then(() => alert("Email envoyé !")).catch(e => alert(e.message));
};

function showToast(message){
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = "show";
  setTimeout(() => { toast.className = "hide"; }, 2500);
}

// AUTH STATE
auth.onAuthStateChanged(user => {
  if(user){
    document.getElementById("loginOverlay").style.display = "none";
    document.getElementById("appContent").style.display = "block";

    db.ref('users/' + user.uid).on('value', snap => {
      const val = snap.val();
      if(!val){
        const def = { name: "Utilisateur", hours:35, role:'staff', email: user.email, status: 'active' };
        db.ref('users/'+user.uid).set(def);
        currentUser = def;
      } else {
        currentUser = val;
      }
      currentUser.uid = user.uid; currentUser.email = user.email;
      syncRights();
      bindDirectory();
    });
  } else {
    document.getElementById("loginOverlay").style.display = "flex";
    document.getElementById("appContent").style.display = "none";
  }
});

function syncRights(){
  if(!currentUser) return;
  const isSuper = (currentUser.email && currentUser.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase());
  const isAdmin = (currentUser.role === 'admin' || isSuper);
  canEdit = isAdmin;

  document.getElementById('userName').textContent = currentUser.name || "Utilisateur";
  document.getElementById('userRole').textContent = isSuper ? "SUPER ADMIN" : (currentUser.role || "staff").toUpperCase();

  document.getElementById('accessHint').textContent = canEdit ? "Mode édition (Admin)" : "Lecture seule";
  document.getElementById('btnAddContact').style.display = canEdit ? 'inline-flex' : 'none';
  document.getElementById('btnAddSite').style.display = canEdit ? 'inline-flex' : 'none';
}

function bindDirectory(){
  // Live listeners
  db.ref('directory/contacts').on('value', s => {
    contactsData = s.val() || {};
    renderContacts();
  });
  db.ref('directory/sites').on('value', s => {
    sitesData = s.val() || {};
    renderSites();
  });

  // Defaults if empty (first run only)
  db.ref('directory/contacts').get().then(s => {
    if(s.exists()) return;
    const seed = {
      "maintenance": { label: "Maintenance", value: "à compléter", note: "" },
      "support": { label: "Support", value: "à compléter", note: "" },
      "urgences": { label: "Urgences", value: "à compléter", note: "" }
    };
    db.ref('directory/contacts').set(seed);
  }).catch(()=>{});
}

function switchDirectoryTab(tab){
  currentTab = tab;
  document.getElementById('tabContacts').classList.toggle('active', tab === 'contacts');
  document.getElementById('tabSites').classList.toggle('active', tab === 'sites');
  document.getElementById('panelContacts').style.display = (tab === 'contacts') ? 'block' : 'none';
  document.getElementById('panelSites').style.display = (tab === 'sites') ? 'block' : 'none';
}
window.switchDirectoryTab = switchDirectoryTab;

function renderContacts(){
  const root = document.getElementById('contactsList');
  if(!root) return;
  const items = Object.entries(contactsData || {}).map(([k,v]) => ({ key:k, ...(v||{}) }));
  items.sort((a,b) => (a.label||"").localeCompare(b.label||""));
  root.innerHTML = "";

  if(items.length === 0){
    root.innerHTML = `<div class="dir-empty">Aucun contact pour l’instant.</div>`;
    return;
  }

  items.forEach(it => {
    const row = document.createElement('div');
    row.className = 'dir-item';
    const value = (it.value || "").toString();
    const isPhone = /^[+0-9][0-9 .-]{6,}$/.test(value.trim());
    const href = isPhone ? `tel:${value.replace(/\s+/g,'')}` : null;
    row.innerHTML = `
      <div class="dir-item-main">
        <div class="dir-item-title">${escapeHtml(it.label || 'Sans titre')}</div>
        <div class="dir-item-value">${href ? `<a href="${href}" class="dir-link">${escapeHtml(value)}</a>` : escapeHtml(value || '—') }</div>
        ${it.note ? `<div class="dir-item-note">${escapeHtml(it.note)}</div>` : ''}
      </div>
      ${canEdit ? `
        <div class="dir-actions">
          <button class="icon-btn" title="Modifier" onclick="openDirModal('contact','${it.key}')">✏️</button>
          <button class="icon-btn danger" title="Supprimer" onclick="deleteDirItem('contact','${it.key}')">🗑️</button>
        </div>
      ` : ''}
    `;
    root.appendChild(row);
  });
}

function renderSites(){
  const root = document.getElementById('sitesGrid');
  if(!root) return;
  const items = Object.entries(sitesData || {}).map(([k,v]) => ({ key:k, ...(v||{}) }));
  items.sort((a,b) => (a.label||"").localeCompare(b.label||""));
  root.innerHTML = "";

  if(items.length === 0){
    root.innerHTML = `<div class="dir-empty">Aucun lien pour l’instant.</div>`;
    return;
  }

  items.forEach(it => {
    const tile = document.createElement('div');
    tile.className = 'dir-tile';
    const url = (it.url || "").toString();
    const safeUrl = sanitizeUrl(url);
    tile.innerHTML = `
      <a class="dir-tile-link" href="${safeUrl || '#'}" ${safeUrl ? 'target="_blank" rel="noopener"' : ''}>
        <div class="dir-tile-title">${escapeHtml(it.label || 'Lien')}</div>
        <div class="dir-tile-sub">${escapeHtml(url || '—')}</div>
      </a>
      ${canEdit ? `
        <div class="dir-tile-actions">
          <button class="icon-btn" title="Modifier" onclick="openDirModal('site','${it.key}')">✏️</button>
          <button class="icon-btn danger" title="Supprimer" onclick="deleteDirItem('site','${it.key}')">🗑️</button>
        </div>
      ` : ''}
    `;
    root.appendChild(tile);
  });
}

// MODAL
function openDirModal(type, key){
  if(!canEdit) return;
  editingType = type;
  editingKey = key || null;

  const title = document.getElementById('dirModalTitle');
  const form = document.getElementById('dirForm');
  const modal = document.getElementById('dirModal');
  const item = (type === 'contact') ? (contactsData[key] || {}) : (sitesData[key] || {});

  if(type === 'contact'){
    title.textContent = key ? '✏️ Modifier contact' : '＋ Ajouter contact';
    form.innerHTML = `
      <div class="input-group">
        <div class="dir-label">Libellé</div>
        <input id="dirLabel" type="text" placeholder="Ex : Maintenance" value="${escapeAttr(item.label || '')}">
      </div>
      <div class="input-group">
        <div class="dir-label">Téléphone / info</div>
        <input id="dirValue" type="text" placeholder="Ex : 06 00 00 00 00" value="${escapeAttr(item.value || '')}">
      </div>
      <div class="input-group">
        <div class="dir-label">Note (optionnel)</div>
        <input id="dirNote" type="text" placeholder="Ex : Appeler avant 11h" value="${escapeAttr(item.note || '')}">
      </div>
    `;
  } else {
    title.textContent = key ? '✏️ Modifier site' : '＋ Ajouter site';
    form.innerHTML = `
      <div class="input-group">
        <div class="dir-label">Nom</div>
        <input id="dirLabel" type="text" placeholder="Ex : Deliveroo" value="${escapeAttr(item.label || '')}">
      </div>
      <div class="input-group">
        <div class="dir-label">URL</div>
        <input id="dirUrl" type="url" placeholder="https://..." value="${escapeAttr(item.url || '')}">
      </div>
      <div class="dir-tip">Conseil : mets toujours une URL complète (https://...).</div>
    `;
  }

  modal.style.display = 'flex';
}
window.openDirModal = openDirModal;

function closeDirModal(){
  document.getElementById('dirModal').style.display = 'none';
  editingType = null;
  editingKey = null;
}
window.closeDirModal = closeDirModal;

function saveDirItem(){
  if(!canEdit || !editingType) return;
  const label = (document.getElementById('dirLabel')?.value || '').trim();
  if(label.length < 2){ alert('⚠️ Le nom est obligatoire.'); return; }

  if(editingType === 'contact'){
    const value = (document.getElementById('dirValue')?.value || '').trim();
    const note = (document.getElementById('dirNote')?.value || '').trim();
    const payload = { label, value, note };
    const ref = editingKey ? db.ref('directory/contacts/' + editingKey) : db.ref('directory/contacts').push();
    ref.set(payload).then(() => {
      showToast('✅ Contact enregistré');
      closeDirModal();
    });
  } else {
    const url = (document.getElementById('dirUrl')?.value || '').trim();
    const payload = { label, url };
    const ref = editingKey ? db.ref('directory/sites/' + editingKey) : db.ref('directory/sites').push();
    ref.set(payload).then(() => {
      showToast('✅ Lien enregistré');
      closeDirModal();
    });
  }
}
window.saveDirItem = saveDirItem;

function deleteDirItem(type, key){
  if(!canEdit) return;
  if(!confirm('Supprimer cet élément ?')) return;
  const path = (type === 'contact') ? ('directory/contacts/' + key) : ('directory/sites/' + key);
  db.ref(path).remove().then(() => showToast('🗑️ Supprimé'));
}
window.deleteDirItem = deleteDirItem;

// Utils
function escapeHtml(str){
  return (str || '').toString().replace(/[&<>"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));
}
function escapeAttr(str){
  return escapeHtml(str).replace(/'/g, '&#39;');
}
function sanitizeUrl(url){
  const u = (url || '').trim();
  if(!u) return '';
  // only allow http(s)
  if(/^https?:\/\//i.test(u)) return u;
  return '';
}

// Default tab
switchDirectoryTab('contacts');

  // PWA: force check update (évite les versions figées)
  if('serviceWorker' in navigator){
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // si un nouveau SW prend le contrôle, on recharge une fois (sans boucle)
      if(!window.__swReloaded){ window.__swReloaded = true; window.location.reload(); }
    });
  }
