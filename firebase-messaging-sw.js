/* firebase-messaging-sw.js
   Place this file at your site root (same level as index.html) and deploy it with your hosting.

   This service worker is for Firebase v9 compat usage:
   - It receives background messages and displays a notification.
*/

importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");

// ⚠️ You MUST paste your Firebase config here OR load it from a safe place.
// For simplicity, paste the same firebaseConfig you use in your front.
firebase.initializeApp({
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME",
  projectId: "REPLACE_ME",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME"
  // databaseURL/storageBucket are not required in SW for messaging
});

const messaging = firebase.messaging();

// Background messages
messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || "Notification";
  const options = {
    body: payload?.notification?.body || "",
    data: payload?.data || {}
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification?.data?.link || "/";
  event.waitUntil(clients.openWindow(link));
});
