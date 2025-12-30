/**
 * notifications.js
 * Push Notifications for Lafayette Progress
 * Browser-compatible version (no require)
 */

(function() {
  'use strict';

  // Firebase Messaging instance (already loaded via script tags in HTML)
  let messaging = null;

  /**
   * Initialize Firebase Messaging
   */
  function initMessaging() {
    try {
      if (!firebase || !firebase.messaging) {
        console.warn('Firebase Messaging not available');
        return false;
      }

      if (!firebase.messaging.isSupported()) {
        console.warn('Push notifications not supported in this browser');
        return false;
      }

      messaging = firebase.messaging();

      // Handle foreground messages
      messaging.onMessage((payload) => {
        console.log('Message reçu (foreground):', payload);

        const { title, body } = payload.notification || {};

        // Show toast notification
        if (typeof showToast === 'function') {
          showToast(title || 'Nouvelle notification');
        }

        // Show browser notification if permission granted
        if (Notification.permission === 'granted') {
          new Notification(title || 'Notification', {
            body: body || '',
            icon: '/icon-192.jpg',
            badge: '/icon-192.jpg'
          });
        }
      });

      return true;
    } catch (e) {
      console.error('Erreur init messaging:', e);
      return false;
    }
  }

  /**
   * Request notification permission and get token
   */
  async function enablePushNotifications() {
    try {
      // Check if messaging is initialized
      if (!messaging && !initMessaging()) {
        throw new Error('Firebase Messaging non disponible');
      }

      // Request permission
      const permission = await Notification.requestPermission();

      if (permission !== 'granted') {
        throw new Error('Permission refusée');
      }

      // Get FCM token
      const token = await messaging.getToken({
        vapidKey: 'BNw8cNne01234567890abcdefghijklmnopqrstuvwxyz' // Replace with your actual VAPID key
      });

      if (!token) {
        throw new Error('Impossible obtenir le token');
      }

      // Save token to Firebase for this user
      if (typeof currentUser !== 'undefined' && currentUser && currentUser.uid) {
        if (typeof db !== 'undefined' && db) {
          await db.ref(`users/${currentUser.uid}/fcmToken`).set(token);
          await db.ref(`users/${currentUser.uid}/notificationsEnabled`).set(true);
        }
      }

      console.log('Push notifications activées:', token);
      return { success: true, token };

    } catch (e) {
      console.error('Erreur activation notifications:', e);
      return { success: false, error: e.message };
    }
  }

  /**
   * Disable push notifications
   */
  async function disablePushNotifications() {
    try {
      if (!messaging) {
        return { success: true };
      }

      // Delete token
      await messaging.deleteToken();

      // Update Firebase
      if (typeof currentUser !== 'undefined' && currentUser && currentUser.uid) {
        if (typeof db !== 'undefined' && db) {
          await db.ref(`users/${currentUser.uid}/fcmToken`).remove();
          await db.ref(`users/${currentUser.uid}/notificationsEnabled`).set(false);
        }
      }

      console.log('Push notifications désactivées');
      return { success: true };

    } catch (e) {
      console.error('Erreur désactivation notifications:', e);
      return { success: false, error: e.message };
    }
  }

  /**
   * Setup Push Notifications UI
   */
  function setupPushUI() {
    // Initialize messaging
    initMessaging();

    const bellBtn = document.getElementById('pushBellBtn');
    const banner = document.getElementById('pushBanner');
    const bannerActivate = document.getElementById('pushBannerActivate');
    const bannerDismiss = document.getElementById('pushBannerDismiss');

    if (!bellBtn) {
      console.warn('Push bell button not found');
      return;
    }

    // Check current state
    const updateUI = () => {
      const enabled = currentUser?.notificationsEnabled === true;

      if (enabled) {
        bellBtn.classList.add('enabled');
        if (banner) banner.style.display = 'none';
      } else {
        bellBtn.classList.remove('enabled');
        // Show banner only if permission not already denied
        if (banner && Notification.permission !== 'denied') {
          banner.style.display = 'flex';
        }
      }
    };

    // Bell button click
    bellBtn.addEventListener('click', async () => {
      const enabled = currentUser?.notificationsEnabled === true;

      if (enabled) {
        // Disable
        const result = await disablePushNotifications();
        if (result.success) {
          if (typeof showToast === 'function') {
            showToast('Notifications désactivées');
          }
          updateUI();
        }
      } else {
        // Enable
        const result = await enablePushNotifications();
        if (result.success) {
          if (typeof showToast === 'function') {
            showToast('Notifications activées ! 🔔');
          }
          updateUI();
        } else {
          alert('Impossible activer les notifications: ' + (result.error || 'Erreur inconnue'));
        }
      }
    });

    // Banner activate button
    if (bannerActivate) {
      bannerActivate.addEventListener('click', async () => {
        const result = await enablePushNotifications();
        if (result.success) {
          if (typeof showToast === 'function') {
            showToast('Notifications activées ! 🔔');
          }
          updateUI();
        } else {
          alert('Impossible activer les notifications: ' + (result.error || 'Erreur inconnue'));
        }
      });
    }

    // Banner dismiss button
    if (bannerDismiss) {
      bannerDismiss.addEventListener('click', () => {
        if (banner) banner.style.display = 'none';
      });
    }

    // Initial UI update
    updateUI();
  }

  // Expose to global scope
  window.setupPushUI = setupPushUI;
  window.enablePushNotifications = enablePushNotifications;
  window.disablePushNotifications = disablePushNotifications;

})();
