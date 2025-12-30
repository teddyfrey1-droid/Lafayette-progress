// ====================================
// SYSTÈME DE NOTIFICATIONS PUSH
// ====================================

// Vérifie si les notifications sont supportées
function isNotificationSupported() {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

// Vérifie si les notifications sont activées
function areNotificationsEnabled() {
  if (!isNotificationSupported()) return false;
  return Notification.permission === 'granted';
}

// Vérifie si on a déjà demandé (pour ne pas re-afficher la bannière)
function hasAskedForNotifications() {
  return localStorage.getItem('pushNotificationsAsked') === 'true';
}

// Marque comme "déjà demandé"
function markNotificationsAsked() {
  localStorage.setItem('pushNotificationsAsked', 'true');
}

// Affiche la bannière d'invitation
function showInviteBanner() {
  const banner = document.getElementById('pushInviteBanner');
  if (!banner) return;

  // Afficher la bannière
  banner.style.display = 'block';

  // Attendre un instant puis ajouter la classe 'show' pour l'animation
  setTimeout(() => {
    banner.classList.add('show');
  }, 100);
}

// Cache la bannière d'invitation
function hideInviteBanner() {
  const banner = document.getElementById('pushInviteBanner');
  if (!banner) return;

  // Retirer la classe pour l'animation
  banner.classList.remove('show');

  // Attendre la fin de l'animation puis cacher
  setTimeout(() => {
    banner.style.display = 'none';
  }, 400);
}

// Demande la permission pour les notifications
async function requestNotificationPermission() {
  if (!isNotificationSupported()) {
    // Détecter iOS
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);

    if (isIOS) {
      alert('📱 Sur iPhone/iPad:\n\n1. Ouvre Réglages > Safari\n2. Notifications\n3. Active pour ce site');
    } else {
      alert('❌ Ton navigateur ne supporte pas les notifications push.');
    }

    markNotificationsAsked();
    hideInviteBanner();
    return false;
  }

  try {
    const permission = await Notification.requestPermission();

    // Marquer comme demandé dans tous les cas
    markNotificationsAsked();

    if (permission === 'granted') {
      console.log('✅ Notifications activées !');

      // Cacher la bannière
      hideInviteBanner();

      // Mettre à jour le bouton cloche
      updateBellButton();

      // Afficher une notification de test
      new Notification('🎉 Notifications activées !', {
        body: 'Tu recevras maintenant les mises à jour importantes.',
        icon: '/icon-192.jpg',
        badge: '/icon-192.jpg'
      });

      return true;
    } else if (permission === 'denied') {
      alert('❌ Permission refusée.\n\nPour activer :\n1. Clique sur le 🔒 à gauche de l\'URL\n2. Notifications > Autoriser');
      hideInviteBanner();
      return false;
    } else {
      // Permission 'default' (fermé sans choisir)
      hideInviteBanner();
      return false;
    }
  } catch (error) {
    console.error('Erreur permission notifications:', error);
    alert('❌ Erreur lors de l\'activation des notifications.');
    markNotificationsAsked();
    hideInviteBanner();
    return false;
  }
}

// Met à jour l'apparence du bouton cloche
function updateBellButton() {
  const bellBtn = document.getElementById('pushBellBtn');
  if (!bellBtn) return;

  const isEnabled = areNotificationsEnabled();

  if (isEnabled) {
    bellBtn.classList.add('enabled');
    bellBtn.title = 'Notifications activées';

    // Ajouter le point vert s'il n'existe pas
    if (!bellBtn.querySelector('.push-dot')) {
      const dot = document.createElement('span');
      dot.className = 'push-dot';
      bellBtn.appendChild(dot);
    }
  } else {
    bellBtn.classList.remove('enabled');
    bellBtn.title = 'Activer les notifications';

    // Retirer le point vert
    const dot = bellBtn.querySelector('.push-dot');
    if (dot) dot.remove();
  }
}

// Initialisation au chargement de la page
function initNotifications() {
  const bellBtn = document.getElementById('pushBellBtn');
  const inviteBanner = document.getElementById('pushInviteBanner');
  const activateBtn = document.getElementById('pushInviteActivate');
  const dismissBtn = document.getElementById('pushInviteDismiss');

  if (!bellBtn) {
    console.warn('⚠️ Bouton cloche non trouvé');
    return;
  }

  // Mettre à jour l'état initial du bouton cloche
  updateBellButton();

  // Afficher la bannière si notifications pas activées ET pas encore demandé
  if (!areNotificationsEnabled() && !hasAskedForNotifications()) {
    // Attendre 2 secondes avant d'afficher (pour ne pas être intrusif)
    setTimeout(() => {
      showInviteBanner();
    }, 2000);
  }

  // Gérer le clic sur la cloche
  bellBtn.addEventListener('click', async () => {
    if (areNotificationsEnabled()) {
      // Déjà activé - afficher un message
      alert('✅ Les notifications sont déjà activées !');
    } else {
      // Demander la permission
      await requestNotificationPermission();
    }
  });

  // Gérer le clic sur "Activer" dans la bannière
  if (activateBtn) {
    activateBtn.addEventListener('click', async () => {
      await requestNotificationPermission();
    });
  }

  // Gérer le clic sur "✕" pour fermer la bannière
  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      markNotificationsAsked();
      hideInviteBanner();
    });
  }

  console.log('🔔 Système de notifications initialisé');
}

// Lancer l'initialisation quand la page est chargée
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNotifications);
} else {
  initNotifications();
}
