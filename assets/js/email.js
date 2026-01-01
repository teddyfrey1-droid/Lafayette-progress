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
    // Allow HTML if user typed tags; otherwise simple newline to <br>
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
      wrap.innerHTML = `<div class="mail-hint">Aucun groupe pour l'instant. Crée-en un dans “Groupes mail”.</div>`;
      return;
    }

    wrap.innerHTML = groupsArr.map(g => {
      const n = Array.isArray(g.userIds) ? g.userIds.length : 0;
      const active = activeGroupId === g.id;
      return `<div class="mail-chip ${active?'active':''}" onclick="selectMailGroup('${escapeHtml(g.id)}')" title="Sélectionner ce groupe">
        👥 ${escapeHtml(g.name || 'Groupe')} (${n})
      </div>`;
    }).join('');
  }

  function renderUsersGrid(){
    const grid = safeGet('mailUsersGrid');
    if(!grid) return;

    const users = getUsersArray()
      .filter(u => (u.email || '').trim().length > 3)
      .sort((a,b)=> String(a.name||'').localeCompare(String(b.name||'')));

    if(users.length === 0){
      grid.innerHTML = `<div class="mail-hint">Aucun utilisateur avec email trouvé.</div>`;
      return;
    }

    grid.innerHTML = users.map(u => {
      const selected = selectedUserIds.has(u.uid);
      return `<div class="mail-user-card ${selected?'selected':''}" onclick="toggleMailRecipient('${escapeHtml(u.uid)}')" title="Cliquer pour sélectionner">
        <div class="mail-user-check">${selected ? '✓' : ''}</div>
        <div style="min-width:0; flex:1;">
          <div class="mail-user-name">${escapeHtml(u.name || 'Sans nom')}</div>
          <div class="mail-user-email">${escapeHtml(u.email || '')}</div>
        </div>
      </div>`;
    }).join('');

    setSelectedCount();
  }

  function renderGroupsList(){
    const list = safeGet('mailGroupsList');
    if(!list) return;

    const groupsArr = Object.keys(mailGroups).map(id => ({ id, ...(mailGroups[id]||{}) }));
    groupsArr.sort((a,b)=> String(a.name||'').localeCompare(String(b.name||'')));

    if(groupsArr.length === 0){
      list.innerHTML = `<div class="mail-hint">Aucun groupe. Clique sur “Nouveau groupe”.</div>`;
      return;
    }

    const usersById = {};
    getUsersArray().forEach(u => { usersById[u.uid] = u; });

    list.innerHTML = groupsArr.map(g => {
      const ids = Array.isArray(g.userIds) ? g.userIds : [];
      const names = ids.map(id => usersById[id]?.name).filter(Boolean).slice(0,10);
      const more = ids.length > names.length ? ` +${ids.length - names.length}` : '';
      const color = g.color || '#3b82f6';
      return `
        <div class="user-item" style="border-left:4px solid ${escapeHtml(color)};">
          <div class="user-info">
            <div class="user-header" style="gap:10px;">
              <span class="user-name">${escapeHtml(g.name || 'Groupe')}</span>
              <span class="pub-state on" style="background:rgba(15,23,42,0.06); color:#0f172a; border:1px solid rgba(15,23,42,0.1);">${ids.length} membre(s)</span>
            </div>
            <div class="user-meta" style="white-space:normal;">${escapeHtml(names.join(', '))}${escapeHtml(more)}</div>
          </div>
          <div class="user-actions">
            <div class="btn-group">
              <button onclick="openMailGroupModal('${escapeHtml(g.id)}')" class="action-btn" title="Modifier">✏️</button>
              <button onclick="deleteMailGroup('${escapeHtml(g.id)}')" class="action-btn delete" title="Supprimer">🗑️</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function syncSettingsInputs(){
    const reg = safeGet('mailFunctionsRegion');
    const fromName = safeGet('mailFromName');

    if(reg){
      const v = (typeof globalSettings !== 'undefined' && globalSettings && globalSettings.functionsRegion) ? String(globalSettings.functionsRegion) : '';
      if(reg.value !== v) reg.value = v;
    }
    if(fromName){
      const v = (typeof globalSettings !== 'undefined' && globalSettings && globalSettings.mailFromName) ? String(globalSettings.mailFromName) : '';
      if(fromName.value !== v) fromName.value = v;
    }
  }

  function renderMailUI(){
    if(!isAdmin()) return;

    // If tab not in DOM, nothing to do
    if(!safeGet('tab-emails')) return;

    syncSettingsInputs();
    renderQuickGroups();
    renderUsersGrid();
    renderGroupsList();
  }

  function renderGroupModalMembers(){
    const members = safeGet('mailGroupMembers');
    if(!members) return;

    const users = getUsersArray()
      .filter(u => (u.email || '').trim().length > 3)
      .sort((a,b)=> String(a.name||'').localeCompare(String(b.name||'')));

    if(users.length === 0){
      members.innerHTML = `<div class="mail-hint">Aucun utilisateur avec email.</div>`;
      return;
    }

    members.innerHTML = users.map(u => {
      const checked = modalSelected.has(u.uid);
      return `<div class="mail-user-card ${checked?'selected':''}" onclick="toggleMailGroupMember('${escapeHtml(u.uid)}')">
        <div class="mail-user-check">${checked ? '✓' : ''}</div>
        <div style="min-width:0; flex:1;">
          <div class="mail-user-name">${escapeHtml(u.name || 'Sans nom')}</div>
          <div class="mail-user-email">${escapeHtml(u.email || '')}</div>
        </div>
      </div>`;
    }).join('');
  }


  // -------------------------
  // Public actions (attached to window)
  // -------------------------
  function toggleMailRecipient(uid){
    activeGroupId = null;
    if(selectedUserIds.has(uid)) selectedUserIds.delete(uid);
    else selectedUserIds.add(uid);
    renderUsersGrid();
    renderQuickGroups();
  }

  function selectMailGroup(groupId){
    const g = mailGroups[groupId];
    if(!g || !Array.isArray(g.userIds)) return;

    activeGroupId = groupId;
    selectedUserIds = new Set(g.userIds);
    renderUsersGrid();
    renderQuickGroups();
  }

  function clearMailSelection(){
    activeGroupId = null;
    selectedUserIds = new Set();
    renderUsersGrid();
    renderQuickGroups();
  }

  async function saveMailSettings(){
    if(!isAdmin()) return;
    if(typeof db === 'undefined' || !db) return;

    const reg = safeGet('mailFunctionsRegion');
    const fromName = safeGet('mailFromName');

    const regionVal = (reg?.value || '').trim();
    const fromNameVal = (fromName?.value || '').trim();

    const updates = {};
    updates['settings/functionsRegion'] = regionVal || null;
    updates['settings/mailFromName'] = fromNameVal || null;

    try{
      await db.ref().update(updates);
      showToast('✅ Réglages mail enregistrés');
      try{ logAction('Mail - Réglages', regionVal ? `region=${regionVal}` : 'region=default'); }catch(e){}
    } catch(e){
      console.error(e);
      alert("Erreur : impossible d'enregistrer les réglages. Vérifie tes règles Firebase.");
    }
  }

  async function sendManualEmail(){
    if(!isAdmin()) return;
    if(typeof firebase === 'undefined' || !firebase) return;

    const subject = (safeGet('mailSubject')?.value || '').trim();
    const message = (safeGet('mailMessage')?.value || '').trim();

    if(selectedUserIds.size === 0){ alert('⚠️ Sélectionne au moins un destinataire'); return; }
    if(!subject){ alert('⚠️ Le sujet est obligatoire'); return; }
    if(!message){ alert('⚠️ Le message est obligatoire'); return; }

    const usersById = {};
    getUsersArray().forEach(u => { usersById[u.uid] = u; });

    const recipientEmails = Array.from(selectedUserIds)
      .map(uid => (usersById[uid]?.email || '').trim())
      .filter(e => e.length > 3);

    // de-duplicate
    const uniq = Array.from(new Set(recipientEmails));

    if(uniq.length === 0){
      alert('⚠️ Aucun email valide dans la sélection');
      return;
    }

    // safety cap (adjust if needed)
    const MAX = 80;
    if(uniq.length > MAX){
      const ok = confirm(`Tu as sélectionné ${uniq.length} emails. Limite de sécurité: ${MAX}. Envoyer quand même les ${MAX} premiers ?`);
      if(!ok) return;
      uniq.splice(MAX);
    }

    const region = getFunctionsRegion();
    const fromName = (safeGet('mailFromName')?.value || '').trim();

    const payload = {
      recipients: uniq,
      subject,
      html: normalizeMessageToHtml(message),
      fromName: fromName || null,
      // optional: record selected ids
      meta: {
        selectedUserIds: Array.from(selectedUserIds),
        groupId: activeGroupId || null,
        source: 'admin-ui'
      }
    };

    try{
      showToast('📨 Envoi en cours…');

      // If region is empty, use default
      const functions = region ? firebase.app().functions(region) : firebase.app().functions();
      const call = functions.httpsCallable('sendBulkEmail');
      const res = await call(payload);

      const sent = res?.data?.sent ?? uniq.length;
      showToast(`✅ Email envoyé (${sent})`);

      // Reset
      safeGet('mailSubject').value = '';
      safeGet('mailMessage').value = '';
      clearMailSelection();

      try{ logAction('Mail - Envoi', `${sent} destinataire(s)`); }catch(e){}
    } catch(e){
      console.error(e);
      const msg = (e?.message || '').toLowerCase();
      if(msg.includes('not-found') || msg.includes('functions') || msg.includes('unavailable')){
        alert("La Cloud Function 'sendBulkEmail' n'est pas accessible.\n\nÀ faire: déployer le dossier functions/ sur Firebase (voir README) et vérifier la région.");
      } else {
        alert("Erreur lors de l'envoi. Vérifie les logs Firebase Functions.");
      }
    }
  }

  function openMailGroupModal(groupId){
    if(!isAdmin()) return;

    const overlay = safeGet('mailGroupModal');
    const title = safeGet('mailGroupModalTitle');
    const name = safeGet('mailGroupName');
    const members = safeGet('mailGroupMembers');

    if(!overlay || !title || !name || !members) return;

    editingGroupId = null;
    modalSelected = new Set();

    if(groupId && mailGroups[groupId]){
      editingGroupId = groupId;
      title.textContent = 'Modifier le groupe';
      name.value = mailGroups[groupId].name || '';
      const ids = Array.isArray(mailGroups[groupId].userIds) ? mailGroups[groupId].userIds : [];
      modalSelected = new Set(ids);

      // select color
      const color = mailGroups[groupId].color || '#3b82f6';
      const colorInput = safeGet('mailGroupColor');
      if(colorInput) colorInput.value = color;
    } else {
      title.textContent = 'Nouveau groupe';
      name.value = '';
      const colorInput = safeGet('mailGroupColor');
      if(colorInput) colorInput.value = '#3b82f6';
    }

    renderGroupModalMembers();

    overlay.style.display = 'flex';
  }

  function closeMailGroupModal(){
    const overlay = safeGet('mailGroupModal');
    if(overlay) overlay.style.display = 'none';
    editingGroupId = null;
    modalSelected = new Set();
  }

  function toggleMailGroupMember(uid){
    if(modalSelected.has(uid)) modalSelected.delete(uid);
    else modalSelected.add(uid);
    renderGroupModalMembers();
  }

  async function saveMailGroup(){
    if(!isAdmin()) return;
    if(typeof db === 'undefined' || !db) return;

    const nameEl = safeGet('mailGroupName');
    const colorEl = safeGet('mailGroupColor');
    const name = (nameEl?.value || '').trim();
    const color = (colorEl?.value || '#3b82f6').trim();

    if(name.length < 2){ alert('⚠️ Le nom du groupe est obligatoire'); return; }
    if(modalSelected.size === 0){ alert('⚠️ Sélectionne au moins un membre'); return; }

    const now = Date.now();
    const uid = (typeof currentUser !== 'undefined' && currentUser && currentUser.uid) ? currentUser.uid : null;

    const id = editingGroupId || ('g' + now);

    // preserve createdAt if existing
    const existing = mailGroups[id] || {};
    const payload = {
      name,
      color,
      userIds: Array.from(modalSelected),
      updatedAt: now,
      updatedBy: uid,
      createdAt: existing.createdAt || now,
      createdBy: existing.createdBy || uid
    };

    try{
      await db.ref('mailGroups/' + id).set(payload);
      showToast(editingGroupId ? '✅ Groupe mis à jour' : '✅ Groupe créé');
      try{ logAction('Mail - Groupe', `${editingGroupId ? 'Update' : 'Create'}: ${name}`); }catch(e){}
      closeMailGroupModal();
    } catch(e){
      console.error(e);
      alert('Erreur : impossible de sauvegarder ce groupe.');
    }
  }

  async function deleteMailGroup(groupId){
    if(!isAdmin()) return;
    if(typeof db === 'undefined' || !db) return;

    const g = mailGroups[groupId];
    const label = g?.name || groupId;
    if(!confirm(`Supprimer le groupe “${label}” ?`)) return;

    try{
      await db.ref('mailGroups/' + groupId).remove();
      showToast('🗑️ Groupe supprimé');
      try{ logAction('Mail - Groupe', `Delete: ${label}`); }catch(e){}
      if(activeGroupId === groupId){ clearMailSelection(); }
    } catch(e){
      console.error(e);
      alert('Erreur : suppression impossible.');
    }
  }
// ═══════════════════════════════════════════════════════════════════════
// MULTI-CANAL : Email + Push
// ═══════════════════════════════════════════════════════════════════════

let showPushStatus = false;

function togglePushStatusView() {
  showPushStatus = !showPushStatus;
  const btn = document.getElementById('pushStatusToggleText');
  if (btn) {
    btn.textContent = showPushStatus ? '👁️ Masquer statut Push' : '👁️ Voir statut Push';
  }
  renderUsersGrid();
}

async function sendMultiChannelMessage() {
  if (!isAdmin()) return;
  if (typeof firebase === 'undefined' || !firebase) return;

  const subject = safeGet('mailSubject')?.value.trim() || '';
  const message = safeGet('mailMessage')?.value.trim() || '';
  const channel = document.querySelector('input[name="mailChannel"]:checked')?.value || 'email';
  const fallback = document.getElementById('mailFallback')?.checked || false;

  if (selectedUserIds.size === 0) {
    alert('Sélectionne au moins un destinataire');
    return;
  }
  if (!subject) {
    alert('Le sujet est obligatoire');
    return;
  }
  if (!message) {
    alert('Le message est obligatoire');
    return;
  }

  const usersById = {};
  getUsersArray().forEach(u => usersById[u.uid] = u);

  // Séparer les utilisateurs selon leur statut Push
  const usersWithPush = [];
  const usersWithoutPush = [];
  const emailRecipients = [];

  Array.from(selectedUserIds).forEach(uid => {
    const user = usersById[uid];
    if (!user) return;

    const hasPush = user.pushEnabled === true && user.pushToken;

    if (channel === 'push' || channel === 'both') {
      if (hasPush) {
        usersWithPush.push(uid);
      } else if (fallback) {
        usersWithoutPush.push(uid);
        if (user.email) emailRecipients.push(user.email);
      }
    }

    if (channel === 'email' || channel === 'both') {
      if (user.email) emailRecipients.push(user.email);
    }
  });

  const region = getFunctionsRegion();
  const functions = region ? firebase.app().functions(region) : firebase.app().functions();

  try {
    showToast('⏳ Envoi en cours...');

    let sentEmail = 0;
    let sentPush = 0;

    // Envoi des Emails
    if (emailRecipients.length > 0 && (channel === 'email' || channel === 'both' || (fallback && usersWithoutPush.length > 0))) {
      const uniqueEmails = Array.from(new Set(emailRecipients));
      const callEmail = functions.httpsCallable('sendBulkEmail');
      const resEmail = await callEmail({
        recipients: uniqueEmails,
        subject: subject,
        html: normalizeMessageToHtml(message)
      });
      sentEmail = resEmail?.data?.sent || 0;
    }

    // Envoi des Push
    if (usersWithPush.length > 0 && (channel === 'push' || channel === 'both')) {
      const callPush = functions.httpsCallable('sendPushToUsers');
      const resPush = await callPush({
        userIds: usersWithPush,
        title: subject,
        body: message.substring(0, 150) // Limiter le body
      });
      sentPush = resPush?.data?.sent || 0;
    }

    // Message de succès
    let successMsg = '✅ Envoi terminé : ';
    if (sentEmail > 0) successMsg += `${sentEmail} email(s)`;
    if (sentPush > 0) successMsg += `${sentEmail > 0 ? ', ' : ''}${sentPush} notification(s)`;
    
    showToast(successMsg);

    // Reset
    safeGet('mailSubject').value = '';
    safeGet('mailMessage').value = '';
    clearMailSelection();

    try {
      logAction('Diffusion Multi-Canal', `Email:${sentEmail} Push:${sentPush} Canal:${channel}`);
    } catch (e) {}

  } catch (e) {
    console.error(e);
    alert('Erreur lors de l\'envoi. Vérifie les logs Firebase Functions.');
  }
}

  // -------------------------
  // Expose to window (for onclick attributes)
  // -------------------------
  window.renderMailUI = renderMailUI;
  window.toggleMailRecipient = toggleMailRecipient;
  window.selectMailGroup = selectMailGroup;
  window.clearMailSelection = clearMailSelection;
  window.sendManualEmail = sendManualEmail;
  window.saveMailSettings = saveMailSettings;
  window.openMailGroupModal = openMailGroupModal;
  window.closeMailGroupModal = closeMailGroupModal;
  window.toggleMailGroupMember = toggleMailGroupMember;
  window.saveMailGroup = saveMailGroup;
  window.deleteMailGroup = deleteMailGroup;
  window.sendMultiChannelMessage = sendMultiChannelMessage;
  window.togglePushStatusView = togglePushStatusView;

  // -------------------------
  // Init
  // -------------------------
  function init(){
    try{ attachMailGroupsListener(); }catch(e){ console.error(e); }
    // Keep UI updated
    document.addEventListener('DOMContentLoaded', () => {
      try{ renderMailUI(); }catch(e){ console.error(e); }
    });
  }

  init();
})();
