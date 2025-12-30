// ========================================
// PUSH NOTIFICATIONS SETUP
// ========================================

let currentFCMToken = null;

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
        vapidKey: 'VOTRE_VAPID_KEY_ICI' // À remplacer par ta clé VAPID
      });

      if (token) {
        currentFCMToken = token;
        console.log('FCM Token:', token);

        // Sauvegarder le token dans Firebase pour cet utilisateur
        if (currentUser && currentUser.uid) {
          await db.ref(`users/${currentUser.uid}/pushToken`).set(token);
          await db.ref(`users/${currentUser.uid}/pushEnabled`).set(true);
          await db.ref(`users/${currentUser.uid}/pushEnabledAt`).set(Date.now());
          console.log('Push enabled and saved to Firebase');
        }
      }
    }

    // Écouter les messages en foreground
    messaging.onMessage((payload) => {
      console.log('Message received (foreground):', payload);
      showInAppNotification(payload);
    });

  } catch (error) {
    console.error('Error setting up push:', error);
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
// PUSH UI SETUP (Bannière d'invitation)
// ========================================

function setupPushUI() {
  if (!currentUser || !currentUser.uid || !currentUser.email) {
    console.log('User not ready for push UI');
    return;
  }

  const banner = document.getElementById('pushInviteBanner');
  if (!banner) {
    console.log('Push banner not found in DOM');
    return;
  }

  // Vérifier si l'utilisateur a déjà activé les notifications
  db.ref(`users/${currentUser.uid}/pushEnabled`).once('value', (snap) => {
    const enabled = snap.val() === true;

    if (enabled) {
      // Déjà activé, masquer la bannière
      hidePushBanner(banner);
      updatePushBellIcon(true);
    } else {
      // Vérifier si l'utilisateur a déjà refusé
      const dismissed = localStorage.getItem(`pushDismissed_${currentUser.uid}`);
      if (dismissed) {
        // Ne pas afficher si déjà refusé
        return;
      }

      // Pas activé, afficher la bannière après 3 secondes
      setTimeout(() => {
        showPushBanner(banner);
      }, 3000);
    }
  });
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
    hidePushBanner(banner);

    updatePushBellIcon(true);

    if (typeof showToast === 'function') {
      showToast('✅ Notifications activées !');
    } else {
      alert('✅ Notifications activées !');
    }
  } catch (error) {
    console.error('Error enabling push:', error);
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

// Attacher les fonctions au bouton de la bannière
window.addEventListener('DOMContentLoaded', () => {
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
