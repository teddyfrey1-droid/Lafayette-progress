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

// Demande la permission pour les notifications
async function requestNotificationPermission() {
  if (!isNotificationSupported()) {
    alert('❌ Ton navigateur ne supporte pas les notifications push.');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      console.log('✅ Notifications activées !');

      // Afficher une notification de test
      new Notification('🎉 Notifications activées !', {
        body: 'Tu recevras maintenant les mises à jour importantes.',
        icon: '/icon-192.jpg',
        badge: '/icon-192.jpg'
      });

      return true;
    } else {
      alert('❌ Permission refusée. Active les notifications dans les paramètres de ton navigateur.');
      return false;
    }
  } catch (error) {
    console.error('Erreur permission notifications:', error);
    alert('❌ Erreur lors de l\'activation des notifications.');
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
  if (!bellBtn) {
    console.warn('⚠️ Bouton cloche non trouvé');
    return;
  }

  // Mettre à jour l'état initial
  updateBellButton();

  // Gérer le clic sur la cloche
  bellBtn.addEventListener('click', async () => {
    if (areNotificationsEnabled()) {
      // Déjà activé - afficher un message
      alert('✅ Les notifications sont déjà activées !');
    } else {
      // Demander la permission
      const granted = await requestNotificationPermission();
      if (granted) {
        updateBellButton();
      }
    }
  });

  console.log('🔔 Système de notifications initialisé');
}

// Lancer l'initialisation quand la page est chargée
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNotifications);
} else {
  initNotifications();
}
