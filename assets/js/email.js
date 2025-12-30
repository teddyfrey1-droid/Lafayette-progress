/*

Mail system (manual + group) for Lafayette-progress

- Frontend writes/reads:
  - settings/functionsRegion (optional)
  - settings/mailFromName (optional)
  - mailGroups/{groupId} { name, color, userIds, createdAt, updatedAt, createdBy, updatedBy }

- Frontend calls Cloud Function:
  - sendBulkEmail (callable)

Note: This file assumes app.js has already loaded and defines:
  db, firebase, allUsers, globalSettings, currentUser, isAdminUser, showToast, logAction

*/

(function(){
'use strict';

// -------------------------
// State
// -------------------------
let mailGroups = {}; // {id: {name,color,userIds}}
let selectedUserIds = new Set();
let activeGroupId = null;
let editingGroupId = null;
let modalSelected = new Set();

// -------------------------
// Utils
// -------------------------
function safeGet(id){ return document.getElementById(id); }

function escapeHtml(str){
  return String(str ?? '').replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

function getUsersArray(){
  try{
    const raw = (typeof allUsers !== 'undefined' && allUsers) ? allUsers : {};
    return Object.keys(raw).map(uid => ({ uid, ...(raw[uid]||{}) }));
  } catch(e){
    return [];
  }
}

function isAdmin(){
  try{ return typeof isAdminUser === 'function' ? !!isAdminUser() : false; }
  catch(e){ return false; }
}

function getFunctionsRegion(){
  try{
    const fromSettings = (typeof globalSettings !== 'undefined' && globalSettings && globalSettings.functionsRegion) ? String(globalSettings.functionsRegion).trim() : '';
    if(fromSettings) return fromSettings;
  } catch(e){}
  const input = safeGet('mailFunctionsRegion');
  if(input && input.value && input.value.trim()) return input.value.trim();
  return ''; // default region
}

function setSelectedCount(){
  const el = safeGet('mailSelectedCount');
  if(!el) return;
  el.textContent = `${selectedUserIds.size} destinataire(s) sélectionné(s)`;
}

function normalizeMessageToHtml(text){
  const s = String(text ?? '');
  const hasTag = /<\w+[^>]*>/.test(s);
  if(hasTag) return s;
  return escapeHtml(s).replace(/\n/g, '<br>');
}

// -------------------------
// Data listeners
// -------------------------
function attachMailGroupsListener(){
  if(typeof db === 'undefined' || !db) return;
  db.ref('mailGroups').on('value', (snap) => {
    mailGroups = snap.val() || {};
    try{ renderMailUI(); } catch(e){ console.error(e); }
  });
}

// -------------------------
// Rendering
// -------------------------
function renderQuickGroups(){
  const wrap = safeGet('mailQuickGroups');
  if(!wrap) return;
  const groupsArr = Object.keys(mailGroups).map(id => ({ id, ...(mailGroups[id]||{}) }));
  groupsArr.sort((a,b)=> String(a.name||'').localeCompare(String(b.name||'')));

  if(groupsArr.length === 0){
    wrap.innerHTML = '<div style="color:#94a3b8;font-size:12px;font-style:italic;">Aucun groupe pour l\'instant. Crée-en un dans "Groupes mail".</div>';
    return;
  }

  wrap.innerHTML = '';
  groupsArr.forEach(g => {
    const btn = document.createElement('button');
    btn.className = 'mail-group-chip';
    btn.style.cssText = `background:${g.color||'#3b82f6'}20;border:1px solid ${g.color||'#3b82f6'};color:${g.color||'#3b82f6'};`;
    btn.textContent = g.name || 'Sans nom';

    if(activeGroupId === g.id){
      btn.style.background = g.color||'#3b82f6';
      btn.style.color = '#fff';
      btn.style.fontWeight = '700';
    }

    btn.onclick = () => {
      if(activeGroupId === g.id){
        activeGroupId = null;
        selectedUserIds.clear();
      } else {
        activeGroupId = g.id;
        selectedUserIds = new Set(g.userIds || []);
      }
      renderMailUI();
    };

    wrap.appendChild(btn);
  });
}

function renderUsersGrid(){
  const grid = safeGet('mailUsersGrid');
  if(!grid) return;

  const users = getUsersArray();
  users.sort((a,b)=> String(a.name||'').localeCompare(String(b.name||'')));

  grid.innerHTML = '';

  if(users.length === 0){
    grid.innerHTML = '<div style="color:#94a3b8;font-size:12px;font-style:italic;">Aucun utilisateur.</div>';
    return;
  }

  users.forEach(u => {
    const div = document.createElement('div');
    div.className = 'mail-user-card';

    const checked = selectedUserIds.has(u.uid);

    // Afficher le statut des notifications
    const pushEnabled = u.pushEnabled === true;
    const notifBadge = pushEnabled ? 
      '<span style="font-size:10px;background:#22c55e;color:#fff;padding:2px 6px;border-radius:4px;margin-left:4px;">📱 Push</span>' :
      '<span style="font-size:10px;background:#8b5cf6;color:#fff;padding:2px 6px;border-radius:4px;margin-left:4px;">📧 Email</span>';

    div.innerHTML = `
      <input type="checkbox" 
             ${checked ? 'checked' : ''}
             onchange="window.toggleUserSelection('${u.uid}')"
             style="width:18px;height:18px;cursor:pointer;">
      <div style="flex:1;">
        <div style="font-weight:600;font-size:13px;color:var(--text-main);">
          ${escapeHtml(u.name || 'Utilisateur')}
          ${notifBadge}
        </div>
        <div style="font-size:11px;color:#94a3b8;">${escapeHtml(u.email || '')}</div>
      </div>
    `;

    grid.appendChild(div);
  });
}

function renderMailUI(){
  if(!isAdmin()) return;
  renderQuickGroups();
  renderUsersGrid();
  renderMailGroupsList();
  setSelectedCount();
}

// -------------------------
// User selection
// -------------------------
window.toggleUserSelection = function(uid){
  if(selectedUserIds.has(uid)){
    selectedUserIds.delete(uid);
  } else {
    selectedUserIds.add(uid);
  }
  activeGroupId = null;
  renderMailUI();
};

window.clearMailSelection = function(){
  selectedUserIds.clear();
  activeGroupId = null;
  renderMailUI();
};

// -------------------------
// Send Email
// -------------------------
window.sendManualEmail = async function(){
  if(!isAdmin()){
    alert('Accès réservé aux admins');
    return;
  }

  const subject = (safeGet('mailSubject')?.value || '').trim();
  const message = (safeGet('mailMessage')?.value || '').trim();

  if(!subject || !message){
    alert('Sujet et message obligatoires');
    return;
  }

  if(selectedUserIds.size === 0){
    alert('Sélectionne au moins un destinataire');
    return;
  }

  const recipientUids = Array.from(selectedUserIds);

  // Séparer les utilisateurs selon leur statut de notifications
  const users = getUsersArray();
  const pushUsers = [];
  const emailUsers = [];

  recipientUids.forEach(uid => {
    const user = users.find(u => u.uid === uid);
    if(!user) return;

    if(user.pushEnabled === true){
      pushUsers.push(user);
    } else {
      emailUsers.push(user);
    }
  });

  console.log('📊 Répartition des destinataires:');
  console.log(`📱 Push: ${pushUsers.length} utilisateurs`);
  console.log(`📧 Email: ${emailUsers.length} utilisateurs`);

  if(!confirm(`Envoyer à ${recipientUids.length} personne(s) ?\n\n📱 Push: ${pushUsers.length}\n📧 Email: ${emailUsers.length}`)){
    return;
  }

  try {
    // Vérifier les paramètres de notification dans globalSettings
    const notifSettings = (globalSettings && globalSettings.notifications) || {};

    // Pour un email manuel, on respecte les préférences utilisateur
    // Push pour ceux qui ont activé, email pour les autres

    // 1. Envoyer les notifications push
    if(pushUsers.length > 0){
      console.log('📱 Envoi des notifications push...');
      const pushPromises = pushUsers.map(user => {
        if(user.pushToken){
          return db.ref('notifications').push({
            userId: user.uid,
            title: subject,
            body: message.substring(0, 150) + (message.length > 150 ? '...' : ''),
            type: 'manual_email',
            timestamp: Date.now(),
            read: false
          });
        }
        return Promise.resolve();
      });
      await Promise.all(pushPromises);
    }

    // 2. Envoyer les emails (pour ceux sans push)
    if(emailUsers.length > 0){
      console.log('📧 Envoi des emails...');
      const region = getFunctionsRegion();
      const fromName = (safeGet('mailFromName')?.value || '').trim() || 'Team Lafayette';

      const funcRef = region 
        ? firebase.app().functions(region)
        : firebase.functions();

      const sendBulkEmail = funcRef.httpsCallable('sendBulkEmail');

      const payload = {
        recipientUids: emailUsers.map(u => u.uid),
        subject: subject,
        htmlBody: normalizeMessageToHtml(message),
        fromName: fromName
      };

      await sendBulkEmail(payload);
    }

    // Log l'action
    try{
      if(typeof logAction === 'function'){
        logAction('Email envoyé', `${recipientUids.length} destinataire(s) - ${pushUsers.length} push, ${emailUsers.length} emails`);
      }
    } catch(e){}

    if(typeof showToast === 'function'){
      showToast(\`✅ Envoyé ! 📱 \${pushUsers.length} push, 📧 \${emailUsers.length} emails\`);
    } else {
      alert(\`✅ Envoyé ! 📱 \${pushUsers.length} push, 📧 \${emailUsers.length} emails\`);
    }

    // Reset
    safeGet('mailSubject').value = '';
    safeGet('mailMessage').value = '';
    window.clearMailSelection();

  } catch(err){
    console.error('Erreur envoi:', err);
    alert('Erreur lors de l\'envoi: ' + (err.message || err));
  }
};

// -------------------------
// Settings
// -------------------------
window.saveMailSettings = function(){
  if(!isAdmin()) return;

  const region = (safeGet('mailFunctionsRegion')?.value || '').trim();
  const fromName = (safeGet('mailFromName')?.value || '').trim();

  const updates = {};
  if(region) updates['settings/functionsRegion'] = region;
  if(fromName) updates['settings/mailFromName'] = fromName;

  if(Object.keys(updates).length === 0){
    if(typeof showToast === 'function') showToast('Rien à sauvegarder');
    return;
  }

  db.ref().update(updates)
    .then(() => {
      if(typeof showToast === 'function'){
        showToast('✅ Paramètres sauvegardés');
      }
    })
    .catch(e => {
      console.error(e);
      alert('Erreur: ' + e.message);
    });
};

// -------------------------
// Mail Groups CRUD
// -------------------------
function renderMailGroupsList(){
  const list = safeGet('mailGroupsList');
  if(!list) return;

  const groupsArr = Object.keys(mailGroups).map(id => ({ id, ...(mailGroups[id]||{}) }));
  groupsArr.sort((a,b)=> String(a.name||'').localeCompare(String(b.name||'')));

  if(groupsArr.length === 0){
    list.innerHTML = '<div style="color:#94a3b8;font-size:12px;font-style:italic;">Aucun groupe. Crée-en un avec le bouton ci-dessus.</div>';
    return;
  }

  list.innerHTML = '';

  groupsArr.forEach(g => {
    const div = document.createElement('div');
    div.className = 'mail-group-item';
    div.style.cssText = `border-left:4px solid ${g.color||'#3b82f6'};`;

    const userCount = (g.userIds || []).length;

    div.innerHTML = `
      <div style="flex:1;">
        <div style="font-weight:700;font-size:14px;color:var(--text-main);">
          ${escapeHtml(g.name || 'Sans nom')}
        </div>
        <div style="font-size:12px;color:#94a3b8;margin-top:2px;">
          ${userCount} membre(s)
        </div>
      </div>
      <div style="display:flex;gap:8px;">
        <button onclick="window.editMailGroup('${g.id}')" 
                style="background:none;border:none;cursor:pointer;font-size:16px;">
          ✏️
        </button>
        <button onclick="window.deleteMailGroup('${g.id}')" 
                style="background:none;border:none;cursor:pointer;font-size:16px;">
          🗑️
        </button>
      </div>
    `;

    list.appendChild(div);
  });
}

window.openMailGroupModal = function(){
  editingGroupId = null;
  safeGet('mailGroupId').value = '';
  safeGet('mailGroupName').value = '';
  safeGet('mailGroupColor').value = '#3b82f6';
  modalSelected = new Set();
  renderMailGroupMembers();
  safeGet('mailGroupModalTitle').textContent = 'Nouveau groupe';
  safeGet('mailGroupModal').style.display = 'flex';
};

window.editMailGroup = function(groupId){
  const g = mailGroups[groupId];
  if(!g) return;

  editingGroupId = groupId;
  safeGet('mailGroupId').value = groupId;
  safeGet('mailGroupName').value = g.name || '';
  safeGet('mailGroupColor').value = g.color || '#3b82f6';
  modalSelected = new Set(g.userIds || []);
  renderMailGroupMembers();
  safeGet('mailGroupModalTitle').textContent = 'Modifier le groupe';
  safeGet('mailGroupModal').style.display = 'flex';
};

window.closeMailGroupModal = function(){
  safeGet('mailGroupModal').style.display = 'none';
  editingGroupId = null;
  modalSelected.clear();
};

function renderMailGroupMembers(){
  const list = safeGet('mailGroupMembers');
  if(!list) return;

  const users = getUsersArray();
  users.sort((a,b)=> String(a.name||'').localeCompare(String(b.name||'')));

  list.innerHTML = '';

  users.forEach(u => {
    const div = document.createElement('div');
    div.className = 'mail-member-item';

    const checked = modalSelected.has(u.uid);

    div.innerHTML = `
      <input type="checkbox" 
             ${checked ? 'checked' : ''}
             onchange="window.toggleModalMember('${u.uid}')"
             style="width:18px;height:18px;cursor:pointer;">
      <div style="flex:1;">
        <div style="font-weight:600;font-size:13px;">${escapeHtml(u.name || 'Utilisateur')}</div>
        <div style="font-size:11px;color:#94a3b8;">${escapeHtml(u.email || '')}</div>
      </div>
    `;

    list.appendChild(div);
  });
}

window.toggleModalMember = function(uid){
  if(modalSelected.has(uid)){
    modalSelected.delete(uid);
  } else {
    modalSelected.add(uid);
  }
  renderMailGroupMembers();
};

window.saveMailGroup = function(){
  if(!isAdmin()) return;

  const name = (safeGet('mailGroupName')?.value || '').trim();
  const color = safeGet('mailGroupColor')?.value || '#3b82f6';

  if(!name){
    alert('Nom du groupe obligatoire');
    return;
  }

  const userIds = Array.from(modalSelected);

  const data = {
    name: name,
    color: color,
    userIds: userIds,
    updatedAt: Date.now(),
    updatedBy: (currentUser && currentUser.name) || 'Admin'
  };

  if(editingGroupId){
    // Update
    db.ref(\`mailGroups/\${editingGroupId}\`).update(data)
      .then(() => {
        if(typeof showToast === 'function') showToast('✅ Groupe modifié');
        window.closeMailGroupModal();
      })
      .catch(e => alert('Erreur: ' + e.message));
  } else {
    // Create
    data.createdAt = Date.now();
    data.createdBy = (currentUser && currentUser.name) || 'Admin';

    db.ref('mailGroups').push(data)
      .then(() => {
        if(typeof showToast === 'function') showToast('✅ Groupe créé');
        window.closeMailGroupModal();
      })
      .catch(e => alert('Erreur: ' + e.message));
  }
};

window.deleteMailGroup = function(groupId){
  if(!confirm('Supprimer ce groupe ?')) return;

  db.ref(\`mailGroups/\${groupId}\`).remove()
    .then(() => {
      if(typeof showToast === 'function') showToast('🗑️ Groupe supprimé');
    })
    .catch(e => alert('Erreur: ' + e.message));
};

// -------------------------
// Init
// -------------------------
window.addEventListener('DOMContentLoaded', () => {
  attachMailGroupsListener();

  // Populate settings from globalSettings if available
  try{
    if(globalSettings && globalSettings.functionsRegion){
      const inp = safeGet('mailFunctionsRegion');
      if(inp) inp.value = globalSettings.functionsRegion;
    }
    if(globalSettings && globalSettings.mailFromName){
      const inp = safeGet('mailFromName');
      if(inp) inp.value = globalSettings.mailFromName;
    }
  } catch(e){}

  renderMailUI();
});

})();
