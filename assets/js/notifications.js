// ═══════════════════════════════════════════════════════════════════════
// 🔔 SYSTÈME DE NOTIFICATIONS - HEIKO LAFAYETTE
// ═══════════════════════════════════════════════════════════════════════

var currentFCMToken = null;

// ═══════════════════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS SETUP
// ═══════════════════════════════════════════════════════════════════════

async function setupPushNotifications() {
  // 🛡️ GUARD : Empêcher les appels répétés
  if (window.pushSetupInProgress || window.pushSetupDone) {
    console.log('⏭️ Setup push déjà en cours ou terminé');
    return;
  }
  window.pushSetupInProgress = true;
  
  if (!('Notification' in window)) {
    console.log('Push notifications not supported');
    window.pushSetupInProgress = false;
    return;
  }
  
  if (!firebase.messaging || !firebase.messaging.isSupported || !firebase.messaging.isSupported()) {
    console.log('FCM not supported');
    window.pushSetupInProgress = false;
    return;
  }
  
  try {
    const messaging = firebase.messaging();
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await messaging.getToken({
        vapidKey: 'BHItjKUG0Dz7jagVmfULxS7B_qQcT0DM7O_11fKdERKFzxP3QiWisJoD3agcV22VYFhtpVw-9YuUzrRmCZIawyo'
      });
      if (token) {
        currentFCMToken = token;
        console.log('✅ FCM Token obtenu:', token.substring(0, 20) + '...');
        if (currentUser && currentUser.uid) {
          await db.ref(`users/${currentUser.uid}/pushToken`).set(token);
          await db.ref(`users/${currentUser.uid}/pushEnabled`).set(true);
          await db.ref(`users/${currentUser.uid}/pushEnabledAt`).set(Date.now());
          console.log('✅ Push enabled et sauvegardé dans Firebase');
        }
        messaging.onMessage((payload) => {
          console.log('📨 Message reçu (foreground):', payload);
          showInAppNotification(payload);
        });
        window.pushSetupDone = true;
      }
    }
  } catch (error) {
    console.error('❌ Erreur setup push:', error);
  } finally {
    window.pushSetupInProgress = false;
  }
}

function showInAppNotification(payload) {
  const title = payload.notification?.title || payload.data?.title || 'Notification';
  const body = payload.notification?.body || payload.data?.body || '';
  const toast = document.getElementById('toast');
  if (toast) {
    toast.innerHTML = `<strong>${title}</strong><br>${body}`;
    toast.className = 'show';
    setTimeout(() => { toast.className = 'hide'; }, 5000);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// PUSH UI SETUP (Bannière + Cloche)
// ═══════════════════════════════════════════════════════════════════════

function setupPushUI() {
  if (!currentUser || !currentUser.uid || !currentUser.email) {
    console.log('⏳ User pas prêt pour push UI');
    return;
  }
  const banner = document.getElementById('pushInviteBanner');
  const bell = document.getElementById('pushBellBtn');
  if (!banner) {
    console.log('⚠️ Push banner introuvable');
    return;
  }
  
  db.ref(`users/${currentUser.uid}/pushEnabled`).once('value', (snap) => {
    const enabled = snap.val() === true;
    if (enabled) {
      hidePushBanner(banner);
      updatePushBellIcon(true);
      if (bell) {
        setTimeout(() => { bell.style.display = 'none'; }, 5000);
      }
    } else {
      if (bell) {
        bell.style.display = 'inline-flex';
      }
      const dismissed = localStorage.getItem(`pushDismissed_${currentUser.uid}`);
      if (!dismissed) {
        setTimeout(() => { showPushBanner(banner); }, 3000);
      }
    }
  });
  
  if (bell) {
    bell.onclick = enablePushNotifications;
  }
}

function showPushBanner(banner) {
  if (!banner) return;
  setTimeout(() => { banner.classList.add('show'); }, 100);
}

function hidePushBanner(banner) {
  if (!banner) return;
  banner.classList.remove('show');
}

async function enablePushNotifications() {
  try {
    await setupPushNotifications();
    const banner = document.getElementById('pushInviteBanner');
    const bell = document.getElementById('pushBellBtn');
    hidePushBanner(banner);
    updatePushBellIcon(true);
    if (bell) {
      setTimeout(() => { bell.style.display = 'none'; }, 2000);
    }
    if (typeof showToast === 'function') {
      showToast('✅ Notifications activées !');
    } else {
      alert('✅ Notifications activées !');
    }
  } catch (error) {
    console.error('❌ Erreur activation push:', error);
    alert('Erreur lors de l\'activation des notifications');
  }
}

function dismissPushBanner() {
  const banner = document.getElementById('pushInviteBanner');
  hidePushBanner(banner);
  if (currentUser && currentUser.uid) {
    localStorage.setItem(`pushDismissed_${currentUser.uid}`, Date.now());
  }
}

function updatePushBellIcon(enabled) {
  const bell = document.querySelector('.push-bell');
  if (!bell) return;
  if (enabled) {
    bell.classList.add('enabled');
  } else {
    bell.classList.remove('enabled');
  }
}

// ═══════════════════════════════════════════════════════════════════════
// ONGLET NOTIFICATIONS DANS LE MANAGER
// ═══════════════════════════════════════════════════════════════════════

function renderPushTab() {
  if (!isAdminUser()) return;
  renderPushUsers();
  renderPushSettings();
}

function renderPushUsers() {
  const container = document.getElementById('pushUsersList');
  if (!container) return;
  container.innerHTML = '';
  if (!allUsers) {
    container.innerHTML = '<div class="mail-hint">Chargement des utilisateurs...</div>';
    return;
  }
  
  const users = Object.keys(allUsers).map(uid => ({ uid, ...allUsers[uid] }));
  users.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  
  if (users.length === 0) {
    container.innerHTML = '<div class="mail-hint">Aucun utilisateur.</div>';
    return;
  }
  
  users.forEach(u => {
    const enabled = u.pushEnabled === true;
    const token = u.pushToken || '';
    const div = document.createElement('div');
    div.className = 'user-item';
    div.innerHTML = `
      <div class="user-info">
        <div class="user-name">${u.name || 'Sans nom'}</div>
        <div class="user-meta">${u.email || ''}</div>
      </div>
      <div class="pub-state ${enabled ? 'on' : 'off'}">
        ${enabled ? '✅ Activé' : '❌ Désactivé'}
      </div>
    `;
    container.appendChild(div);
  });
}

function renderPushSettings() {
  // Placeholder pour futurs réglages
}

// Exposer les fonctions globales
window.setupPushUI = setupPushUI;
window.setupPushNotifications = setupPushNotifications;
window.enablePushNotifications = enablePushNotifications;
window.dismissPushBanner = dismissPushBanner;
window.renderPushTab = renderPushTab;
