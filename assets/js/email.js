/*
  Système de diffusion multi-canal pour Lafayette
  Version finale sans bugs + auth + users fix
*/

(function() {
  'use strict';

  // Variables d'état
  var mailGroups = {};
  var selectedUserIds = new Set();
  var activeGroupId = null;
  var editingGroupId = null;
  var modalSelected = new Set();

  // Utilitaires
  function safeGet(id) {
    return document.getElementById(id);
  }

  function escapeHtml(str) {
    var text = String(str || '');
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getUsersArray() {
    try {
      var raw = window.allUsers || {};
      console.log('📋 Users disponibles:', Object.keys(raw).length);
      var result = [];
      for (var uid in raw) {
        if (raw.hasOwnProperty(uid)) {
          var user = raw[uid] || {};
          user.uid = uid;
          result.push(user);
        }
      }
      console.log('📋 Users mappés:', result.length);
      return result;
    } catch (e) {
      console.error('❌ Erreur getUsersArray:', e);
      return [];
    }
  }

  function isAdmin() {
    try {
      if (typeof isAdminUser === 'function') {
        return !!isAdminUser();
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  function getFunctionsRegion() {
    try {
      if (typeof globalSettings !== 'undefined' && globalSettings && globalSettings.functionsRegion) {
        var region = String(globalSettings.functionsRegion).trim();
        if (region) return region;
      }
    } catch (e) {}
    
    var input = safeGet('mailFunctionsRegion');
    if (input && input.value && input.value.trim()) {
      return input.value.trim();
    }
    return '';
  }

  function setSelectedCount() {
    var el = safeGet('mailSelectedCount');
    if (!el) return;
    el.textContent = selectedUserIds.size + ' destinataire(s) sélectionné(s)';
  }

  function normalizeMessageToHtml(text) {
    var s = String(text || '');
    var hasTag = /<\w+[^>]*>/.test(s);
    if (hasTag) return s;
    return escapeHtml(s).replace(/\n/g, '<br>');
  }

  function getSelectedChannel() {
    try {
      var radios = document.getElementsByName('diffusionChannel');
      for (var i = 0; i < radios.length; i++) {
        if (radios[i].checked) {
          return radios[i].value;
        }
      }
    } catch (e) {}
    return 'email';
  }

  function getFallbackToEmail() {
    var chk = safeGet('fallbackToEmail');
    return chk ? chk.checked : true;
  }

  function updatePushStats(enabled, disabled) {
    var box = safeGet('pushStatsBox');
    var enabledEl = safeGet('pushEnabledCount');
    var disabledEl = safeGet('pushDisabledCount');
    
    if (!box) return;
    
    if (enabledEl) enabledEl.textContent = enabled;
    if (disabledEl) disabledEl.textContent = disabled;
    
    var channel = getSelectedChannel();
    if (channel === 'push' || channel === 'both') {
      box.style.display = 'block';
    } else {
      box.style.display = 'none';
    }
  }

  // ✅ FIX: Charge users + groups en live (comme contacts.js)
  function attachListeners() {
    if (typeof db === 'undefined' || !db) {
      console.error('❌ DB non disponible');
      return;
    }

    // Users live
    db.ref('users').on('value', function(snap) {
      window.allUsers = snap.val() || {};
      console.log('👥 Users chargés:', Object.keys(window.allUsers).length);
      renderMailUI();
    });

    // Groups live
    db.ref('mailGroups').on('value', function(snap) {
      mailGroups = snap.val() || {};
      console.log('👥 Groups chargés:', Object.keys(mailGroups).length);
      renderMailUI();
    });
  }

  function renderQuickGroups() {
    var wrap = safeGet('mailQuickGroups');
    if (!wrap) return;

    var groupsArr = [];
    for (var id in mailGroups) {
      if (mailGroups.hasOwnProperty(id)) {
        var g = mailGroups[id] || {};
        g.id = id;
        groupsArr.push(g);
      }
    }

    groupsArr.sort(function(a, b) {
      return String(a.name || '').localeCompare(String(b.name || ''));
    });

    if (groupsArr.length === 0) {
      wrap.innerHTML = '<div class="mail-hint">Aucun groupe.</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < groupsArr.length; i++) {
      var g = groupsArr[i];
      var n = Array.isArray(g.userIds) ? g.userIds.length : 0;
      var active = activeGroupId === g.id ? 'active' : '';
      html += '<div class="mail-chip ' + active + '" onclick="selectMailGroup(\'' + escapeHtml(g.id) + '\')">';
      html += '👥 ' + escapeHtml(g.name || 'Groupe') + ' (' + n + ')';
      html += '</div>';
    }
    wrap.innerHTML = html;
  }

  function renderUsersGrid() {
    console.log('🎨 renderUsersGrid appelée');
    var grid = safeGet('mailUsersGrid');
    if (!grid) {
      console.log('❌ Grid non trouvée');
      return;
    }

    var users = getUsersArray().filter(function(u) {
      return (u.email || '').trim().length > 3;
    });

    users.sort(function(a, b) {
      return String(a.name || '').localeCompare(String(b.name || ''));
    });

    console.log('👥 Users à afficher:', users.length);

    if (users.length === 0) {
      grid.innerHTML = '<div class="mail-hint">Aucun utilisateur avec email.</div>';
      return;
    }

    var pushEnabledCount = 0;
    var pushDisabledCount = 0;
    var html = '';

    for (var i = 0; i < users.length; i++) {
      var u = users[i];
      var selected = selectedUserIds.has(u.uid);
      var hasPush = !!(u.fcmToken && u.fcmToken.trim());
      
      if (hasPush) {
        pushEnabledCount++;
      } else {
        pushDisabledCount++;
      }

      var pushBadge = hasPush 
        ? '<span style="font-size:10px; padding:3px 6px; background:#10b981; color:white; border-radius:4px; font-weight:700;">🔔 PUSH</span>'
        : '<span style="font-size:10px; padding:3px 6px; background:#ef4444; color:white; border-radius:4px; font-weight:700;">📧 EMAIL</span>';

      html += '<div class="mail-user-card ' + (selected ? 'selected' : '') + '" onclick="toggleMailRecipient(\'' + u.uid + '\')">';
      html += '<div class="mail-user-check">' + (selected ? '✓' : '') + '</div>';
      html += '<div style="min-width:0; flex:1;">';
      html += '<div class="mail-user-name">' + escapeHtml(u.name || 'Sans nom') + '</div>';
      html += '<div class="mail-user-email">' + escapeHtml(u.email || '') + '</div>';
      html += '</div>';
      html += pushBadge;
      html += '</div>';
    }

    grid.innerHTML = html;
    console.log('✅ Users affichés');

    setSelectedCount();
    updatePushStats(pushEnabledCount, pushDisabledCount);
  }

  function renderGroupsList() {
    var list = safeGet('mailGroupsList');
    if (!list) return;

    var groupsArr = [];
    for (var id in mailGroups) {
      if (mailGroups.hasOwnProperty(id)) {
        var g = mailGroups[id] || {};
        g.id = id;
        groupsArr.push(g);
      }
    }

    if (groupsArr.length === 0) {
      list.innerHTML = '<div class="mail-hint">Aucun groupe.</div>';
      return;
    }

    var usersById = {};
    var allUsers = getUsersArray();
    for (var i = 0; i < allUsers.length; i++) {
      usersById[allUsers[i].uid] = allUsers[i];
    }

    var html = '';
    for (var j = 0; j < groupsArr.length; j++) {
      var g = groupsArr[j];
      var ids = Array.isArray(g.userIds) ? g.userIds : [];
      var color = g.color || '#3b82f6';

      html += '<div class="user-item" style="border-left:4px solid ' + color + ';">';
      html += '<div class="user-info">';
      html += '<div class="user-name">' + escapeHtml(g.name || 'Groupe') + '</div>';
      html += '<div class="user-meta">' + ids.length + ' membre(s)</div>';
      html += '</div>';
      html += '<div class="user-actions">';
      html += '<button onclick="openMailGroupModal(\'' + escapeHtml(g.id) + '\')" class="action-btn">✏️</button>';
      html += '<button onclick="deleteMailGroup(\'' + escapeHtml(g.id) + '\')" class="action-btn delete">🗑️</button>';
      html += '</div>';
      html += '</div>';
    }

    list.innerHTML = html;
  }

  function renderMailUI() {
    if (!isAdmin()) return;
    renderQuickGroups();
    renderUsersGrid();
    renderGroupsList();
  }

  function renderGroupModalMembers() {
    var members = safeGet('mailGroupMembers');
    if (!members) return;

    var users = getUsersArray().filter(function(u) {
      return (u.email || '').trim().length > 3;
    });

    if (users.length === 0) {
      members.innerHTML = '<div class="mail-hint">Aucun utilisateur.</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < users.length; i++) {
      var u = users[i];
      var checked = modalSelected.has(u.uid);
      html += '<div class="mail-user-card ' + (checked ? 'selected' : '') + '" onclick="toggleMailGroupMember(\'' + u.uid + '\')">';
      html += '<div class="mail-user-check">' + (checked ? '✓' : '') + '</div>';
      html += '<div style="flex:1;">';
      html += '<div class="mail-user-name">' + escapeHtml(u.name) + '</div>';
      html += '<div class="mail-user-email">' + escapeHtml(u.email) + '</div>';
      html += '</div>';
      html += '</div>';
    }

    members.innerHTML = html;
  }

  // Actions publiques
  function toggleMailRecipient(uid) {
    activeGroupId = null;
    if (selectedUserIds.has(uid)) {
      selectedUserIds.delete(uid);
    } else {
      selectedUserIds.add(uid);
    }
    renderUsersGrid();
    renderQuickGroups();
  }

  function selectMailGroup(groupId) {
    var g = mailGroups[groupId];
    if (!g || !Array.isArray(g.userIds)) return;
    activeGroupId = groupId;
    selectedUserIds = new Set(g.userIds);
    renderUsersGrid();
    renderQuickGroups();
  }

  function clearMailSelection() {
    activeGroupId = null;
    selectedUserIds = new Set();
    renderUsersGrid();
    renderQuickGroups();
  }

  function saveMailSettings() {
    if (!isAdmin()) return;
    if (typeof db === 'undefined' || !db) return;

    var reg = safeGet('mailFunctionsRegion');
    var fromName = safeGet('mailFromName');

    var updates = {};
    updates['settings/functionsRegion'] = (reg && reg.value ? reg.value.trim() : null) || null;
    updates['settings/mailFromName'] = (fromName && fromName.value ? fromName.value.trim() : null) || null;

    db.ref().update(updates).then(function() {
      showToast('✅ Réglages enregistrés');
    }).catch(function(e) {
      alert('Erreur lors de l\'enregistrement');
    });
  }

 function sendManualEmail() {
    if (!isAdmin()) return;
    
    // ✅ FIX AUTH: Vérifie connexion avant tout
    if (typeof firebase === 'undefined' || !firebase || !firebase.auth().currentUser) {
      showToast('❌ Reconnecte-toi d\'abord');
      return;
    }

    var subjectEl = safeGet('mailSubject');
    var messageEl = safeGet('mailMessage');
    
    var subject = (subjectEl && subjectEl.value ? subjectEl.value : '').trim();
    var message = (messageEl && messageEl.value ? messageEl.value : '').trim();

    if (selectedUserIds.size === 0) {
      alert('⚠️ Sélectionne au moins un destinataire');
      return;
    }
    if (!subject) {
      alert('⚠️ Le sujet est obligatoire');
      return;
    }
    if (!message) {
      alert('⚠️ Le message est obligatoire');
      return;
    }

    var usersById = {};
    var allUsers = getUsersArray();
    for (var i = 0; i < allUsers.length; i++) {
      usersById[allUsers[i].uid] = allUsers[i];
    }

    var recipientEmails = [];
    selectedUserIds.forEach(function(uid) {
      var u = usersById[uid];
      if (u && u.email) {
        var email = String(u.email).trim();
        if (email.length > 3) {
          recipientEmails.push(email);
        }
      }
    });

    var uniq = [];
    var seen = {};
    for (var j = 0; j < recipientEmails.length; j++) {
      var email = recipientEmails[j];
      if (!seen[email]) {
        seen[email] = true;
        uniq.push(email);
      }
    }

    if (uniq.length === 0) {
      alert('⚠️ Aucun email valide');
      return;
    }

    var MAX = 80;
    if (uniq.length > MAX) {
      var ok = confirm(uniq.length + ' emails. Limite: ' + MAX + '. Envoyer les ' + MAX + ' premiers ?');
      if (!ok) return;
      uniq = uniq.slice(0, MAX);
    }

    var region = getFunctionsRegion();
    var fromNameEl = safeGet('mailFromName');
    var fromName = (fromNameEl && fromNameEl.value ? fromNameEl.value : '').trim();
    var channel = getSelectedChannel();
    var fallback = getFallbackToEmail();

    var payload = {
      recipients: uniq,
      subject: subject,
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

    showToast('📨 Envoi en cours…');

    // ✅ FIX: Utilise async/await pour éviter bug listener Firebase
    (async function() {
      try {
        await firebase.auth().currentUser.getIdToken(true);
        var functions = region ? firebase.app().functions(region) : firebase.app().functions();
        var call = functions.httpsCallable('sendBulkEmail');
        var res = await call(payload);
        
        var sent = (res && res.data && res.data.sent) ? res.data.sent : uniq.length;
        var channelLabel = channel === 'email' ? 'Email' : channel === 'push' ? 'Push' : 'Email + Push';
        showToast('✅ ' + channelLabel + ' envoyé (' + sent + ')');

        if (subjectEl) subjectEl.value = '';
        if (messageEl) messageEl.value = '';
        clearMailSelection();

        try {
          logAction('Diffusion - Envoi', sent + ' via ' + channel);
        } catch (e) {}
      } catch (e) {
        console.error(e);
        var msg = (e && e.message ? String(e.message) : '').toLowerCase();
        if (msg.indexOf('not-found') >= 0 || msg.indexOf('functions') >= 0) {
          alert('Cloud Function introuvable.\nVérifie le déploiement functions/ et/ou la région.');
        } else if (msg.indexOf('permission') >= 0) {
          alert('Accès refusé (admin requis).');
        } else if (msg.indexOf('unauth') >= 0) {
          alert('Non authentifié. Déconnecte-toi / reconnecte-toi puis réessaie.');
        } else {
          alert('Erreur: ' + (e && e.message ? e.message : 'Inconnu'));
        }
      }
    })();
  }

  function openMailGroupModal(groupId) {
    var overlay = safeGet('mailGroupModal');
    if (!overlay) return;

    editingGroupId = null;
    modalSelected = new Set();

    var nameEl = safeGet('mailGroupName');
    var colorEl = safeGet('mailGroupColor');

    if (groupId && mailGroups[groupId]) {
      editingGroupId = groupId;
      var g = mailGroups[groupId];
      if (nameEl) nameEl.value = g.name || '';
      if (colorEl) colorEl.value = g.color || '#3b82f6';
      if (Array.isArray(g.userIds)) {
        modalSelected = new Set(g.userIds);
      }
    } else {
      if (nameEl) nameEl.value = '';
      if (colorEl) colorEl.value = '#3b82f6';
    }

    renderGroupModalMembers();
    overlay.style.display = 'flex';
  }

  function closeMailGroupModal() {
    var overlay = safeGet('mailGroupModal');
    if (overlay) overlay.style.display = 'none';
  }

  function toggleMailGroupMember(uid) {
    if (modalSelected.has(uid)) {
      modalSelected.delete(uid);
    } else {
      modalSelected.add(uid);
    }
    renderGroupModalMembers();
  }

  function saveMailGroup() {
    if (!isAdmin()) return;
    if (typeof db === 'undefined' || !db) return;

    var nameEl = safeGet('mailGroupName');
    var colorEl = safeGet('mailGroupColor');
    
    var name = (nameEl && nameEl.value ? nameEl.value : '').trim();
    var color = (colorEl && colorEl.value ? colorEl.value : '#3b82f6').trim();

    if (name.length < 2) {
      alert('Nom requis');
      return;
    }
    if (modalSelected.size === 0) {
      alert('Sélectionne au moins un membre');
      return;
    }

    var id = editingGroupId || ('g' + Date.now());
    var existing = mailGroups[id] || {};

    var payload = {
      name: name,
      color: color,
      userIds: Array.from(modalSelected),
      updatedAt: Date.now(),
      createdAt: existing.createdAt || Date.now()
    };

    db.ref('mailGroups/' + id).set(payload).then(function() {
      showToast('✅ Groupe sauvegardé');
      closeMailGroupModal();
    }).catch(function(e) {
      alert('Erreur');
    });
  }

  function deleteMailGroup(groupId) {
    if (!confirm('Supprimer ce groupe ?')) return;
    if (typeof db === 'undefined' || !db) return;

    db.ref('mailGroups/' + groupId).remove().then(function() {
      showToast('🗑️ Groupe supprimé');
      if (activeGroupId === groupId) {
        clearMailSelection();
      }
    }).catch(function(e) {
      alert('Erreur');
    });
  }

  // Exposition des fonctions
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
  window.getSelectedChannel = getSelectedChannel;
  window.getFallbackToEmail = getFallbackToEmail;

  // ✅ Initialisation : charge users + groups en temps réel
  console.log('📧 email.js initialisé');
  
  try {
    attachListeners();
  } catch (e) {
    console.error('❌ Erreur listeners:', e);
  }

  document.addEventListener('DOMContentLoaded', function() {
    try {
      renderMailUI();
    } catch (e) {
      console.error('❌ Erreur render:', e);
    }
  });

})();
