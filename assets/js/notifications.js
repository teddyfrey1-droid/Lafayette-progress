// ========================================
// SYSTÈME DE NOTIFICATIONS PUSH & EMAIL
// ========================================

let currentFCMToken = null;
let notificationConfig = {
  objectiveReached: { push: true, email: true, fallback: true },
  bonusCalculated: { push: true, email: true, fallback: true },
  updates: { push: true, email: true, fallback: true },
  feedback: { push: true, email: false, fallback: true },
  systemAlert: { push: true, email: true, fallback: true },
  directMessage: { push: true, email: false, fallback: true }
};

// ========================================
// SETUP PUSH NOTIFICATIONS
// ========================================
async function setupPushNotifications() {
  if (!('Notification' in window)) {
    console.log('Push notifications not supported');
    return false;
  }

  if (!firebase.messaging || !firebase.messaging.isSupported || !firebase.messaging.isSupported()) {
    console.log('FCM not supported');
    return false;
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
        console.log('FCM Token:', token);

        // Sauvegarder le token dans Firebase pour cet utilisateur
        if (currentUser && currentUser.uid) {
          await db.ref(`users/${currentUser.uid}/pushToken`).set(token);
          await db.ref(`users/${currentUser.uid}/pushEnabled`).set(true);
          await db.ref(`users/${currentUser.uid}/pushEnabledAt`).set(Date.now());
          console.log('✅ Push enabled and saved to Firebase');

          // Mettre à jour l'UI
          updatePushUI(true);

          // Cacher la cloche du menu
          updateBellVisibility(true);
        }

        // Écouter les messages en foreground
        messaging.onMessage((payload) => {
          console.log('Message received (foreground):', payload);
          showInAppNotification(payload);
        });

        return true;
      }
    } else {
      console.log('Permission denied');
      return false;
    }
  } catch (error) {
    console.error('Error setting up push:', error);
    return false;
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

// ========================================
// GESTION DE LA CLOCHE DANS LE MENU
// ========================================
function updateBellVisibility(pushEnabled) {
  // Trouver tous les éléments du menu avec la cloche
  const menuItems = document.querySelectorAll('#globalMenu a');
  menuItems.forEach(item => {
    if (item.textContent.includes('🔔')) {
      item.style.display = pushEnabled ? 'none' : 'flex';
    }
  });
}

// ========================================
// CHARGER LA CONFIGURATION DES NOTIFICATIONS
// ========================================
async function loadNotificationConfig() {
  if (!db) return;

  try {
    const snap = await db.ref('settings/notificationConfig').once('value');
    const config = snap.val();

    if (config) {
      notificationConfig = { ...notificationConfig, ...config };
    }

    // Remplir l'UI avec les valeurs
    updateNotificationUI();
  } catch (error) {
    console.error('Error loading notification config:', error);
  }
}

function updateNotificationUI() {
  Object.keys(notificationConfig).forEach(notifType => {
    const config = notificationConfig[notifType];

    // Push checkbox
    const pushInput = document.querySelector(`input[data-notif="${notifType}"][data-channel="push"]`);
    if (pushInput) pushInput.checked = config.push === true;

    // Email checkbox
    const emailInput = document.querySelector(`input[data-notif="${notifType}"][data-channel="email"]`);
    if (emailInput) emailInput.checked = config.email === true;

    // Fallback checkbox
    const fallbackInput = document.querySelector(`input[data-notif="${notifType}"][data-fallback="true"]`);
    if (fallbackInput) fallbackInput.checked = config.fallback !== false;
  });
}

// ========================================
// SAUVEGARDER LA CONFIGURATION
// ========================================
async function saveNotificationConfig() {
  if (!isAdminUser || !isAdminUser()) {
    alert('⛔ Seuls les administrateurs peuvent modifier cette configuration');
    return;
  }

  const config = {};

  // Lire toutes les checkboxes
  document.querySelectorAll('input[data-notif]').forEach(input => {
    const notifType = input.dataset.notif;
    const channel = input.dataset.channel;
    const isFallback = input.dataset.fallback === 'true';

    if (!config[notifType]) {
      config[notifType] = { push: false, email: false, fallback: true };
    }

    if (isFallback) {
      config[notifType].fallback = input.checked;
    } else if (channel) {
      config[notifType][channel] = input.checked;
    }
  });

  try {
    await db.ref('settings/notificationConfig').set(config);
    notificationConfig = config;

    if (typeof showToast === 'function') {
      showToast('✅ Configuration des notifications sauvegardée');
    } else {
      alert('✅ Configuration sauvegardée');
    }

    if (typeof logAction === 'function') {
      logAction('notification_config_updated', { config });
    }
  } catch (error) {
    console.error('Error saving notification config:', error);
    alert('❌ Erreur lors de la sauvegarde');
  }
}

// ========================================
// AFFICHER L'ONGLET NOTIFICATIONS
// ========================================
async function showNotificationsTab() {
  if (!currentUser || !currentUser.uid) return;

  // Vérifier le statut push de l'utilisateur actuel
  const pushSnap = await db.ref(`users/${currentUser.uid}/pushEnabled`).once('value');
  const pushEnabled = pushSnap.val() === true;

  updatePushUI(pushEnabled);
  updateBellVisibility(pushEnabled);

  // Afficher la section admin si admin
  const adminSection = document.getElementById('notifAdminSection');
  if (adminSection) {
    adminSection.style.display = isAdminUser() ? 'block' : 'none';
  }

  // Charger la configuration
  await loadNotificationConfig();

  // Charger la liste des utilisateurs avec leur statut push
  if (isAdminUser()) {
    await loadTeamPushStatus();
  }
}

function updatePushUI(enabled) {
  const statusBadge = document.getElementById('currentUserPushStatus');
  const toggleBtn = document.getElementById('toggleMyPushBtn');

  if (statusBadge) {
    const dot = statusBadge.querySelector('.status-dot');
    const text = statusBadge.querySelector('.status-text');

    if (enabled) {
      statusBadge.classList.add('status-enabled');
      statusBadge.classList.remove('status-disabled');
      if (dot) dot.style.backgroundColor = '#10b981';
      if (text) text.textContent = 'Notifications activées';
    } else {
      statusBadge.classList.add('status-disabled');
      statusBadge.classList.remove('status-enabled');
      if (dot) dot.style.backgroundColor = '#ef4444';
      if (text) text.textContent = 'Notifications désactivées';
    }
  }

  if (toggleBtn) {
    toggleBtn.style.display = enabled ? 'none' : 'block';
  }
}

// ========================================
// CHARGER LE STATUT PUSH DE L'ÉQUIPE
// ========================================
async function loadTeamPushStatus() {
  const listEl = document.getElementById('teamPushStatusList');
  if (!listEl) return;

  try {
    const usersSnap = await db.ref('users').once('value');
    const users = usersSnap.val() || {};

    const usersList = Object.keys(users).map(uid => ({
      uid,
      ...users[uid]
    })).filter(u => u.name); // Seulement les utilisateurs avec un nom

    // Trier par nom
    usersList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    // Créer l'HTML
    let html = '';

    usersList.forEach(user => {
      const pushEnabled = user.pushEnabled === true;
      const pushEnabledAt = user.pushEnabledAt ? new Date(user.pushEnabledAt).toLocaleDateString('fr-FR') : null;
      const statusClass = pushEnabled ? 'status-enabled' : 'status-disabled';
      const statusIcon = pushEnabled ? '✅' : '❌';
      const statusText = pushEnabled ? 'Activé' : 'Non activé';
      const dateText = pushEnabledAt ? `le ${pushEnabledAt}` : '';

      html += `
        <div class="team-push-item ${statusClass}">
          <div class="team-push-avatar">
            ${user.name ? user.name.charAt(0).toUpperCase() : '?'}
          </div>
          <div class="team-push-info">
            <div class="team-push-name">${user.name || 'Utilisateur'}</div>
            <div class="team-push-email">${user.email || ''}</div>
          </div>
          <div class="team-push-status">
            <span class="status-icon">${statusIcon}</span>
            <span class="status-label">${statusText}</span>
            ${dateText ? `<span class="status-date">${dateText}</span>` : ''}
          </div>
        </div>
      `;
    });

    if (usersList.length === 0) {
      html = '<div class="text-muted text-center">Aucun utilisateur trouvé</div>';
    }

    listEl.innerHTML = html;
  } catch (error) {
    console.error('Error loading team push status:', error);
    listEl.innerHTML = '<div class="text-muted text-center">Erreur de chargement</div>';
  }
}

// ========================================
// ACTIVER LES PUSH DEPUIS L'ONGLET
// ========================================
async function enablePushFromTab() {
  try {
    const success = await setupPushNotifications();
    if (success) {
      if (typeof showToast === 'function') {
        showToast('✅ Notifications push activées !');
      } else {
        alert('✅ Notifications push activées !');
      }
    } else {
      alert('❌ Erreur lors de l'activation des notifications push');
    }
  } catch (error) {
    console.error('Error enabling push:', error);
    alert('❌ Erreur lors de l'activation');
  }
}

// ========================================
// ENVOYER UNE NOTIFICATION (INTELLIGENTE)
// ========================================
async function sendSmartNotification(notifType, recipients, payload) {
  /*
  notifType: 'objectiveReached', 'bonusCalculated', 'updates', etc.
  recipients: array of user IDs
  payload: { title, body, link }
  */

  if (!notificationConfig[notifType]) {
    console.error(`Unknown notification type: ${notifType}`);
    return;
  }

  const config = notificationConfig[notifType];
  const pushEnabled = config.push === true;
  const emailEnabled = config.email === true;
  const fallbackEnabled = config.fallback !== false;

  // Charger les infos des utilisateurs
  const usersSnap = await db.ref('users').once('value');
  const allUsers = usersSnap.val() || {};

  const pushRecipients = [];
  const emailRecipients = [];

  recipients.forEach(uid => {
    const user = allUsers[uid];
    if (!user) return;

    const userHasPush = user.pushEnabled === true && user.pushToken;

    // Logique de notification
    if (pushEnabled && userHasPush) {
      pushRecipients.push(uid);
    }

    if (emailEnabled) {
      emailRecipients.push(uid);
    } else if (fallbackEnabled && !userHasPush) {
      // Fallback: envoyer email si push pas activé
      emailRecipients.push(uid);
    }
  });

  // Envoyer les push
  if (pushRecipients.length > 0 && pushEnabled) {
    try {
      // Appeler la Cloud Function pour envoyer les push
      const sendPush = firebase.functions().httpsCallable('sendPushToUsers');
      await sendPush({
        userIds: pushRecipients,
        title: payload.title,
        body: payload.body,
        link: payload.link
      });
      console.log(`✅ Push sent to ${pushRecipients.length} users`);
    } catch (error) {
      console.error('Error sending push:', error);
    }
  }

  // Envoyer les emails
  if (emailRecipients.length > 0 && (emailEnabled || fallbackEnabled)) {
    try {
      // Appeler la Cloud Function pour envoyer les emails
      const sendEmail = firebase.functions().httpsCallable('sendEmailToUsers');
      await sendEmail({
        userIds: emailRecipients,
        subject: payload.title,
        html: `<p>${payload.body}</p>${payload.link ? `<p><a href="${payload.link}">Voir plus</a></p>` : ''}`
      });
      console.log(`✅ Email sent to ${emailRecipients.length} users`);
    } catch (error) {
      console.error('Error sending email:', error);
    }
  }
}

// ========================================
// INITIALISATION AU CHARGEMENT
// ========================================
window.addEventListener('DOMContentLoaded', () => {
  // Attacher le bouton de sauvegarde
  const saveBtn = document.getElementById('saveNotifConfigBtn');
  if (saveBtn) {
    saveBtn.onclick = saveNotificationConfig;
  }

  // Attacher le bouton d'activation push
  const toggleBtn = document.getElementById('toggleMyPushBtn');
  if (toggleBtn) {
    toggleBtn.onclick = enablePushFromTab;
  }

  // Vérifier le statut push au chargement
  setTimeout(() => {
    if (currentUser && currentUser.uid) {
      db.ref(`users/${currentUser.uid}/pushEnabled`).once('value').then(snap => {
        const enabled = snap.val() === true;
        updateBellVisibility(enabled);
      });
    }
  }, 1000);
});

// Export pour utilisation globale
window.setupPushNotifications = setupPushNotifications;
window.showNotificationsTab = showNotificationsTab;
window.sendSmartNotification = sendSmartNotification;
window.enablePushFromTab = enablePushFromTab;
window.loadNotificationConfig = loadNotificationConfig;
