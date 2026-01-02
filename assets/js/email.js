cat > assets/js/email.js <<'ENDOFFILE'
/*
  Mail system (manual + group) for Lafayette-progress
*/

(function(){
  'use strict';

  // -------------------------
  // State
  // -------------------------
  let mailGroups = {};
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
      const raw = window.allUsers || {};
      console.log('📋 getUsersArray: raw users =', Object.keys(raw).length);
      const result = Object.keys(raw).map(uid => ({ uid, ...(raw[uid]||{}) }));
      console.log('📋 getUsersArray: mapped users =', result.length);
      return result;
    } catch(e){
      console.error('❌ getUsersArray error:', e);
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
    return '';
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
  // Multi-canal helpers
  // -------------------------
  function getSelectedChannel(){
    try {
      const radios = document.getElementsByName('diffusionChannel');
      for(let r of radios){
        if(r.checked) return r.value;
      }
    } catch(e){}
    return 'email';
  }

  function getFallbackToEmail(){
    const chk = safeGet('fallbackToEmail');
    return chk ? chk.checked : true;
  }

  function updatePushStats(enabled, disabled){
    const box = safeGet('pushStatsBox');
    const enabledEl = safeGet('pushEnabledCount');
    const disabledEl = safeGet('pushDisabledCount');
    
    if(!box) return;
    
    if(enabledEl) enabledEl.textContent = enabled;
    if(disabledEl) disabledEl.textContent = disabled;
    
    const channel = getSelectedChannel();
    if(channel === 'push' || channel === 'both'){
      box.style.display = 'block';
    } else {
      box.style.display = 'none';
    }
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
      wrap.innerHTML = `<div class="mail-hint">Aucun groupe pour l'instant. Crée-en un dans "Groupes".</div>`;
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
    console.log('🎨 renderUsersGrid appelée');
    const grid = safeGet('mailUsersGrid');
    if(!grid) {
      console.log('❌ Grid element not found');
      return;
    }

    const users = getUsersArray()
      .filter(u => (u.email || '').trim().length > 3)
      .sort((a,b)=> String(a.name||'').localeCompare(String(b.name||'')));

    console.log('👥 Users to display:', users.length);

    if(users.length === 0){
      grid.innerHTML = `<div class="mail-hint">Aucun utilisateur avec email trouvé.</div>`;
      return;
    }

    let pushEnabledCount = 0;
    let pushDisabledCount = 0;

    grid.innerHTML = users.map(u => {
      const selected = selectedUserIds.has(u.uid);
      const hasPush = !!(u.fcmToken && u.fcmToken.trim());
      
      if(hasPush) pushEnabledCount++;
      else pushDisabledCount++;

      const pushBadge = hasPush 
        ? `<span style="font-size:10px; padding:3px 6px; background:#10b981; color:white; border-radius:4px; font-weight:700; white-space:nowrap;">🔔 PUSH</span>`
        : `<span style="font-size:10px; padding:3px 6px; background:#ef4444; color:white; border-radius:4px; font-weight:700; white-space:nowrap;">📧 EMAIL</span>`;

      return `<div class="mail-user-card ${selected?'selected':''}" onclick="toggleMailRecipient('${escapeHtml(u.uid)}')" title="Cliquer pour sélectionner">
        <div class="mail-user-check">${selected ? '✓' : ''}</div>
        <div style="min-width:0; flex:1;">
          <div class="mail-user-name">${escapeHtml(u.name || 'Sans nom')}</div>
          <div class="mail-user-email">${escapeHtml(u.email || '')}</div>
        </div>
        ${pushBadge}
      </div>`;
    }).join('');

    console.log('✅ Users rendered');

    setSelectedCount();
    updatePushStats(pushEnabledCount, pushDisabledCount);
  }

  function renderGroupsList(){
    const list = safeGet('mailGroupsList');
    if(!list) return;

    const groupsArr = Object.keys(mailGroups).map(id => ({ id, ...(mailGroups[id]||{}) }));
    groupsArr.sort((a,b)=> String(a.name||'').localeCompare(String(b.name||'')));

    if(groupsArr.length === 0){
      list.innerHTML = `<div class="mail-hint">Aucun groupe. Clique sur "Nouveau groupe".</div>`;
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
  // Public actions
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
      showToast('✅ Réglages enregistrés');
      try{ logAction('Diffusion - Réglages', regionVal ? `region=${regionVal}` : 'region=default'); }catch(e){}
    } catch(e){
      console.error(e);
      alert("Erreur : impossible d'enregistrer les réglages.");
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

    const uniq = Array.from(new Set(recipientEmails));

    if(uniq.length === 0){
      alert('⚠️ Aucun email valide dans la sélection');
      return;
    }

    const MAX = 80;
    if(uniq.length > MAX){
      const ok = confirm(`Tu as sélectionné ${uniq.length} emails. Limite: ${MAX}. Envoyer les ${MAX} premiers ?`);
      if(!ok) return;
      uniq.splice(MAX);
    }

    const region = getFunctionsRegion();
    const fromName = (safeGet('mailFromName')?.value || '').trim();
    const channel = getSelectedChannel();
    const fallback = getFallbackToEmail();

    const payload = {
      recipients: uniq,
      subject,
      html: normalizeMessageToHtml(message),
      fromName: fromName || null,
      channel: channel,
      fallbackToEmail: fallback,
      meta: {
        selectedUserIds: Array.from(selectedUserIds),
        groupId: activeGroupId || null,
        source: 'diffusion-ui'
      }
    };

    try{
      showToast('📨 Envoi en cours…');

      const functions = region ? firebase.app().functions(region) : firebase.app().functions();
      const call = functions.httpsCallable('sendBulkEmail');
      const res = await call(payload);

      const sent = res?.data?.sent ?? uniq.length;
      const channelLabel = channel === 'email' ? 'Email' : channel === 'push' ? 'Push' : 'Email + Push';
      showToast(`✅ ${channelLabel} envoyé (${sent})`);

      safeGet('mailSubject').value = '';
      safeGet('mailMessage').value = '';
      clearMailSelection();

      try{ logAction('Diffusion - Envoi', `${sent} destinataire(s) via ${channel}`); }catch(e){}
    } catch(e){
      console.error(e);
      const msg = (e?.message || '').toLowerCase();
      if(msg.includes('not-found') || msg.includes('functions') || msg.includes('unavailable')){
        alert("La Cloud Function 'sendBulkEmail' n'est pas accessible.\n\nDéploie le dossier functions/ sur Firebase.");
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
      try{ logAction('Diffusion - Groupe', `${editingGroupId ? 'Update' : 'Create'}: ${name}`); }catch(e){}
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
    if(!confirm(`Supprimer le groupe "${label}" ?`)) return;

    try{
      await db.ref('mailGroups/' + groupId).remove();
      showToast('🗑️ Groupe supprimé');
      try{ logAction('Diffusion - Groupe', `Delete: ${label}`); }catch(e){}
      if(activeGroupId === groupId){ clearMailSelection(); }
    } catch(e){
      console.error(e);
      alert('Erreur : suppression impossible.');
    }
  }

  // -------------------------
  // Expose to window
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

  window.renderQuickGroups = renderQuickGroups;
  window.renderUsersGrid = renderUsersGrid;
  window.renderGroupsList = renderGroupsList;
  window.attachMailGroupsListener = attachMailGroupsListener;
  window.getSelectedChannel = getSelectedChannel;
  window.getFallbackToEmail = getFallbackToEmail;

  // -------------------------
  // Init
  // -------------------------
  function init(){
    console.log('📧 email.js initialisé');
    try{ attachMailGroupsListener(); }catch(e){ console.error(e); }
    document.addEventListener('DOMContentLoaded', () => {
      try{ renderMailUI(); }catch(e){ console.error(e); }
    });
  }

  init();

})();
ENDOFFILE

echo "✅ email.js recréé sans erreur de syntaxe !"
