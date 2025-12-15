/**
 * push-fcm.js (client helper)
 *
 * Works with Firebase v9 compat scripts:
 *   firebase-app-compat.js
 *   firebase-auth-compat.js
 *   firebase-database-compat.js
 *   firebase-messaging-compat.js
 *   firebase-functions-compat.js  (for calling sendPush from admin UI)
 *
 * RTDB structure used:
 *   /config/vapidKey
 *   /users/{uid}/pushEnabled, appInstalled, lastConnType, lastSeen
 *   /fcmTokens/{uid}/{tokenId} -> { token, createdAt, ua }
 */

(function () {
  function now() { return Date.now(); }
  function isPwaInstalled() {
    // Chrome/Android + desktop
    return window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
  }
  function connType() {
    return isPwaInstalled() ? "app" : "web";
  }
  async function getVapidKey() {
    const snap = await firebase.database().ref("config/vapidKey").get();
    const key = String(snap.val() || "").trim();
    if (!key) throw new Error("VAPID_KEY_MISSING");
    return key;
  }

  async function ensureServiceWorker() {
    if (!("serviceWorker" in navigator)) throw new Error("SW_UNSUPPORTED");
    // Must be at root: /firebase-messaging-sw.js
    return navigator.serviceWorker.register("/firebase-messaging-sw.js");
  }

  async function enablePushForCurrentUser() {
    const user = firebase.auth().currentUser;
    if (!user) throw new Error("NO_AUTH");

    // iOS Safari requires PWA install; we don't hard block here, but you can.
    if (!("Notification" in window)) throw new Error("NOTIFICATION_UNSUPPORTED");

    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error("PERMISSION_DENIED");

    // Messaging supported?
    if (!firebase.messaging.isSupported?.()) {
      // Some environments don't support FCM Web (private browsing, etc.)
      throw new Error("MESSAGING_UNSUPPORTED");
    }

    const swReg = await ensureServiceWorker();
    const vapidKey = await getVapidKey();

    const messaging = firebase.messaging();
    const token = await messaging.getToken({ vapidKey, serviceWorkerRegistration: swReg });
    if (!token) throw new Error("TOKEN_EMPTY");

    // Store token under user; allow multiple devices
    const tokenId = firebase.database().ref().push().key;
    await firebase.database().ref(`fcmTokens/${user.uid}/${tokenId}`).set({
      token,
      createdAt: now(),
      ua: navigator.userAgent
    });

    // Mark push enabled + connection info
    await firebase.database().ref(`users/${user.uid}`).update({
      pushEnabled: true,
      appInstalled: isPwaInstalled(),
      lastConnType: connType(),
      lastSeen: now()
    });

    return { ok: true, tokenId };
  }

  async function disablePushForCurrentUser() {
    const user = firebase.auth().currentUser;
    if (!user) throw new Error("NO_AUTH");

    // Best effort: delete current token from FCM
    try {
      if (firebase.messaging.isSupported?.()) {
        const messaging = firebase.messaging();
        await messaging.deleteToken();
      }
    } catch (e) {
      // ignore
    }

    // We also mark pushEnabled = false.
    await firebase.database().ref(`users/${user.uid}`).update({
      pushEnabled: false,
      lastConnType: connType(),
      lastSeen: now()
    });

    return { ok: true };
  }

  async function updatePresenceForCurrentUser() {
    const user = firebase.auth().currentUser;
    if (!user) return;
    await firebase.database().ref(`users/${user.uid}`).update({
      appInstalled: isPwaInstalled(),
      lastConnType: connType(),
      lastSeen: now()
    });
  }

  // Expose
  window.PushFCM = {
    enable: enablePushForCurrentUser,
    disable: disablePushForCurrentUser,
    updatePresence: updatePresenceForCurrentUser
  };
})();
