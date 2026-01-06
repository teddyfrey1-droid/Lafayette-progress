/*
  Mail & Push System for Lafayette-progress
  - Gère la sélection des utilisateurs
  - Gère le choix des canaux (Email / Push)
  - Envoie les IDs au backend pour traitement intelligent (Smart Broadcast)
*/

(function(){
  'use strict';

  // --- STATE ---
  let mailGroups = {}; 
  let selectedUserIds = new Set();
  let activeGroupId = null;
  let editingGroupId = null;
  let modalSelected = new Set();

  // --- UTILS ---
  function safeGet(id){ return document.getElementById(id); }
  function escapeHtml(str){ return String(str ?? '').replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  function getUsersArray(){
    try{
      const raw = (typeof window.allUsers !== 'undefined' && window.allUsers) ? window.allUsers : {};
      return Object.keys(raw).map(uid => ({ uid, ...(raw[uid]||{}) }));
    } catch(e){ return []; }
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
      // On vérifie si un token Push est présent (fcmToken ou pushToken)
      const hasPush = !!(u.fcmToken || u.pushToken || (u.fcm && u.fcm.token)); 

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

  // --- ACTIONS DE SÉLECTION ---

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

  // --- SENDING LOGIC (SMART BROADCAST) ---

  async function sendManualEmail(){
    const subject = (safeGet('mailSubject')?.value || '').trim();
    const message = (safeGet('mailMessage')?.value || '').trim();
    
    // Récupération des choix de canaux (cases à cocher injectées)
    const sendEmail = safeGet('chanEmail')?.checked || false;
    const sendPush = safeGet('chanPush')?.checked || false;

    if(selectedUserIds.size === 0){ alert('⚠️ Sélectionne au moins un destinataire.'); return; }
    if(!sendEmail && !sendPush){ alert('⚠️ Sélectionne au moins un canal (Email ou Push).'); return; }
    if(!subject){ alert('⚠️ Le sujet est obligatoire.'); return; }
    if(!message){ alert('⚠️ Le message est obligatoire.'); return; }

    const region = getFunctionsRegion();
    const fromName = (safeGet('mailFromName')?.value || '').trim();

    // Payload intelligent : on envoie les IDs et les préférences
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
      // On appelle la nouvelle fonction Cloud "sendSmartBroadcast"
      const functions = region ? firebase.app().functions(region) : firebase.app().functions();
      const call = functions.httpsCallable('sendSmartBroadcast'); 
      const res = await call(payload);

      const { successCount, failureCount } = res.data || {};
      const failMsg = failureCount > 0 ? ` (${failureCount} échecs)` : '';
      showToast(`✅ Envoyé ! (${successCount} succès)${failMsg}`);
      
      // Reset formulaire
      safeGet('mailSubject').value = '';
      safeGet('mailMessage').value = '';
      clearMailSelection();

    } catch(e){
      console.error(e);
      alert("Erreur lors de l'envoi : " + (e.message || e));
    }
  }

  // --- GESTION DES GROUPES (MODALE) ---

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
  // Exposé globalement pour l'onclick HTML
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
     const region = safeGet('mailFunctionsRegion').value.trim();
     const name = safeGet('mailFromName').value.trim();
     await firebase.database().ref('settings').update({ functionsRegion: region, mailFromName: name });
     showToast('Paramètres sauvegardés');
  }

  // ------------------------------------------------------------
  // ALERTES (EatPilot) : Équipes programmées + Routage des canaux
  // ------------------------------------------------------------

  let alertTeams = {};
  let alertRouting = { mode: 'push_fallback', fallbackNoTeam: 'all' };

  function isAdmin(){
    try{
      const r = (window.currentUser && window.currentUser.role) ? String(window.currentUser.role).toLowerCase() : '';
      return (r === 'admin' || r === 'superadmin');
    }catch(e){ return false; }
  }

  function renderAlertRoutingUI(){
    const wrap = document.getElementById('alertRoutingAdmin');
    if(!wrap) return;
    if(!isAdmin()){ wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';

    const modeEl = document.getElementById('alertRoutingMode');
    const fbEl = document.getElementById('alertRoutingFallbackNoTeam');

    const fromSettings = (window.globalSettings && window.globalSettings.alertRouting) ? window.globalSettings.alertRouting : null;
    if(fromSettings){
      alertRouting = {
        mode: String(fromSettings.mode || alertRouting.mode),
        fallbackNoTeam: String(fromSettings.fallbackNoTeam || alertRouting.fallbackNoTeam),
      };
    }
    // Normalisation : on n'accepte que les valeurs supportées par la Cloud Function
    const allowedModes = ['push_fallback','both','push_only','email_only'];
    if(!allowedModes.includes(String(alertRouting.mode||''))) alertRouting.mode = 'push_fallback';
    if(modeEl) modeEl.value = alertRouting.mode;
    if(fbEl) fbEl.value = alertRouting.fallbackNoTeam;
  }

  async function saveAlertRoutingSettings(){
    if(!isAdmin()) return;
    const modeEl = document.getElementById('alertRoutingMode');
    const fbEl = document.getElementById('alertRoutingFallbackNoTeam');
    if(!modeEl || !fbEl) return;
    const allowedModes = ['push_fallback','both','push_only','email_only'];
    const rawMode = String(modeEl.value || 'push_fallback');
    const mode = allowedModes.includes(rawMode) ? rawMode : 'push_fallback';
    const fallbackNoTeam = String(fbEl.value || 'all');
    await firebase.database().ref('settings/alertRouting').set({ mode, fallbackNoTeam, updatedAt: Date.now() });
    showToast('✅ Routage sauvegardé');
  }

  // --- Équipes programmées ---
  let editingAlertTeamId = null;
  let alertTeamModalSelected = new Set();

  function openAlertTeamModal(teamId){
    if(!isAdmin()) return;
    const modal = document.getElementById('alertTeamModal');
    if(!modal) return;

    editingAlertTeamId = teamId || null;
    alertTeamModalSelected = new Set();

    const title = document.getElementById('alertTeamModalTitle');
    const idEl = document.getElementById('alertTeamId');
    const nameEl = document.getElementById('alertTeamName');
    const colorEl = document.getElementById('alertTeamColor');
    const startEl = document.getElementById('alertTeamStart');
    const endEl = document.getElementById('alertTeamEnd');
    const daysWrap = document.getElementById('alertTeamDays');
    const searchEl = document.getElementById('alertTeamMemberSearch');

    const t = (teamId && alertTeams && alertTeams[teamId]) ? alertTeams[teamId] : null;
    if(title) title.textContent = t ? '✏️ Modifier équipe' : '➕ Nouvelle équipe';
    if(idEl) idEl.value = teamId || '';
    if(nameEl) nameEl.value = (t && t.name) ? t.name : '';
    if(colorEl) colorEl.value = (t && t.color) ? t.color : '#8b5cf6';
    if(startEl) startEl.value = (t && (t.start || t.startTime)) ? (t.start || t.startTime) : '09:00';
    if(endEl) endEl.value = (t && (t.end || t.endTime)) ? (t.end || t.endTime) : '18:00';
    if(searchEl) searchEl.value = '';

    // jours
    if(daysWrap){
      const days = Array.isArray(t && t.days) ? t.days.map(n=>Number(n)) : [1,2,3,4,5];
      daysWrap.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        const v = Number(cb.value);
        cb.checked = days.includes(v);
      });
    }

    // membres
    const uids = (() => {
      if(!t) return [];
      if(Array.isArray(t.userIds)) return t.userIds;
      if(Array.isArray(t.members)) return t.members;
      if(t.memberUids && typeof t.memberUids === 'object') return Object.keys(t.memberUids);
      return [];
    })();
    uids.forEach(uid => { if(uid) alertTeamModalSelected.add(String(uid)); });

    renderAlertTeamModalMembers();

    modal.style.display = 'flex';
  }

  function closeAlertTeamModal(){
    const modal = document.getElementById('alertTeamModal');
    if(modal) modal.style.display = 'none';
    editingAlertTeamId = null;
    alertTeamModalSelected = new Set();
  }

  function renderAlertTeamModalMembers(){
    const box = document.getElementById('alertTeamMembers');
    if(!box) return;
    const search = (document.getElementById('alertTeamMemberSearch')?.value || '').toLowerCase().trim();

    const users = window.allUsers || {};
    const entries = Object.keys(users).map(uid => ({ uid, u: users[uid] || {} }));
    entries.sort((a,b) => (a.u.name||a.u.email||a.uid||'').localeCompare((b.u.name||b.u.email||b.uid||''), 'fr', {sensitivity:'base'}));

    box.innerHTML = '';
    entries.forEach(({uid,u}) => {
      const label = `${u.name || 'Sans nom'} — ${u.email || uid}`;
      if(search && !label.toLowerCase().includes(search)) return;
      const hasPush = !!(u.fcmToken || u.pushToken || (u.fcm && u.fcm.token));
      const row = document.createElement('label');
      row.className = 'mail-member-row';
      row.innerHTML = `
        <input type="checkbox" ${alertTeamModalSelected.has(uid) ? 'checked' : ''} />
        <div class="mail-member-main">
          <div class="mail-member-name">${escapeHtml(u.name || 'Sans nom')}</div>
          <div class="mail-member-sub">${escapeHtml(u.email || uid)} • ${hasPush ? '🔔 Push ON' : '🔕 Push OFF'}</div>
        </div>
      `;
      row.querySelector('input').addEventListener('change', (e) => {
        if(e.target.checked) alertTeamModalSelected.add(uid);
        else alertTeamModalSelected.delete(uid);
      });
      box.appendChild(row);
    });
  }

  async function saveAlertTeam(){
    if(!isAdmin()) return;
    const name = (document.getElementById('alertTeamName')?.value || '').trim();
    if(!name) return alert('Nom obligatoire');
    const color = (document.getElementById('alertTeamColor')?.value || '#8b5cf6').trim();
    const start = (document.getElementById('alertTeamStart')?.value || '09:00').trim();
    const end = (document.getElementById('alertTeamEnd')?.value || '18:00').trim();

    const daysWrap = document.getElementById('alertTeamDays');
    const days = [];
    if(daysWrap){
      daysWrap.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        if(cb.checked) days.push(Number(cb.value));
      });
    }

    const id = editingAlertTeamId || ('t' + Date.now());

    await firebase.database().ref('alertTeams/' + id).update({
      name,
      color,
      start,
      end,
      days,
      enabled: true,
      userIds: Array.from(alertTeamModalSelected),
      updatedAt: Date.now(),
    });

    showToast('✅ Équipe enregistrée');
    closeAlertTeamModal();
  }

  async function deleteAlertTeam(id){
    if(!isAdmin()) return;
    if(!id) return;
    if(confirm('Supprimer cette équipe programmée ?')){
      await firebase.database().ref('alertTeams/' + id).remove();
      showToast('🗑️ Équipe supprimée');
    }
  }

  function _formatDays(daysArr){
    const map = {1:'Lun',2:'Mar',3:'Mer',4:'Jeu',5:'Ven',6:'Sam',7:'Dim'};
    const d = (Array.isArray(daysArr) ? daysArr : []).map(n=>Number(n)).filter(n=>n>=1&&n<=7);
    if(d.length === 0) return 'Tous les jours';
    return d.sort((a,b)=>a-b).map(n=>map[n]).join(' · ');
  }

  function renderAlertTeamsList(){
    const box = document.getElementById('alertTeamsList');
    if(!box) return;
    if(!isAdmin()){ box.innerHTML = '<div class="mail-hint">Réservé aux admins.</div>'; return; }

    const teamsObj = window.alertTeams || alertTeams || {};
    const ids = Object.keys(teamsObj || {});
    ids.sort((a,b) => {
      const an = (teamsObj[a]?.name || a).toString();
      const bn = (teamsObj[b]?.name || b).toString();
      return an.localeCompare(bn,'fr',{sensitivity:'base'});
    });

    if(ids.length === 0){
      box.innerHTML = `<div class="alert-empty">Aucune équipe programmée. Crée une équipe (ex: 09:00–18:00) pour router les alertes automatiquement.</div>`;
      return;
    }

    // Info "active maintenant" (client-side)
    const now = new Date();
    const nowHH = String(now.getHours()).padStart(2,'0');
    const nowMM = String(now.getMinutes()).padStart(2,'0');
    const nowMinutes = (now.getHours()*60) + now.getMinutes();
    const jsDow = now.getDay(); // 0=dim
    const nowDow = (jsDow === 0) ? 7 : jsDow;

    box.innerHTML = '';
    ids.forEach(id => {
      const t = teamsObj[id] || {};
      const name = (t.name || id).toString();
      const start = (t.start || t.startTime || '—').toString();
      const end = (t.end || t.endTime || '—').toString();
      const membersCount = (() => {
        if(Array.isArray(t.userIds)) return t.userIds.length;
        if(Array.isArray(t.members)) return t.members.length;
        if(t.memberUids && typeof t.memberUids === 'object') return Object.keys(t.memberUids).length;
        return 0;
      })();
      const activeNow = (t.enabled === false) ? false : _isTeamActiveClient(t, nowMinutes, nowDow);

      const card = document.createElement('div');
      card.className = 'alert-team-card';
      card.innerHTML = `
        <div class="alert-team-top">
          <div class="alert-team-left">
            <div class="alert-team-name">
              <span class="alert-team-dot" style="--dot:${escapeHtml(t.color || '#8b5cf6')}; background:var(--dot);"></span>
              <span>${escapeHtml(name)}</span>
              ${activeNow ? '<span class="alert-team-live">LIVE</span>' : ''}
            </div>
            <div class="alert-team-meta">
              <span class="alert-team-hours">🕒 ${escapeHtml(start)}–${escapeHtml(end)}</span>
              <span class="alert-team-days">📅 ${escapeHtml(_formatDays(t.days))}</span>
              <span class="alert-team-members">👥 ${membersCount} membre(s)</span>
            </div>
          </div>
          <div class="alert-team-actions">
            <button class="action-btn" onclick="openAlertTeamModal('${id}')" title="Modifier">✏️</button>
            <button class="action-btn delete" onclick="deleteAlertTeam('${id}')" title="Supprimer">🗑️</button>
          </div>
        </div>
      `;
      box.appendChild(card);
    });

    // Affiche l'heure locale (client) dans une hint si besoin
    const hint = document.getElementById('alertTeamsNowHint');
    if(hint) hint.textContent = `Heure actuelle : ${nowHH}:${nowMM}`;
  }

  function _parseHHMMClient(v){
    const m = String(v||'').match(/^(\d{1,2}):(\d{2})$/);
    if(!m) return NaN;
    const h = Number(m[1]);
    const mm = Number(m[2]);
    if(!isFinite(h)||!isFinite(mm)||h<0||h>23||mm<0||mm>59) return NaN;
    return h*60+mm;
  }
  function _isTeamActiveClient(team, nowMinutes, nowDow){
    const start = _parseHHMMClient(team.start || team.startTime);
    const end = _parseHHMMClient(team.end || team.endTime);
    if(!isFinite(start) || !isFinite(end)) return false;
    const crosses = start > end;
    let dayToCheck = nowDow;
    if(crosses && nowMinutes < end){
      dayToCheck = (nowDow === 1) ? 7 : (nowDow - 1);
    }
    const days = Array.isArray(team.days) ? team.days.map(n=>Number(n)).filter(n=>n>=1&&n<=7) : [];
    if(days.length > 0 && !days.includes(dayToCheck)) return false;
    if(start === end) return true;
    if(!crosses) return nowMinutes >= start && nowMinutes < end;
    return (nowMinutes >= start) || (nowMinutes < end);
  }

  // --- INJECTION HTML SÉLECTEUR DE CANAUX ---
  // Ajoute dynamiquement les cases à cocher si elles n'existent pas encore dans le DOM
  function injectChannelSelector(){
    const subjectLabel = Array.from(document.querySelectorAll('.mail-label')).find(el => el.textContent.includes('Sujet'));
    
    if(subjectLabel && !document.getElementById('chanEmail')){
       const div = document.createElement('div');
       div.className = 'channel-selector'; // Classe définie dans le nouveau CSS (ajouté en bas du fichier styles)
       div.innerHTML = `
         <label class="channel-option" title="Envoyer par email">
            <input type="checkbox" id="chanEmail" checked> 📧 Email
         </label>
         <label class="channel-option" title="Envoyer une notification mobile">
            <input type="checkbox" id="chanPush" checked> 🔔 Notification Push
         </label>
       `;
       subjectLabel.parentNode.insertBefore(div, subjectLabel);
       
       const hint = document.createElement('div');
       hint.className = 'mail-hint';
       hint.style.marginBottom = '15px';
       hint.innerHTML = "💡 <b>Smart Send :</b> Si le Push est activé mais que l'utilisateur n'a pas l'app, il recevra un Email (si disponible).";
       subjectLabel.parentNode.insertBefore(hint, subjectLabel);
    }
  }

  // --- EXPORTS GLOBAUX ---
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

  // Alertes (EatPilot)
  window.renderAlertRoutingUI = renderAlertRoutingUI;
  window.saveAlertRoutingSettings = saveAlertRoutingSettings;
  window.renderAlertTeamsList = renderAlertTeamsList;
  window.openAlertTeamModal = openAlertTeamModal;
  window.closeAlertTeamModal = closeAlertTeamModal;
  window.saveAlertTeam = saveAlertTeam;
  window.renderAlertTeamModalMembers = renderAlertTeamModalMembers;
  window.deleteAlertTeam = deleteAlertTeam;

  // --- INIT ---
  document.addEventListener('DOMContentLoaded', () => {
     injectChannelSelector(); // Crée les cases à cocher
     
     if(window.mailGroups) renderQuickGroups();
     if(window.allUsers) renderUsersGrid();
     
     if(firebase.database){
         firebase.database().ref('mailGroups').on('value', (s) => {
             mailGroups = s.val() || {};
             renderQuickGroups();
             renderGroupsList();
         });

         // Alertes : listeners démarrent dès que l'utilisateur est chargé (admin)
         let tries = 0;
         const t = setInterval(() => {
           tries++;
           if(tries > 60){ clearInterval(t); return; }
           if(!isAdmin()) return;
           clearInterval(t);

           try{
             firebase.database().ref('alertTeams').on('value', (s) => {
               alertTeams = s.val() || {};
               window.alertTeams = alertTeams;
               renderAlertTeamsList();
             });
           }catch(e){}

           try{
             firebase.database().ref('settings/alertRouting').on('value', (s) => {
               const v = s.val() || {};
               window.globalSettings = window.globalSettings || {};
               window.globalSettings.alertRouting = v;
               renderAlertRoutingUI();
             });
           }catch(e){}

           // 1er rendu
           try{ renderAlertRoutingUI(); }catch(e){}
           try{ renderAlertTeamsList(); }catch(e){}
         }, 250);
     }
  });

})();
