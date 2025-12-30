// ═══════════════════════════════════════════════════════════════════════
// 🔔 SYSTÈME DE NOTIFICATIONS - HEIKO LAFAYETTE
// ═══════════════════════════════════════════════════════════════════════
// - Notifications Push (Firebase Cloud Messaging)
// - Bannière d'invitation
// - Onglet Notifications dans Manager
// - Configuration des alertes automatiques
// ═══════════════════════════════════════════════════════════════════════

let currentFCMToken = null;

// ═══════════════════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS SETUP
// ═══════════════════════════════════════════════════════════════════════

async function setupPushNotifications() {
  if (!('Notification' in window)) {
    console.log('Push notifications not supported');
    return;
  }

  if (!firebase.messaging || !firebase.messaging.isSupported || !firebase.messaging.isSupported()) {
    console.log('FCM not supported');
    return;
  }

  try {
    const messaging = firebase.messaging();

    // Demander la permission et obtenir le token
    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      const token = await messaging.getToken({
        vapidKey: 'BHItjKUG0Dz7jagVmfULxS7B_qQcT0DM7O_11fKdERKFzxP3QiWisJoD3agcV22VYFhtpVw-9YuUzrRmCZIawyo'
      });

      if (token) {
        currentFCMToken = token;
        console.log('✅ FCM Token obtenu:', token.substring(0, 20) + '...');

        // Sauvegarder le token dans Firebase pour cet utilisateur
        if (currentUser && currentUser.uid) {
          await db.ref(`users/${currentUser.uid}/pushToken`).set(token);
          await db.ref(`users/${currentUser.uid}/pushEnabled`).set(true);
          await db.ref(`users/${currentUser.uid}/pushEnabledAt`).set(Date.now());
          console.log('✅ Push enabled et sauvegardé dans Firebase');
        }
      }

      // Écouter les messages en foreground
      messaging.onMessage((payload) => {
        console.log('📨 Message reçu (foreground):', payload);
        showInAppNotification(payload);
      });
    }
  } catch (error) {
    console.error('❌ Erreur setup push:', error);
  }
}

