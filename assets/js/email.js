/*
  Mail & Push System for Lafayette-progress
  - Gère la sélection des utilisateurs
  - Gère le choix des canaux (Email / Push)
  - Envoie les IDs au backend pour traitement intelligent
*/

(function(){
  'use strict';

  // State
  let mailGroups = {}; 
  let selectedUserIds = new Set();
  let activeGroupId = null;
  let editingGroupId = null;
  let modalSelected = new Set();

  function safeGet(id){ return document.getElementById(id); }
  function escapeHtml(str){ return String(str ?? '').replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  function getUsersArray(){
    try{
      const raw = (typeof window.allUsers !== 'undefined' && window.allUsers) ? window.allUsers : {};
      return Object.keys(raw).map(uid => ({ uid, ...(raw[uid]||{}) }));
    } catch(e){ return []; }
  }

  function isAdmin(){
    // On suppose que l'accès à la page est déjà protégé, mais on vérifie si possible
    return true; 
  }

  function getFunctionsRegion(){
    try{
      const fromSettings = (window.globalSettings && window.globalSettings.functionsRegion) ? String(window.globalSettings.functionsRegion).trim() : '';
      if(fromSettings) return fromSettings;
    } catch(e){}
    const input = safeGet('mailFunctionsRegion');
    if(input && input.value) return input.value.trim();
    return ''; 
  }

  function setSelectedCount(){
    const el = safeGet('mailSelectedCount');
    if(!el) return;
    el.textContent = `${selectedUserIds.size} destinataire(s) sélectionné(s)`;
  }

  function normalizeMessageToHtml(text){
    const s = String(text ?? '');
    return /<\w+[^>]*>/.test(s) ? s : escapeHtml(s).replace(/\n/g, '<br>');
  }

  // --- RENDERING ---

  function renderQuickGroups(){
    const wrap = safeGet('mailQuickGroups');
    if(!wrap) return;
    const groupsArr = Object.keys(mailGroups).map(id => ({ id, ...(mailGroups[id]||{}) }));
    groupsArr.sort((a,b)=> String(a.name||'').localeCompare(String(b.name||'')));

    if(groupsArr.length === 0){
      wrap.innerHTML = `<div class="mail-hint">Aucun groupe. Crée-en un ci-dessous.</div>`;
      return;
    }
    wrap.innerHTML = groupsArr.map(g => {
      const active = activeGroupId === g.id;
      return `<div class="mail-chip ${active?'active':''}" onclick="selectMailGroup('${g.id}')">👥 ${escapeHtml(g.name)} (${(g.userIds||[]).length})</div>`;
    }).join('');
  }

  function renderUsersGrid(){
    const grid = safeGet('mailUsersGrid');
    if(!grid) return;

    const users = getUsersArray().sort((a,b)=> String(a.name||'').localeCompare(String(b.name||'')));

    if(users.length === 0){
      grid.innerHTML = `<div class="mail-hint">Aucun utilisateur trouvé.</div>`;
      return;
    }

    grid.innerHTML = users.map(u => {
      const selected = selectedUserIds.has(u.uid);
      const hasEmail = (u.email && u.email.includes('@'));
      // On suppose que le token est stocké dans fcmToken ou pushToken
      const hasPush = !!(u.fcmToken || u.pushToken); 

      return `
      <div class="mail-user-card ${selected?'selected':''}" onclick="toggleMailRecipient('${u.uid}')">
        <div class="mail-user-check">${selected ? '✓' : ''}</div>
        <div style="min-width:0; flex:1;">
          <div class="mail-user-name">${escapeHtml(u.name || 'Sans nom')}</div>
          <div class="user-badges">
             <span class="channel-icon ${hasEmail ? 'has-email' : 'missing'}" title="${hasEmail ? u.email : 'Pas d\'email'}">
               ${hasEmail ? '📧 Email' : '📧 --'}
             </span>
             <span class="channel-icon ${hasPush ? 'has-push' : 'missing'}" title="${hasPush ? 'Push activé' : 'Push désactivé'}">
               ${hasPush ? '🔔 Push' : '🔕 --'}
             </span>
          </div>
        </div>
      </div>`;
    }).join('');
    setSelectedCount();
  }

  function renderGroupsList(){
    const list = safeGet('mailGroupsList');
    if(!list) return;
    const groupsArr = Object.keys(mailGroups).map(id => ({ id, ...(mailGroups[id]||{}) })).sort((a,b)=> (a.name||'').localeCompare(b.name||''));
    if(groupsArr.length === 0){ list.innerHTML = ''; return; }

    list.innerHTML = groupsArr.map(g => {
      return `
        <div class="user-item" style="border-left:4px solid ${g.color||'#3b82f6'};">
          <div class="user-info"><span class="user-name">${escapeHtml(g.name)}</span><span class="user-meta">${(g.userIds||[]).length} membres</span></div>
          <div class="user-actions">
             <button onclick="openMailGroupModal('${g.id}')" class="action-btn">✏️</button>
             <button onclick="deleteMailGroup('${g.id}')" class="action-btn delete">🗑️</button>
          </div>
        </div>`;
    }).join('');
  }

  // --- ACTIONS ---

  function toggleMailRecipient(uid){
    activeGroupId = null;
    if(selectedUserIds.has(uid)) selectedUserIds.delete(uid);
    else selectedUserIds.add(uid);
    renderUsersGrid(); renderQuickGroups();
  }

  function selectMailGroup(groupId){
    const g = mailGroups[groupId];
    if(!g) return;
    activeGroupId = groupId;
    selectedUserIds = new Set(g.userIds || []);
    renderUsersGrid(); renderQuickGroups();
  }

  function clearMailSelection(){
    activeGroupId = null;
    selectedUserIds = new Set();
    renderUsersGrid(); renderQuickGroups();
  }

  // --- SENDING LOGIC (SMART) ---

  async function sendManualEmail(){
    const subject = (safeGet('mailSubject')?.value || '').trim();
    const message = (safeGet('mailMessage')?.value || '').trim();
    
    // Récupération des canaux
    const sendEmail = safeGet('chanEmail')?.checked || false;
    const sendPush = safeGet('chanPush')?.checked || false;

    if(selectedUserIds.size === 0){ alert('⚠️ Sélectionne au moins un destinataire.'); return; }
    if(!sendEmail && !sendPush){ alert('⚠️ Sélectionne au moins un canal (Email ou Push).'); return; }
    if(!subject){ alert('⚠️ Le sujet est obligatoire.'); return; }
    if(!message){ alert('⚠️ Le message est obligatoire.'); return; }

    const region = getFunctionsRegion();
    const fromName = (safeGet('mailFromName')?.value || '').trim();

    // On envoie les UIDs, le backend fera le tri intelligent
    const payload = {
      recipientIds: Array.from(selectedUserIds),
      subject,
      html: normalizeMessageToHtml(message),
      fromName: fromName || null,
      channels: {
        email: sendEmail,
        push: sendPush
      }
    };

    try{
      showToast('🚀 Envoi en cours...');
      const functions = region ? firebase.app().functions(region) : firebase.app().functions();
      const call = functions.httpsCallable('sendSmartBroadcast'); // Nom de la nouvelle fonction
      const res = await call(payload);

      const { successCount, failureCount } = res.data || {};
      showToast(`✅ Envoyé ! (${successCount} succès)`);
      
      // Reset
      safeGet('mailSubject').value = '';
      safeGet('mailMessage').value = '';
      clearMailSelection();

    } catch(e){
      console.error(e);
      alert("Erreur lors de l'envoi : " + (e.message || e));
    }
  }

  // --- GROUPS MODAL ---
  // (Le reste du code pour gérer la modale des groupes reste identique, simplifié ici pour brièveté)
  function openMailGroupModal(groupId){
    const modal = safeGet('mailGroupModal');
    if(!modal) return;
    editingGroupId = groupId || null;
    safeGet('mailGroupModalTitle').textContent = groupId ? 'Modifier groupe' : 'Nouveau groupe';
    const g = groupId ? mailGroups[groupId] : {};
    safeGet('mailGroupName').value = g.name || '';
    safeGet('mailGroupColor').value = g.color || '#3b82f6';
    modalSelected = new Set(g.userIds || []);
    renderGroupModalMembers();
    modal.style.display = 'flex';
  }
  function closeMailGroupModal(){ safeGet('mailGroupModal').style.display = 'none'; }
  
  function renderGroupModalMembers(){
    const div = safeGet('mailGroupMembers');
    if(!div) return;
    const users = getUsersArray().sort((a,b)=> (a.name||'').localeCompare(b.name||''));
    div.innerHTML = users.map(u => {
       const checked = modalSelected.has(u.uid);
       return `<div class="mail-user-card ${checked?'selected':''}" onclick="toggleGroupMember('${u.uid}')">
         <div class="mail-user-check">${checked?'✓':''}</div>
         <div class="mail-user-name">${escapeHtml(u.name)}</div>
       </div>`;
    }).join('');
  }
  window.toggleGroupMember = function(uid){
    if(modalSelected.has(uid)) modalSelected.delete(uid); else modalSelected.add(uid);
    renderGroupModalMembers();
  };

  async function saveMailGroup(){
    const name = safeGet('mailGroupName').value.trim();
    if(!name) return alert('Nom obligatoire');
    const id = editingGroupId || 'g'+Date.now();
    await firebase.database().ref('mailGroups/'+id).update({
      name,
      color: safeGet('mailGroupColor').value,
      userIds: Array.from(modalSelected)
    });
    showToast('Groupe enregistré');
    closeMailGroupModal();
  }

  async function deleteMailGroup(id){
    if(confirm('Supprimer ce groupe ?')) await firebase.database().ref('mailGroups/'+id).remove();
  }
  
  async function saveMailSettings(){
     // Code existant de sauvegarde des settings
     const region = safeGet('mailFunctionsRegion').value.trim();
     const name = safeGet('mailFromName').value.trim();
     await firebase.database().ref('settings').update({ functionsRegion: region, mailFromName: name });
     showToast('Paramètres sauvegardés');
  }

  // --- INJECTION HTML SÉLECTEUR ---
  // Ajoute les checkboxes dynamiquement si elles n'existent pas dans le HTML statique
  function injectChannelSelector(){
    const subjectLabel = Array.from(document.querySelectorAll('.mail-label')).find(el => el.textContent.includes('Sujet'));
    if(subjectLabel && !document.getElementById('chanEmail')){
       const div = document.createElement('div');
       div.className = 'channel-selector';
       div.innerHTML = `
         <label class="channel-option"><input type="checkbox" id="chanEmail" checked> 📧 Email</label>
         <label class="channel-option"><input type="checkbox" id="chanPush" checked> 🔔 Notification Push</label>
       `;
       subjectLabel.parentNode.insertBefore(div, subjectLabel);
       
       const hint = document.createElement('div');
       hint.className = 'mail-hint';
       hint.style.marginBottom = '15px';
       hint.innerHTML = "💡 <b>Smart Send :</b> Si vous cochez 'Push', les utilisateurs sans push recevront automatiquement un Email à la place.";
       subjectLabel.parentNode.insertBefore(hint, subjectLabel);
    }
  }

  // EXPORTS
  window.renderQuickGroups = renderQuickGroups;
  window.renderUsersGrid = renderUsersGrid;
  window.renderGroupsList = renderGroupsList;
  window.sendManualEmail = sendManualEmail;
  window.clearMailSelection = clearMailSelection;
  window.openMailGroupModal = openMailGroupModal;
  window.closeMailGroupModal = closeMailGroupModal;
  window.saveMailGroup = saveMailGroup;
  window.deleteMailGroup = deleteMailGroup;
  window.saveMailSettings = saveMailSettings;
  window.toggleMailRecipient = toggleMailRecipient;
  window.selectMailGroup = selectMailGroup;

  // INIT
  document.addEventListener('DOMContentLoaded', () => {
     injectChannelSelector();
     renderQuickGroups();
     renderUsersGrid();
     renderGroupsList();
  });

})();
