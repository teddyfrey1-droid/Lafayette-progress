/* PWA Service Worker (NO-CACHE / Network-only)
   Objectif: éviter tout contenu "stale" après mise à jour.
   - pas de cache applicatif (HTML/CSS/JS) -> mise à jour immédiate
   - garde le SW uniquement pour les critères d'installation PWA
*/

/* --- Firebase Messaging (background) --- 
   Nécessaire pour afficher les notifications push en arrière-plan.
   (FCM + Safari iOS PWA)
*/
try{
  importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

  var firebaseConfig = {
      apiKey: "AIzaSyAGaitqmFwExvJ9ZUpkdUdCKAqqDOP2cdQ",
      authDomain: "objectif-restaurant.firebaseapp.com",
      databaseURL: "https://objectif-restaurant-default-rtdb.europe-west1.firebasedatabase.app",
      projectId: "objectif-restaurant",
      storageBucket: "objectif-restaurant.firebasestorage.app",
      messagingSenderId: "910113283000",
      appId: "1:910113283000:web:0951fd9dca01aa6e46cd4d"
    };

  // SW context : init firebase
  firebase.initializeApp(firebaseConfig);

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    // MODIFICATION IMPORTANTE : 
    // On regarde d'abord dans 'data' (nouveau format), sinon fallback sur 'notification'
    const title = payload.data?.title || payload.notification?.title || 'Heiko';
    const body = payload.data?.body || payload.notification?.body || '';
    
    // Récupération de l'URL (data.url est prioritaire)
    const dataUrl = payload.data?.url || (payload.fcmOptions && payload.fcmOptions.link) || '/';
    
    const icon = '/assets/icons/icon-192.png';
    
    self.registration.showNotification(title, {
      body: body,
      icon: icon,
      badge: icon,
      data: { url: dataUrl } // On passe l'URL au clic
    });
  });

  self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    // Récupère l'URL stockée dans les data de la notification affichée
    const urlToOpen = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/';
    
    event.waitUntil((async () => {
      const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of allClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(urlToOpen);
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })());
  });

}catch(e){
  // ignore (push disabled)
}

const SW_VERSION = 'v4-nocache-' + Date.now();

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // purge tous les caches existants (anciens SW)
    try{
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }catch(e){}
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // same-origin uniquement ; Firebase/Google Fonts etc en réseau standard
  if (url.origin !== self.location.origin) return;

  // Network-only + no-store (quand supporté)
  event.respondWith((async () => {
    try{
      const noStoreReq = new Request(req, { cache: 'no-store' });
      return await fetch(noStoreReq);
    }catch(e){
      // fallback
      return fetch(req);
    }
  })());
});