function showInAppNotification(payload) {
  const title = payload.notification?.title || payload.data?.title || 'Notification';
  const body = payload.notification?.body || payload.data?.body || '';

  // Afficher un toast custom
  const toast = document.getElementById('toast');
  if (toast) {
    toast.innerHTML = `<strong>${title}</strong><br>${body}`;
    toast.className = 'show';
    setTimeout(() => {
      toast.className = 'hide';
    }, 5000);
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

  // Vérifier si l'utilisateur a déjà activé les notifications
  db.ref(`users/${currentUser.uid}/pushEnabled`).once('value', (snap) => {
    const enabled = snap.val() === true;

    if (enabled) {
      // Déjà activé : masquer bannière et cloche
      hidePushBanner(banner);
      updatePushBellIcon(true);

      // Masquer la cloche après 5 secondes
      if (bell) {
        setTimeout(() => {
          bell.style.display = 'none';
        }, 5000);
      }
    } else {
      // Pas activé : afficher la cloche
      if (bell) {
        bell.style.display = 'inline-flex';
      }

      // Vérifier si l'utilisateur a déjà refusé la bannière
      const dismissed = localStorage.getItem(`pushDismissed_${currentUser.uid}`);
      if (!dismissed) {
        // Afficher la bannière après 3 secondes
        setTimeout(() => {
          showPushBanner(banner);
        }, 3000);
      }
    }
  });

  // Clic sur la cloche = activer les notifications
  if (bell) {
    bell.onclick = enablePushNotifications;
  }
}

function showPushBanner(banner) {
  if (!banner) return;
  setTimeout(() => {
    banner.classList.add('show');
  }, 100);
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

    // Faire disparaître la cloche
    if (bell) {
      setTimeout(() => {
        bell.style.display = 'none';
      }, 2000);
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

  // Sauvegarder que l'utilisateur a refusé
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
    container.innerHTML = '<div style="color:#999;font-style:italic">Chargement...</div>';
    return;
  }

  const users = Object.keys(allUsers).map(uid => ({ uid, ...allUsers[uid] }));
  users.sort((a, b) => a.name.localeCompare(b.name));

  if (users.length === 0) {
    container.innerHTML = '<div style="color:#999;font-style:italic">Aucun utilisateur.</div>';
    return;
  }

  users.forEach(u => {
    const div = document.createElement('div');
    div.className = 'user-item';

    const pushEnabled = u.pushEnabled === true;
    const pushDate = u.pushEnabledAt ? new Date(u.pushEnabledAt) : null;
    const dateStr = pushDate 
      ? `${pushDate.toLocaleDateString('fr-FR')} ${pushDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
      : '';

    const statusDot = pushEnabled 
      ? '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#22c55e;margin-right:8px"></span>'
      : '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#64748b;margin-right:8px"></span>';

    const statusText = pushEnabled 
      ? '<span style="color:#22c55e;font-weight:700">ACTIVES</span>'
      : '<span style="color:#64748b">Désactivées</span>';

    div.innerHTML = `
      <div class="user-info">
        <div class="user-header">
          <span class="user-name">${u.name || 'Utilisateur'}</span>
          <span style="font-size:13px">${statusDot}${statusText}</span>
        </div>
        <div class="user-meta">
          <div>${u.email || ''}</div>
          ${dateStr ? `<div style="font-size:12px;color:#94a3b8;margin-top:4px">Activé le ${dateStr}</div>` : ''}
        </div>
      </div>
    `;

    container.appendChild(div);
  });
}

function renderPushSettings() {
  const container = document.getElementById('pushSettings');
  if (!container) return;

  if (!globalSettings || !globalSettings.notifications) {
    container.innerHTML = '<div style="color:#999">Chargement...</div>';
    return;
  }

  const notif = globalSettings.notifications;

  container.innerHTML = `
    <div class="push-setting-item">
      <label class="switch">
        <input type="checkbox" id="pushAutoUpdate" ${notif.autoOnUpdate ? 'checked' : ''} onchange="savePushSetting('autoOnUpdate', this.checked)">
        <span class="slider"></span>
      </label>
      <div class="push-setting-label">
        <div style="font-weight:700;font-size:14px">Mise à jour publiée</div>
        <div style="font-size:12px;color:#94a3b8">Notifier quand une info est publiée</div>
      </div>
    </div>

    <div class="push-setting-item">
      <label class="switch">
        <input type="checkbox" id="pushAutoObj" ${notif.autoOnObjChange ? 'checked' : ''} onchange="savePushSetting('autoOnObjChange', this.checked)">
        <span class="slider"></span>
      </label>
      <div class="push-setting-label">
        <div style="font-weight:700;font-size:14px">Objectif modifié</div>
        <div style="font-size:12px;color:#94a3b8">Notifier les changements d'objectifs</div>
      </div>
    </div>

    <div class="push-setting-item">
      <label class="switch">
        <input type="checkbox" id="pushAutoPilotage" ${notif.autoOnPilotage ? 'checked' : ''} onchange="savePushSetting('autoOnPilotage', this.checked)">
        <span class="slider"></span>
      </label>
      <div class="push-setting-label">
        <div style="font-weight:700;font-size:14px">Pilotage publié</div>
        <div style="font-size:12px;color:#94a3b8">Notifier les mises à jour de primes</div>
      </div>
    </div>

    <div style="margin-top:20px;padding-top:20px;border-top:1px solid var(--border)">
      <button class="action-btn" onclick="sendTestNotification()" style="width:100%;font-size:14px;padding:12px">
        📨 Envoyer une notification test
      </button>
    </div>
  `;
}

function savePushSetting(key, value) {
  if (!isAdminUser()) return;

  db.ref(`settings/notifications/${key}`).set(value)
    .then(() => {
      showToast('✅ Paramètre sauvegardé !');
    })
    .catch(e => {
      console.error(e);
      alert('Erreur lors de la sauvegarde');
    });
}

function sendTestNotification() {
  if (!isAdminUser()) return;

  if (!confirm('Envoyer une notification test à tous les utilisateurs avec notifications actives ?')) {
    return;
  }

  sendSmartNotification('test', {
    title: '🧪 Notification de test',
    body: 'Si vous recevez ce message, les notifications fonctionnent !',
    link: 'index.html#dashboard'
  })
    .then(() => {
      showToast('✅ Notification test envoyée !');
    })
    .catch(e => {
      console.error(e);
      alert('Erreur: ' + e.message);
    });
}

// ═══════════════════════════════════════════════════════════════════════
// SMART NOTIFICATION (Push + Email fallback)
// ═══════════════════════════════════════════════════════════════════════

async function sendSmartNotification(kind, payload) {
  // kind: 'update', 'objective', 'pilotage', 'test'
  // payload: { title, body, link }

  if (!globalSettings || !globalSettings.notifications) {
    console.log('⚠️ Notifications settings not loaded');
    return;
  }

  const notif = globalSettings.notifications;

  // Vérifier si ce type d'alerte est activé
  let shouldSend = false;
  if (kind === 'update' && notif.autoOnUpdate) shouldSend = true;
  if (kind === 'objective' && notif.autoOnObjChange) shouldSend = true;
  if (kind === 'pilotage' && notif.autoOnPilotage) shouldSend = true;
  if (kind === 'test') shouldSend = true;

  if (!shouldSend) {
    console.log(`🔕 Notification "${kind}" désactivée`);
    return;
  }

  // Déterminer les destinataires
  const audience = notif.autoAudience || 'all';
  const targetUserIds = [];

  Object.keys(allUsers).forEach(uid => {
    const u = allUsers[uid];
    if (!u) return;

    // Exclure le super admin
    if (u.email && u.email.toLowerCase() === 'teddy.frey1@gmail.com') return;

    if (audience === 'all') {
      targetUserIds.push(uid);
    } else if (audience === 'admins' && u.role === 'admin') {
      targetUserIds.push(uid);
    }
  });

  if (targetUserIds.length === 0) {
    console.log('⚠️ Aucun destinataire');
    return;
  }

  console.log(`📨 Envoi notification "${kind}" à ${targetUserIds.length} utilisateurs`);

  // Essayer d'abord les notifications push
  try {
    const sendPushToUsers = firebase.functions().httpsCallable('sendPushToUsers');
    const result = await sendPushToUsers({
      userIds: targetUserIds,
      title: payload.title || 'Notification',
      body: payload.body || '',
      link: payload.link || 'index.html'
    });

    console.log('✅ Push envoyé:', result.data);

    // Si des utilisateurs n'ont pas reçu le push, fallback email
    const sent = result.data.sent || 0;
    if (sent < targetUserIds.length) {
      console.log(`⚠️ ${targetUserIds.length - sent} utilisateurs sans push, fallback email...`);
      await sendEmailFallback(targetUserIds, payload);
    }
  } catch (error) {
    console.error('❌ Erreur push, fallback email:', error);
    await sendEmailFallback(targetUserIds, payload);
  }
}

async function sendEmailFallback(userIds, payload) {
  try {
    const sendEmailToUsers = firebase.functions().httpsCallable('sendEmailToUsers');

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#2563eb">${payload.title}</h2>
        <p style="font-size:16px;line-height:1.6">${payload.body}</p>
        ${payload.link ? `<a href="${payload.link}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#2563eb;color:white;text-decoration:none;border-radius:8px">Voir</a>` : ''}
        <hr style="margin:30px 0;border:none;border-top:1px solid #e5e7eb">
        <p style="font-size:12px;color:#6b7280">Heiko Lafayette - Système de notifications</p>
      </div>
    `;

    const result = await sendEmailToUsers({
      userIds: userIds,
      subject: payload.title,
      html: html,
      text: payload.body
    });

    console.log('✅ Email fallback envoyé:', result.data);
  } catch (error) {
    console.error('❌ Erreur email fallback:', error);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// AUTO-NOTIFICATIONS (appelées depuis app.js)
// ═══════════════════════════════════════════════════════════════════════

async function maybeAutoNotify(kind, payload) {
  // Wrapper pour les appels depuis app.js
  try {
    await sendSmartNotification(kind, payload);
  } catch (e) {
    console.error('❌ Erreur maybeAutoNotify:', e);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// INIT AU CHARGEMENT
// ═══════════════════════════════════════════════════════════════════════

window.addEventListener('DOMContentLoaded', () => {
  // Attacher les boutons de la bannière
  const activateBtn = document.getElementById('pushInviteActivate');
  if (activateBtn) {
    activateBtn.onclick = enablePushNotifications;
  }

  const dismissBtn = document.getElementById('pushInviteDismiss');
  if (dismissBtn) {
    dismissBtn.onclick = dismissPushBanner;
  }
});

// Export pour utilisation globale
window.enablePushNotifications = enablePushNotifications;
window.dismissPushBanner = dismissPushBanner;
window.setupPushUI = setupPushUI;
window.setupPushNotifications = setupPushNotifications;
window.renderPushTab = renderPushTab;
window.sendSmartNotification = sendSmartNotification;
window.maybeAutoNotify = maybeAutoNotify;
window.savePushSetting = savePushSetting;
window.sendTestNotification = sendTestNotification;

// ═══════════════════════════════════════════════════════════════════════
// FIN DU FICHIER
// ═══════════════════════════════════════════════════════════════════════
