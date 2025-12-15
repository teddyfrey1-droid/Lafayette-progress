/* ==========================================
   GESTION DES NOTIFICATIONS
   ========================================== */

// Détecter si connexion depuis l'app ou web
function getConnectionType() {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                       window.navigator.standalone || 
                       document.referrer.includes('android-app://');
  
  return isStandalone ? 'app' : 'web';
}

// Enregistrer la connexion avec le type
function logUserConnection(userId) {
  if (!userId) return;
  
  const connectionType = getConnectionType();
  const timestamp = Date.now();
  
  firebase.database().ref(`users/${userId}/lastConnection`).set({
    type: connectionType,
    timestamp: timestamp,
    date: new Date(timestamp).toLocaleString('fr-FR')
  });
  
  // Ajouter aussi dans l'historique
  firebase.database().ref(`connectionHistory/${userId}`).push({
    type: connectionType,
    timestamp: timestamp
  });
}

// Toggle des notifications utilisateur
function toggleUserNotifications() {
  const enabled = document.getElementById('enableNotifToggle').checked;
  const userId = firebase.auth().currentUser?.uid;
  
  if (!userId) return;
  
  firebase.database().ref(`users/${userId}/notificationsEnabled`).set(enabled)
    .then(() => {
      showToast(enabled ? '✅ Notifications activées' : '⛔ Notifications désactivées');
      updateNotifStatus();
    });
}

// Mettre à jour le statut des notifications
function updateNotifStatus() {
  const userId = firebase.auth().currentUser?.uid;
  if (!userId) return;
  
  firebase.database().ref(`users/${userId}/notificationsEnabled`).once('value', snap => {
    const enabled = snap.val() || false;
    document.getElementById('enableNotifToggle').checked = enabled;
    
    const statusDiv = document.getElementById('notifStatus');
    if (enabled) {
      statusDiv.innerHTML = '✅ Les notifications sont activées pour votre compte.';
      statusDiv.style.color = '#10b981';
    } else {
      statusDiv.innerHTML = '⚠️ Les notifications sont désactivées.';
      statusDiv.style.color = '#ef4444';
    }
  });
}

// Afficher le badge de type de connexion
function renderConnectionBadge(type) {
  const emoji = type === 'app' ? '📱' : '🌐';
  const label = type === 'app' ? 'App' : 'Web';
  const className = type === 'app' ? 'app' : 'web';
  
  return `<span class="connection-badge ${className}">${emoji} ${label}</span>`;
}

// Afficher le badge "application activée"
function renderAppBadge(hasApp, hasNotifs) {
  if (hasApp && hasNotifs) {
    return '<span class="app-badge">📱 Application</span>';
  }
  return '';
}

// Mettre à jour la sélection de cibles pour notifications admin
function updateNotifTargets() {
  const type = document.getElementById('notifTargetType')?.value;
  const customList = document.getElementById('customUsersList');
  
  if (!customList) return;
  
  if (type === 'custom') {
    customList.style.display = 'block';
    loadUsersForSelection();
  } else {
    customList.style.display = 'none';
  }
  
  updateNotifCount();
}

// Charger la liste des utilisateurs pour sélection
function loadUsersForSelection() {
  firebase.database().ref('users').once('value', snap => {
    let html = '';
    snap.forEach(child => {
      const user = child.val();
      const uid = child.key;
      const hasNotif = user.notificationsEnabled ? '✅' : '';
      html += `
        <label>
          <input type="checkbox" class="user-checkbox" value="${uid}" onchange="updateNotifCount()">
          ${user.name} ${hasNotif}
        </label>
      `;
    });
    document.getElementById('customUsersList').innerHTML = html;
  });
}

// Mettre à jour le compteur d'utilisateurs ciblés
function updateNotifCount() {
  const type = document.getElementById('notifTargetType')?.value;
  const countDiv = document.getElementById('notifCount');
  
  if (!countDiv) return;
  
  if (type === 'custom') {
    const count = document.querySelectorAll('.user-checkbox:checked').length;
    countDiv.textContent = `${count} utilisateur(s) ciblé(s)`;
  } else {
    firebase.database().ref('users').once('value', snap => {
      let count = 0;
      if (type === 'all') {
        count = snap.numChildren();
      } else if (type === 'with_notifs') {
        snap.forEach(child => {
          if (child.val().notificationsEnabled) count++;
        });
      }
      countDiv.textContent = `${count} utilisateur(s) ciblé(s)`;
    });
  }
}

// Envoyer une notification admin
function sendAdminNotification() {
  const type = document.getElementById('notifTargetType')?.value;
  const message = document.getElementById('notifMessage')?.value;
  
  if (!message) {
    alert('Veuillez entrer un message');
    return;
  }
  
  let targetUsers = [];
  
  if (type === 'custom') {
    document.querySelectorAll('.user-checkbox:checked').forEach(cb => {
      targetUsers.push(cb.value);
    });
  } else {
    firebase.database().ref('users').once('value', snap => {
      snap.forEach(child => {
        const user = child.val();
        if (type === 'all' || (type === 'with_notifs' && user.notificationsEnabled)) {
          targetUsers.push(child.key);
        }
      });
      
      sendNotificationToUsers(targetUsers, message);
    });
    return;
  }
  
  sendNotificationToUsers(targetUsers, message);
}

function sendNotificationToUsers(userIds, message) {
  if (userIds.length === 0) {
    alert('Aucun utilisateur ciblé');
    return;
  }
  
  const timestamp = Date.now();
  const promises = [];
  
  userIds.forEach(uid => {
    promises.push(
      firebase.database().ref(`notifications/${uid}`).push({
        message: message,
        timestamp: timestamp,
        read: false
      })
    );
  });
  
  Promise.all(promises).then(() => {
    showToast(`✅ Notification envoyée à ${userIds.length} utilisateur(s)`);
    document.getElementById('notifMessage').value = '';
    closeNotifModal();
  });
}

// Initialiser les notifications au chargement
if (typeof firebase !== 'undefined') {
  firebase.auth().onAuthStateChanged(user => {
    if (user) {
      logUserConnection(user.uid);
      setTimeout(() => {
        updateNotifStatus();
      }, 500);
    }
  });
}
