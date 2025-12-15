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
let currentTab = "sites";
let editingType = null; // 'contact' | 'site' | 'supplier'
let editingKey = null;

// Data (live)
let contactsData = {};
let sitesData = {};
let suppliersData = {};

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
  const bSup = document.getElementById('btnAddSupplier');
  if(bSup) bSup.style.display = canEdit ? 'inline-flex' : 'none';
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
  db.ref('directory/suppliers').on('value', s => {
    suppliersData = s.val() || {};
    renderSuppliers();
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

  const tC = document.getElementById('tabContacts');
  const tS = document.getElementById('tabSites');
  const tSup = document.getElementById('tabSuppliers');

  if(tC) tC.classList.toggle('active', tab === 'contacts');
  if(tS) tS.classList.toggle('active', tab === 'sites');
  if(tSup) tSup.classList.toggle('active', tab === 'suppliers');

  const pC = document.getElementById('panelContacts');
  const pS = document.getElementById('panelSites');
  const pSup = document.getElementById('panelSuppliers');

  if(pC) pC.style.display = (tab === 'contacts') ? 'block' : 'none';
  if(pS) pS.style.display = (tab === 'sites') ? 'block' : 'none';
  if(pSup) pSup.style.display = (tab === 'suppliers') ? 'block' : 'none';
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


function renderSuppliers(){
  const root = document.getElementById('suppliersList');
  if(!root) return;

  const items = Object.entries(suppliersData || {}).map(([k,v]) => ({ key:k, ...(v||{}) }));
  items.sort((a,b) => (a.label||"").localeCompare(b.label||""));
  root.innerHTML = "";

  if(items.length === 0){
    root.innerHTML = `<div class="dir-empty">Aucun fournisseur pour l’instant.</div>`;
    return;
  }

  items.forEach(it => {
    const row = document.createElement('div');
    row.className = 'dir-item';

    const phone = (it.phone || '').toString().trim();
    const commercial = (it.commercial || '').toString().trim();
    const deliveryDays = (it.deliveryDays || '').toString().trim();
    const leadTime = (it.leadTime || '').toString().trim();
    const minOrder = (it.minOrder || '').toString().trim();

    const isPhone = /^[+0-9][0-9 .-]{6,}$/.test(phone);
    const href = isPhone ? `tel:${phone.replace(/\s+/g,'')}` : null;

    const meta = [];
    if(commercial) meta.push(`👤 ${escapeHtml(commercial)}`);
    if(phone) meta.push(`📞 ${href ? `<a href="${href}" class="dir-link">${escapeHtml(phone)}</a>` : escapeHtml(phone)}`);
    if(deliveryDays) meta.push(`📦 ${escapeHtml(deliveryDays)}`);
    if(leadTime) meta.push(`⏱️ ${escapeHtml(leadTime)} j`);
    if(minOrder) meta.push(`💶 ${escapeHtml(minOrder)}`);

    row.innerHTML = `
      <div class="dir-item-main">
        <div class="dir-item-title">${escapeHtml(it.label || 'Fournisseur')}</div>
        <div class="dir-item-value">${commercial ? escapeHtml(commercial) : (phone ? (href ? `<a href="${href}" class="dir-link">${escapeHtml(phone)}</a>` : escapeHtml(phone)) : '—')}</div>
        ${meta.length ? `<div class="dir-item-note">${meta.join(' • ')}</div>` : ''}
      </div>
      ${canEdit ? `
        <div class="dir-actions">
          <button class="icon-btn" title="Modifier" onclick="openDirModal('supplier','${it.key}')">✏️</button>
          <button class="icon-btn danger" title="Supprimer" onclick="deleteDirItem('supplier','${it.key}')">🗑️</button>
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
  // Tri : catégorie puis libellé
  items.sort((a,b) => (String(a.category||'').trim()).localeCompare(String(b.category||'').trim()) || (a.label||"").localeCompare(b.label||""));
  root.innerHTML = "";

  if(items.length === 0){
    root.innerHTML = `<div class="dir-empty">Aucun lien pour l’instant.</div>`;
    return;
  }

  // Groupes par catégorie (en gras)
  const groups = new Map();
  items.forEach(it => {
    const cat = String(it.category||'').trim();
    const key = cat || 'Autres';
    if(!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  });
  const cats = Array.from(groups.keys()).sort((a,b) => {
    if(a === 'Autres') return 1;
    if(b === 'Autres') return -1;
    return a.localeCompare(b);
  });

  cats.forEach(cat => {
    const wrap = document.createElement('div');
    wrap.className = 'dir-group';
    wrap.innerHTML = `<div class="dir-group-title">${escapeHtml(cat)}</div>`;
    const grid = document.createElement('div');
    grid.className = 'dir-grid';

    (groups.get(cat) || []).forEach(it => {
      const tile = document.createElement('div');
      tile.className = 'dir-tile' + (canEdit ? ' has-actions' : '');
      const url = (it.url || "").toString();
      const safeUrl = sanitizeUrl(url);
      const logo = (it.imageData || it.imageUrl || '').toString().trim();
      const icon = (it.icon || '🔗').toString().trim() || '🔗';
      // IMPORTANT : on cache l'URL dans la tuile (on clique sur la carte pour ouvrir)
      tile.innerHTML = `
        <a class="dir-tile-link" href="${safeUrl || '#'}" ${safeUrl ? 'target="_blank" rel="noopener"' : ''}>
          <div style="display:flex; gap:10px; align-items:flex-start;">
            <div class="dir-tile-icon" aria-hidden="true">
              ${logo ? `<img src="${escapeAttr(logo)}" alt="">` : escapeHtml(icon)}
            </div>
            <div style="flex:1; min-width:0;">
              <div class="dir-tile-title" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${escapeHtml(it.label || 'Lien')}
              </div>
              ${it.description ? `<div class="dir-tile-desc">${escapeHtml(it.description)}</div>` : `<div class="dir-tile-desc" style="opacity:.65;">—</div>`}
            </div>
          </div>
        </a>
        ${canEdit ? `
          <div class="dir-tile-actions">
            <button class="icon-btn" title="Modifier" onclick="openDirModal('site','${it.key}')">✏️</button>
            <button class="icon-btn danger" title="Supprimer" onclick="deleteDirItem('site','${it.key}')">🗑️</button>
          </div>
        ` : ''}
      `;
      grid.appendChild(tile);
    });

    wrap.appendChild(grid);
    root.appendChild(wrap);
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
  const item = (type === 'contact') ? (contactsData[key] || {}) : (type === 'supplier' ? (suppliersData[key] || {}) : (sitesData[key] || {}));

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
  } else if(type === 'supplier'){
    title.textContent = key ? '✏️ Modifier fournisseur' : '＋ Ajouter fournisseur';
    form.innerHTML = `
      <div class="input-group">
        <div class="dir-label">Fournisseur</div>
        <input id="dirLabel" type="text" placeholder="Ex : Métro" value="${escapeAttr(item.label || '')}">
      </div>
      <div class="input-group">
        <div class="dir-label">Nom du commercial</div>
        <input id="dirCommercial" type="text" placeholder="Ex : Paul" value="${escapeAttr(item.commercial || '')}">
      </div>
      <div class="input-group">
        <div class="dir-label">Numéro</div>
        <input id="dirPhone" type="text" placeholder="Ex : 06 00 00 00 00" value="${escapeAttr(item.phone || '')}">
      </div>
      <div class="input-group">
        <div class="dir-label">Jours de livraisons</div>
        <input id="dirDeliveryDays" type="text" placeholder="Ex : Lun / Mer / Ven" value="${escapeAttr(item.deliveryDays || '')}">
      </div>
      <div class="input-group">
        <div class="dir-label">Délai commande → livraison (jours)</div>
        <input id="dirLeadTime" type="text" placeholder="Ex : 1" value="${escapeAttr(item.leadTime || '')}">
      </div>
      <div class="input-group">
        <div class="dir-label">Minimum de commande</div>
        <input id="dirMinOrder" type="text" placeholder="Ex : 150€" value="${escapeAttr(item.minOrder || '')}">
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
      <div class="input-group">
        <div class="dir-label">Catégorie</div>
        <input id="dirCategory" type="text" placeholder="Ex : Aides / Santé / Loisirs" value="${escapeAttr(item.category || '')}">
      </div>
      <div class="input-group">
        <div class="dir-label">Description (optionnel)</div>
        <input id="dirDesc" type="text" placeholder="Ex : Support, déclaration, réservation..." value="${escapeAttr(item.description || '')}">
      </div>
      <div class="input-group">
        <div class="dir-label">Icône (emoji) (optionnel)</div>
        <input id="dirIcon" type="text" placeholder="🔗" value="${escapeAttr(item.icon || '')}">
      </div>
      <div class="input-group">
        <div class="dir-label">Image (URL) (optionnel)</div>
        <input id="dirImageUrl" type="url" placeholder="https://..." value="${escapeAttr(item.imageUrl || '')}">
      </div>
      <div class="input-group">
        <div class="dir-label">Ou importer une image (petite) (optionnel)</div>
        <input id="dirImageFile" type="file" accept="image/*">
        <input id="dirImageData" type="hidden" value="${escapeAttr(item.imageData || '')}">
      </div>
      <div class="dir-tip">Conseil : mets toujours une URL complète (https://...).</div>
    `;
  }

  modal.style.display = 'flex';

  // Bind upload (convertit en base64 compact)
  const file = document.getElementById('dirImageFile');
  if(file){
    file.onchange = async () => {
      const f = file.files && file.files[0];
      if(!f) return;
      try{
        const dataUrl = await toSmallDataURL(f, 240, 240, 0.82);
        const hid = document.getElementById('dirImageData');
        if(hid) hid.value = dataUrl;
        showToast('🖼️ Image ajoutée');
      }catch(e){ alert('Image non prise en charge'); }
    };
  }
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
  } else if(editingType === 'supplier'){
    const commercial = (document.getElementById('dirCommercial')?.value || '').trim();
    const phone = (document.getElementById('dirPhone')?.value || '').trim();
    const deliveryDays = (document.getElementById('dirDeliveryDays')?.value || '').trim();
    const leadTime = (document.getElementById('dirLeadTime')?.value || '').trim();
    const minOrder = (document.getElementById('dirMinOrder')?.value || '').trim();
    const payload = { label, commercial, phone, deliveryDays, leadTime, minOrder };
    const ref = editingKey ? db.ref('directory/suppliers/' + editingKey) : db.ref('directory/suppliers').push();
    ref.set(payload).then(() => {
      showToast('✅ Fournisseur enregistré');
      closeDirModal();
    });
  } else {
    const url = (document.getElementById('dirUrl')?.value || '').trim();
    const category = (document.getElementById('dirCategory')?.value || '').trim();
    const description = (document.getElementById('dirDesc')?.value || '').trim();
    const icon = (document.getElementById('dirIcon')?.value || '').trim();
    const imageUrl = (document.getElementById('dirImageUrl')?.value || '').trim();
    const imageData = (document.getElementById('dirImageData')?.value || '').trim();
    const payload = { label, url, category, description, icon, imageUrl, imageData };
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
  let path = '';
  if(type === 'contact') path = 'directory/contacts/' + key;
  else if(type === 'supplier') path = 'directory/suppliers/' + key;
  else path = 'directory/sites/' + key;
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

async function toSmallDataURL(file, maxW, maxH, quality){
  const img = new Image();
  const data = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('read'));
    r.readAsDataURL(file);
  });
  img.src = data;
  await new Promise((resolve, reject) => {
    img.onload = () => resolve(true);
    img.onerror = () => reject(new Error('img'));
  });
  let w = img.width, h = img.height;
  const scale = Math.min(1, maxW / w, maxH / h);
  w = Math.round(w * scale);
  h = Math.round(h * scale);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const q = (typeof quality === 'number') ? quality : 0.82;
  try{ return c.toDataURL('image/webp', q); }
  catch(e){ return c.toDataURL('image/jpeg', q); }
}

// Default tab (hash : #sites / #fournisseurs / #contacts)
(() => {
  const hRaw = (window.location.hash || '').replace('#','').trim().toLowerCase();
  const h = (hRaw === 'fournisseurs' || hRaw === 'suppliers') ? 'suppliers' : hRaw;
  if(h === 'contacts' || h === 'sites' || h === 'suppliers') switchDirectoryTab(h);
  else switchDirectoryTab('sites');
})();

  // PWA: force check update (évite les versions figées)
  if('serviceWorker' in navigator){
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // si un nouveau SW prend le contrôle, on recharge une fois (sans boucle)
      if(!window.__swReloaded){ window.__swReloaded = true; window.location.reload(); }
    });
  }
